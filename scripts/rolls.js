import { MODULE, clampAttackCriticalLowerBound, is2d10DieFormula, isEqualDiceCriticalRoll,
  isWindowCriticalRoll, getDieParts, getSetting, registerSetting } from "./utils.js";

/**
 * Register settings and hooks.
 */
export function register() {
  registerSettings();
  registerHooks();
}

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

/**
 * Roll type definitions. Each produces a "die" setting.
 */
const ROLL_TYPES = [
  { key: "ability",        label: "CUSTOM_ROLLS.abilityCheck" },
  { key: "concentration",  label: "CUSTOM_ROLLS.concentrationSavingThrow" },
  { key: "initiative",     label: "CUSTOM_ROLLS.initiativeRoll" },
  { key: "savingThrow",    label: "CUSTOM_ROLLS.savingThrow" },
  { key: "skill",          label: "CUSTOM_ROLLS.skillCheck" },
  { key: "tool",           label: "CUSTOM_ROLLS.toolCheck" },
  { key: "attack",         label: "CUSTOM_ROLLS.attackRoll" }
];

const CRITICAL_RULE_CHOICES = {
  normal:    "CUSTOM_ROLLS.rolls.criticalRule.normal",
  equalDice: "CUSTOM_ROLLS.rolls.criticalRule.equalDice",
  window:    "CUSTOM_ROLLS.rolls.criticalRule.window"
};

const APPLY_TO_CHOICES = {
  players: "CUSTOM_ROLLS.applyTo.players",
  gm:      "CUSTOM_ROLLS.applyTo.gm",
  both:    "CUSTOM_ROLLS.applyTo.both"
};

/**
 * Register all inline settings.
 */
function registerSettings() {
  registerSetting("applyTo", {
    name: game.i18n.localize("CUSTOM_ROLLS.setting.applyTo.name"),
    hint: game.i18n.localize("CUSTOM_ROLLS.setting.applyTo.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "players",
    choices: APPLY_TO_CHOICES
  });

  for ( const { key } of ROLL_TYPES ) {
    registerSetting(`${key}.die`, {
      name: `CUSTOM_ROLLS.setting.${key}.die.name`,
      hint: `CUSTOM_ROLLS.setting.${key}.die.hint`,
      scope: "world",
      config: true,
      type: String,
      default: "1d20",
      onChange: () => Hooks.callAll("customRollsDieChanged")
    });
  }

  registerSetting("attack.criticalRule", {
    name: game.i18n.localize("CUSTOM_ROLLS.setting.criticalRule.name"),
    hint: game.i18n.localize("CUSTOM_ROLLS.setting.criticalRule.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "normal",
    choices: CRITICAL_RULE_CHOICES
  });

  registerSetting("attack.criticalLowerBound", {
    name: game.i18n.localize("CUSTOM_ROLLS.setting.criticalLowerBound.name"),
    hint: game.i18n.localize("CUSTOM_ROLLS.setting.criticalLowerBound.hint"),
    scope: "world",
    config: true,
    type: Number,
    default: 19,
    range: { min: 1, max: 19, step: 1 }
  });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/**
 * Build a rolls object from individual settings.
 * @returns {object} The collected roll settings
 */
function getRollSettings() {
  const rolls = {};
  for ( const { key } of ROLL_TYPES ) {
    rolls[key] = {
      die: getSetting(`${key}.die`, "1d20")
    };
  }
  rolls.attack.criticalRule = getSetting("attack.criticalRule", "normal");
  rolls.attack.criticalLowerBound = getSetting("attack.criticalLowerBound", 19);
  return rolls;
}

/**
 * Register hooks.
 */
function registerHooks() {
  Hooks.on("dnd5e.preRollV2", (config, dialog, message) => {
    const applyTo = getSetting("applyTo", "players");
    if ( applyTo === "players" && game.user.isGM ) return;
    if ( applyTo === "gm" && !game.user.isGM ) return;

    const roll = resolveRoll(config, getRollSettings());
    if ( !roll ) return;

    applyCustomDie(config, roll);

    if ( config.hookNames.includes("attack") ) {
      applyAttackCriticalRule(config.rolls[0].options, roll, getDieParts(roll.die));
    }
  });

  Hooks.on("renderChatMessageHTML", highlightAlternativeCriticalChat);
  Hooks.on("renderSettingsConfig", onRenderSettingsConfig);
}

/**
 * Determine which roll settings apply based on hook names.
 * @param {object} config The roll config
 * @param {object} rolls The collected roll settings
 * @returns {object|null} The matching roll settings, or null
 */
function resolveRoll(config, rolls) {
  const hookNames = config.hookNames;

  if ( hookNames.includes("concentration") )   return rolls.concentration;
  if ( hookNames.includes("initiativeDialog") ) return rolls.initiative;
  if ( hookNames.includes("attack") )           return rolls.attack;
  if ( hookNames.includes("skill") ) {
    return { ...rolls.skill };
  }
  if ( hookNames.includes("tool") )             return rolls.tool;
  if ( hookNames.includes("AbilityCheck") ) {
    return { ...rolls.ability };
  }
  if ( hookNames.includes("SavingThrow") ) {
    return { ...rolls.savingThrow };
  }
  return null;
}

/**
 * Apply a custom die formula to the roll config.
 * @param {object} config The roll config
 * @param {object} roll The roll settings
 */
function applyCustomDie(config, roll) {
  const dieParts = getDieParts(roll.die);
  if ( roll.die === "1d20" || !dieParts ) return;

  const options = config.rolls[0].options;
  options.customDie = roll.die;
  options.criticalSuccess = dieParts.number * dieParts.faces;
  options.criticalFailure = dieParts.number;
}

/* -------------------------------------------- */
/*  Attack Critical Rules                       */
/* -------------------------------------------- */

/**
 * Apply custom critical rules for attack rolls.
 * @param {object} options The roll options
 * @param {object} rollSettings The roll settings
 * @param {object|null} dieParts Parsed die parts
 */
function applyAttackCriticalRule(options, rollSettings, dieParts) {
  const criticalRule = rollSettings?.criticalRule ?? "normal";
  if ( criticalRule === "normal" ) return;

  const threshold = clampAttackCriticalLowerBound(rollSettings?.criticalLowerBound);

  options.customDnd5eCriticalRule = criticalRule;
  options.customDnd5eCriticalLowerBound = threshold;

  if ( criticalRule === "window" ) {
    options.criticalSuccess = threshold;
    return;
  }

  // Equal-dice crits only make sense for 2d10.
  if ( criticalRule === "equalDice" && !(dieParts?.number === 2 && dieParts?.faces === 10) ) {
    delete options.customDnd5eCriticalRule;
    delete options.customDnd5eCriticalLowerBound;
  }
}

/* -------------------------------------------- */
/*  Chat Highlighting                           */
/* -------------------------------------------- */

/**
 * Highlight attack rolls in chat when using alternative 2d10 critical rules.
 * @param {ChatMessage} message The chat message
 * @param {HTMLElement|jQuery} html The rendered HTML
 */
function highlightAlternativeCriticalChat(message, html) {
  const rolls = message?.rolls ?? [];
  if ( !rolls.length ) return;

  const criticalIndices = rolls
    .map((roll, i) => isAlternativeCriticalRoll(roll) ? i : -1)
    .filter(i => i >= 0);

  if ( !criticalIndices.length ) return;

  const root = html?.[0] ?? html;
  if ( !root?.querySelectorAll ) return;

  const totals = Array.from(root.querySelectorAll(".dice-roll .dice-total"));
  for ( const index of criticalIndices ) {
    const total = totals[index];
    if ( !total ) continue;
    total.classList.add("success", "critical");
    total.classList.remove("failure", "fumble");
    injectCriticalIcons(total);
  }
}

/**
 * Whether a roll qualifies as an alternative 2d10 critical.
 * @param {object} roll The roll
 * @returns {boolean}
 */
function isAlternativeCriticalRoll(roll) {
  const rule = roll?.options?.customDnd5eCriticalRule;
  if ( rule === "equalDice" ) return isEqualDiceCriticalRoll(roll);
  if ( rule === "window" )    return isWindowCriticalRoll(roll);
  return false;
}

/**
 * Inject critical icons into a dice total element if missing.
 * @param {HTMLElement} total The dice total element
 */
function injectCriticalIcons(total) {
  if ( total.querySelector(".icons, .fa-check-double, .fa-check") ) return;

  const icons = document.createElement("span");
  icons.classList.add("icons", `${MODULE.ID}-critical-icons`);

  for ( let i = 0; i < 2; i++ ) {
    const icon = document.createElement("i");
    icon.classList.add("fas", "fa-check");
    icons.append(icon);
  }

  total.append(icons);
}

/* -------------------------------------------- */
/*  Settings Config UI                          */
/* -------------------------------------------- */

/**
 * Toggle visibility of the "equalDice" critical rule option based on the attack die.
 * @param {Application} app The settings config application
 * @param {HTMLElement|jQuery} html The rendered HTML
 */
function onRenderSettingsConfig(app, html) {
  const root = html?.[0]?.form ?? html.form;
  if ( !root?.querySelector ) return;

  const dieInput = root.querySelector(`[name="${MODULE.ID}.attack.die"]`);
  const ruleSelect = root.querySelector(`[name="${MODULE.ID}.attack.criticalRule"]`);
  if ( !dieInput || !ruleSelect ) return;

  /**
   * Show or hide the equalDice option based on the current die value.
   * @param {string} dieValue The current die formula
   */
  function toggleEqualDiceOption(dieValue) {
    const option = ruleSelect.querySelector('option[value="equalDice"]');
    if ( !option ) return;

    const allowed = is2d10DieFormula(dieValue);
    option.hidden = !allowed;
    option.disabled = !allowed;

    // If equalDice is selected but no longer allowed, reset to "normal".
    if ( !allowed && ruleSelect.value === "equalDice" ) {
      ruleSelect.value = "normal";
    }
  }

  // Set initial state.
  toggleEqualDiceOption(dieInput.value);

  // React when the attack die input changes.
  dieInput.addEventListener("change", () => toggleEqualDiceOption(dieInput.value));
  dieInput.addEventListener("input", () => toggleEqualDiceOption(dieInput.value));
}

/* -------------------------------------------- */
/*  Exports                                     */
/* -------------------------------------------- */

/**
 * Check if any custom (non-1d20) die is configured.
 * @returns {boolean}
 */
export function isCustomRoll() {
  return ROLL_TYPES.some(({ key }) => {
    const die = getSetting(`${key}.die`, "1d20");
    return die && die !== "1d20";
  });
}