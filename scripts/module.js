import { MODULE, getDieParts, registerSetting, clampAttackCriticalLowerBound, getActiveD20Results,
  is2d10DieFormula, isEqualDiceCriticalRoll, isWindowCriticalRoll } from "./utils.js";
import { register as registerRolls, isCustomRoll } from "./rolls.js";

let isPatched = false;

/**
 * Apply libWrapper patches if they haven't been applied yet.
 */
function ensurePatched() {
  if ( isPatched ) return;
  patchD20Die();
  patchD20Roll();
  isPatched = true;
}

/**
 * Initialize the module and register settings, hooks, and patches.
 */
Hooks.on("init", async () => {
  registerSetting("debug", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  registerRolls();

  if ( isCustomRoll() ) {
    ensurePatched();
  }
});

Hooks.on("customRollsDieChanged", ensurePatched);

/* ============================================ */
/*  D20Die Patch                                */
/* ============================================ */

/**
 * Patch the D20Die to apply custom roll settings.
 */
function patchD20Die() {
  libWrapper.register(MODULE.ID, "CONFIG.Dice.D20Die.prototype.applyAdvantage", applyAdvantagePatch, "OVERRIDE");
}

/**
 * Apply advantage or disadvantage to the roll.
 * @param {number} advantageMode The advantage mode
 */
function applyAdvantagePatch(advantageMode) {
  const customDieParts = getDieParts(this.options.customDie);
  const baseNumber = customDieParts?.number ?? 1;
  const is2d10 = customDieParts?.number === 2 && customDieParts?.faces === 10;

  this.options.advantageMode = advantageMode;
  this.modifiers.findSplice(m => ["kh", "kl"].includes(m));

  if ( advantageMode === CONFIG.Dice.D20Roll.ADV_MODE.NORMAL || is2d10 ) {
    this.number = baseNumber;
    return;
  }

  const isAdvantage = advantageMode === CONFIG.Dice.D20Roll.ADV_MODE.ADVANTAGE;
  this.number = (isAdvantage && this.options.elvenAccuracy) ? (baseNumber * 3) : baseNumber * 2;
  this.modifiers.push(isAdvantage ? `kh${baseNumber}` : `kl${baseNumber}`);
}

/* ============================================ */
/*  D20Roll Patches                             */
/* ============================================ */

/**
 * Patch the D20Roll to apply custom roll settings.
 */
function patchD20Roll() {
  libWrapper.register(MODULE.ID, "CONFIG.Dice.D20Roll.fromConfig", fromConfigPatch, "OVERRIDE");
  libWrapper.register(MODULE.ID, "CONFIG.Dice.D20Roll.prototype.configureModifiers", configureModifiersPatch, "WRAPPER");
  libWrapper.register(MODULE.ID, "CONFIG.Dice.D20Roll.prototype.validD20Roll", validD20RollPatch, "OVERRIDE");
  patchIsCriticalGetter();
}

/**
 * Override D20Roll.fromConfig to support custom dice.
 * @param {object} config The roll configuration
 * @param {object} process The process data
 * @returns {CONFIG.Dice.D20Roll} The configured D20Roll
 */
function fromConfigPatch(config, process) {
  const baseDie = config.options?.customDie || new CONFIG.Dice.D20Die().formula;
  const formula = [baseDie].concat(config.parts ?? []).join(" + ");
  config.options.target ??= process.target;
  return new this(formula, config.data, config.options);
}

/**
 * Wrapper for configureModifiers to propagate custom die and apply 2d10 house rule.
 * @param {Function} wrapped The original function
 */
function configureModifiersPatch(wrapped) {
  if ( this.options.customDie ) this.d20.options.customDie = this.options.customDie;
  wrapped();
  apply2d10AdvantageHouseRule(this);
}

/**
 * Override validD20Roll to accept custom dice as valid.
 * @returns {boolean} Whether the roll is valid
 */
function validD20RollPatch() {
  return !!this.options.customDie || ((this.d20 instanceof CONFIG.Dice.D20Die) && this.d20.isValid);
}

/* -------------------------------------------- */
/*  2d10 Advantage House Rule                   */
/* -------------------------------------------- */

/**
 * Get the selected advantage mode from roll options.
 * @param {object} options Roll options
 * @returns {number} Advantage mode constant
 */
function getAdvantageMode(options) {
  const advModes = CONFIG.Dice.D20Roll.ADV_MODE;
  if ( Number.isInteger(options.advantageMode) ) return options.advantageMode;
  if ( options.advantage === true ) return advModes.ADVANTAGE;
  if ( options.disadvantage === true ) return advModes.DISADVANTAGE;
  return advModes.NORMAL;
}

/**
 * Replace advantage/disadvantage with ±1d6 when using 2d10.
 * @param {CONFIG.Dice.D20Roll} roll The roll instance
 */
function apply2d10AdvantageHouseRule(roll) {
  if ( !roll?.options || roll.options.__houseRule2d10Applied ) return;
  if ( !is2d10DieFormula(roll.options.customDie) ) return;

  const dieOptions = roll.d20?.options ?? {};
  const advantageMode = getAdvantageMode({ ...roll.options, ...dieOptions });
  const advModes = CONFIG.Dice.D20Roll.ADV_MODE;
  if ( ![advModes.ADVANTAGE, advModes.DISADVANTAGE].includes(advantageMode) ) return;

  roll.options.__houseRule2d10Applied = true;
  roll.options.advantageMode = advModes.NORMAL;
  roll.options.advantage = false;
  roll.options.disadvantage = false;
  if ( roll.d20?.options ) roll.d20.options.advantageMode = advModes.NORMAL;

  const sign = (advantageMode === advModes.ADVANTAGE) ? "+" : "-";
  const bonusTerms = Roll.parse("1d6");
  roll.terms.push(new foundry.dice.terms.OperatorTerm({ operator: sign }));
  roll.terms.push(...(Array.isArray(bonusTerms) ? bonusTerms : (bonusTerms?.terms ?? [])));
  roll.resetFormula();
}

/* -------------------------------------------- */
/*  isCritical Patch                            */
/* -------------------------------------------- */

/**
 * Patch D20Roll.isCritical to support alternative 2d10 critical rules.
 */
function patchIsCriticalGetter() {
  const proto = CONFIG.Dice.D20Roll.prototype;
  if ( proto.__customRollsIsCriticalPatched ) return;

  const descriptor = getPropertyDescriptor(proto, "isCritical");
  const originalGetter = descriptor?.get;
  const originalValue = descriptor?.value;

  if ( typeof originalGetter !== "function" && typeof originalValue !== "function" ) return;

  if ( typeof originalGetter === "function" ) {
    Object.defineProperty(proto, "isCritical", {
      configurable: true,
      enumerable: descriptor.enumerable ?? false,
      get() {
        return isAlternative2d10Critical(this) ?? originalGetter.call(this);
      }
    });
  } else {
    Object.defineProperty(proto, "isCritical", {
      configurable: true,
      enumerable: descriptor.enumerable ?? false,
      writable: true,
      value: function(...args) {
        return isAlternative2d10Critical(this) ?? originalValue.call(this, ...args);
      }
    });
  }

  Object.defineProperty(proto, "__customRollsIsCriticalPatched", {
    configurable: true,
    enumerable: false,
    value: true,
    writable: false
  });
}

/**
 * Walk the prototype chain to find a property descriptor.
 * @param {object} object The object to inspect
 * @param {string} key The property key
 * @returns {PropertyDescriptor|null}
 */
function getPropertyDescriptor(object, key) {
  let current = object;
  while ( current ) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if ( descriptor ) return descriptor;
    current = Object.getPrototypeOf(current);
  }
  return null;
}

/**
 * Check whether a roll is a critical under alternative 2d10 rules.
 * Returns true/false if the rule applies, or null to fall through to the original getter.
 * @param {CONFIG.Dice.D20Roll} roll The roll instance
 * @returns {boolean|null}
 */
function isAlternative2d10Critical(roll) {
  const rule = roll?.options?.customDnd5eCriticalRule;
  if ( !is2d10DieFormula(roll?.options?.customDie) ) return null;

  if ( rule === "equalDice" ) return isEqualDiceCriticalRoll(roll);
  if ( rule === "window" ) {
    const activeResults = getActiveD20Results(roll);
    if ( activeResults.length !== 2 ) return false;
    const threshold = clampAttackCriticalLowerBound(roll?.options?.customDnd5eCriticalLowerBound);
    if ( roll?.options ) roll.options.customDnd5eCriticalLowerBound = threshold;
    return isWindowCriticalRoll(roll);
  }
  return null;
}
