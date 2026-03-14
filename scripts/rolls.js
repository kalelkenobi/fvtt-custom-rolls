import { CONSTANTS } from "./constants.js";
import { clampAttackCriticalLowerBound, isEqualDiceCriticalRoll, isWindowCriticalRoll } from "./critical-rules.js";
import { getDieParts, getSetting, registerSetting } from "./utils.js";

/**
 * Register settings and hooks.
 */
export function register() {
  registerSettings();
  registerHooks();
}

/* -------------------------------------------- */

/**
 * Setting definitions for each roll type.
 * Each entry produces two Foundry settings: "<key>.die" and "<key>.rollMode".
 * Attack rolls additionally get "attack.criticalRule" and "attack.criticalLowerBound".
 */
const ROLL_TYPES = [
  { key: "ability",        label: "CUSTOM_ROLLS.abilityCheck" },
  { key: "attack",         label: "CUSTOM_ROLLS.attackRoll" },
  { key: "concentration",  label: "CUSTOM_ROLLS.concentrationSavingThrow" },
  { key: "initiative",     label: "CUSTOM_ROLLS.initiativeRoll" },
  { key: "savingThrow",    label: "CUSTOM_ROLLS.savingThrow" },
  { key: "skill",          label: "CUSTOM_ROLLS.skillCheck" },
  { key: "tool",           label: "CUSTOM_ROLLS.toolCheck" }
];

const ROLL_MODE_CHOICES = {
  default:    "CUSTOM_ROLLS.default",
  blindroll:  "CHAT.RollBlind",
  gmroll:     "CHAT.RollPrivate",
  publicroll: "CHAT.RollPublic",
  selfroll:   "CHAT.RollSelf"
};

const CRITICAL_RULE_CHOICES = {
  normal:    "CUSTOM_ROLLS.rolls.criticalRule.normal",
  equalDice: "CUSTOM_ROLLS.rolls.criticalRule.equalDice",
  window:    "CUSTOM_ROLLS.rolls.criticalRule.window"
};

/* -------------------------------------------- */

/**
 * Register all inline settings.
 */
function registerSettings() {
  for ( const { key, label } of ROLL_TYPES ) {
    // Die setting
    registerSetting(
      `${key}.die`,
      {
        name: game.i18n.format("CUSTOM_ROLLS.setting.die.name", { roll: game.i18n.localize(label) }),
        hint: game.i18n.format("CUSTOM_ROLLS.setting.die.hint", { roll: game.i18n.localize(label) }),
        scope: "world",
        config: true,
        type: String,
        default: "1d20",
        requiresReload: true
      }
    );

    // Roll mode setting
    registerSetting(
      `${key}.rollMode`,
      {
        name: game.i18n.format("CUSTOM_ROLLS.setting.rollMode.name", { roll: game.i18n.localize(label) }),
        hint: game.i18n.format("CUSTOM_ROLLS.setting.rollMode.hint", { roll: game.i18n.localize(label) }),
        scope: "world",
        config: true,
        type: String,
        default: "default",
        choices: ROLL_MODE_CHOICES,
        requiresReload: true
      }
    );
  }

  // Attack-specific: Critical Hit Rule
  registerSetting(
    "attack.criticalRule",
    {
      name: game.i18n.localize("CUSTOM_ROLLS.setting.criticalRule.name"),
      hint: game.i18n.localize("CUSTOM_ROLLS.setting.criticalRule.hint"),
      scope: "world",
      config: true,
      type: String,
      default: "normal",
      choices: CRITICAL_RULE_CHOICES,
      requiresReload: true
    }
  );

  // Attack-specific: Critical Hit Lower Bound
  registerSetting(
    "attack.criticalLowerBound",
    {
      name: game.i18n.localize("CUSTOM_ROLLS.setting.criticalLowerBound.name"),
      hint: game.i18n.localize("CUSTOM_ROLLS.setting.criticalLowerBound.hint"),
      scope: "world",
      config: true,
      type: Number,
      default: 19,
      range: { min: 1, max: 19, step: 1 },
      requiresReload: true
    }
  );
}

/* -------------------------------------------- */

/**
 * Build a rolls object from individual settings for use in the hook.
 * @returns {object} The collected roll settings
 */
function getRollSettings() {
  const rolls = {};
  for ( const { key } of ROLL_TYPES ) {
    rolls[key] = {
      die: getSetting(`${key}.die`, "1d20"),
      rollMode: getSetting(`${key}.rollMode`, "default")
    };
  }
  rolls.attack.criticalRule = getSetting("attack.criticalRule", "normal");
  rolls.attack.criticalLowerBound = getSetting("attack.criticalLowerBound", 19);
  return rolls;
}

/* -------------------------------------------- */

/**
 * Register hooks.
 */
function registerHooks() {
  Hooks.on("dnd5e.preRollV2", (config, dialog, message) => {
    const hookNames = config.hookNames;
    const rolls = getRollSettings();

    let roll = null;
    let rollMode = null;

    let isAttackRoll = false;

    if ( hookNames.includes("concentration") ) {
      roll = rolls.concentration;
    } else if ( hookNames.includes("initiativeDialog") ) {
      roll = rolls.initiative;
    } else if ( hookNames.includes("attack") ) {
      isAttackRoll = true;
      roll = rolls.attack;
      rollMode = rolls.attack.rollMode;
    } else if ( hookNames.includes("skill") ) {
      roll = rolls.skill;
      rollMode = CONFIG.DND5E?.skills[config.skill]?.rollMode;
    } else if ( hookNames.includes("tool") ) {
      roll = rolls.tool;
    } else if ( hookNames.includes("AbilityCheck") ) {
      roll = rolls.ability;
      rollMode = CONFIG.DND5E?.abilities[config.ability]?.rollMode;
    } else if ( hookNames.includes("SavingThrow") ) {
      roll = rolls.savingThrow;
      rollMode = CONFIG.DND5E?.abilities[config.ability]?.rollMode;
    }

    if ( !roll || game.user.isGM ) return;

    const dieParts = getDieParts(roll.die);
    if ( roll.die !== "1d20" && dieParts ) {
      config.rolls[0].options.customDie = roll.die;
      config.rolls[0].options.criticalSuccess = dieParts.number * dieParts.faces;
      config.rolls[0].options.criticalFailure = dieParts.number;
    }

    // Apply attack critical rules after default critical thresholds are assigned so custom windows are not overwritten.
    if ( isAttackRoll ) {
      applyAttackCriticalRule(config.rolls[0].options, roll, dieParts);
    }

    const rollModes = ["publicroll", "gmroll", "blindroll", "selfroll"];
    if ( rollModes.includes(rollMode) ) {
      message.rollMode = rollMode;
    } else if ( rollModes.includes(roll.rollMode) ) {
      message.rollMode = roll.rollMode;
    }
  });

  Hooks.on("renderChatMessage", highlightAlternativeCriticalChat);
  Hooks.on("renderChatMessageHTML", highlightAlternativeCriticalChat);
}

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

  const criticalLowerBound = Number.parseInt(rollSettings?.criticalLowerBound, 10);
  const threshold = clampAttackCriticalLowerBound(criticalLowerBound);

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

/**
 * Highlight attack rolls in chat when using alternative 2d10 critical rules.
 * @param {ChatMessage} message The chat message
 * @param {HTMLElement|jQuery} html The rendered HTML
 */
function highlightAlternativeCriticalChat(message, html) {
  const rolls = message?.rolls ?? [];
  if ( !rolls.length ) return;

  const criticalRollIndices = [];
  for ( const [index, roll] of rolls.entries() ) {
    if ( !isAlternativeCriticalRoll(roll) ) continue;
    criticalRollIndices.push(index);
  }

  if ( !criticalRollIndices.length ) return;

  const root = html?.[0] ?? html;
  if ( !root?.querySelectorAll ) return;

  const totals = Array.from(root.querySelectorAll(".dice-roll .dice-total"));
  for ( const rollIndex of criticalRollIndices ) {
    const total = totals[rollIndex];
    if ( !total ) continue;
    total.classList.add("success", "critical");
    total.classList.remove("failure", "fumble");
    injectCriticalIcons(total);
  }
}

/* -------------------------------------------- */

/**
 * Whether a roll qualifies as an alternative 2d10 critical.
 * @param {object} roll The roll
 * @returns {boolean} Whether the roll is an alternative critical
 */
function isAlternativeCriticalRoll(roll) {
  const rule = roll?.options?.customDnd5eCriticalRule;
  if ( !["equalDice", "window"].includes(rule) ) return false;

  if ( rule === "equalDice" ) {
    return isEqualDiceCriticalRoll(roll);
  }

  return isWindowCriticalRoll(roll);
}

/* -------------------------------------------- */

/**
 * Inject critical icons into a chat roll total if they are missing.
 * @param {HTMLElement} total The dice total element
 */
function injectCriticalIcons(total) {
  if ( total.querySelector(".icons, .fa-check-double, .fa-check") ) return;

  const icons = document.createElement("span");
  icons.classList.add("icons", `${CONSTANTS.ROLLS.ID}-critical-icons`);

  const first = document.createElement("i");
  first.classList.add("fas", "fa-check");

  const second = document.createElement("i");
  second.classList.add("fas", "fa-check");

  icons.append(first, second);
  total.append(icons);
}

/* -------------------------------------------- */

/**
 * Check if custom roll settings are applied.
 *
 * @returns {boolean} Whether custom roll settings are applied
 */
export function isCustomRoll() {
  const customDice = ROLL_TYPES.map(({ key }) => getSetting(`${key}.die`, "1d20"));
  return customDice.some(die => die && die !== "1d20");
}
