/* -------------------------------------------- */
/*  Module Identity                             */
/* -------------------------------------------- */

export const MODULE = {
  ID: "custom-rolls",
  NAME: "Custom Rolls"
};

/* -------------------------------------------- */
/*  Logging                                     */
/* -------------------------------------------- */

/** Console logger. */
export class Logger {
  /**
   * Log an error message.
   * @param {string} message
   * @param {boolean} [notify=false] Whether to show a UI notification
   */
  static error(message, notify = false) {
    const label = `${MODULE.NAME} | ${message}`;
    if ( notify ) ui.notifications.error(label);
    else console.error(`${MODULE.NAME} Error | ${message}`);
  }

  /**
   * Log a debug message.
   * @param {string} message
   * @param {*} [data]
   */
  static debug(message, data) {
    try {
      if ( !game.settings?.get(MODULE.ID, "debug") ) return;
    } catch {
      return;
    }
    if ( data ) {
      console.log(`${MODULE.NAME} Debug | ${message}`, foundry.utils.deepClone(data));
    } else {
      console.log(`${MODULE.NAME} Debug | ${message}`);
    }
  }
}

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

/**
 * Register a setting.
 * @param {string} key
 * @param {object} options
 */
export function registerSetting(key, options) {
  game.settings.register(MODULE.ID, key, options);
}

/**
 * Get a setting value.
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
export function getSetting(key, defaultValue = null) {
  try {
    return game.settings.get(MODULE.ID, key);
  } catch {
    Logger.debug(`Setting '${key}' not found`);
  }
  return defaultValue ?? null;
}

/* -------------------------------------------- */
/*  Dice Parsing                                */
/* -------------------------------------------- */

/**
 * Parse a die formula into its components.
 * @param {string} input A die formula such as "2d10"
 * @returns {{number: number, faces: number}|null}
 */
export function getDieParts(input) {
  const match = input?.match(/\b(\d+)[dD](\d+)\b/);
  return match ? { number: parseInt(match[1], 10), faces: parseInt(match[2], 10) } : null;
}

/* -------------------------------------------- */
/*  Critical Rules                              */
/* -------------------------------------------- */

/**
 * Clamp an attack critical lower bound to the supported range (1–19).
 * @param {number|string} value The configured value
 * @returns {number} The clamped value
 */
export function clampAttackCriticalLowerBound(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 19) : 19;
}

/**
 * Check whether a die formula is 2d10.
 * @param {string} formula The die formula
 * @returns {boolean}
 */
export function is2d10DieFormula(formula) {
  const dieParts = getDieParts(formula);
  return dieParts?.number === 2 && dieParts?.faces === 10;
}

/**
 * Get active die results from the roll's d20 term.
 * @param {object} roll The roll
 * @returns {number[]} Active result values
 */
export function getActiveD20Results(roll) {
  return (roll?.d20?.results ?? [])
    .filter(result => result?.active !== false)
    .map(result => Number.parseInt(result.result, 10))
    .filter(Number.isInteger);
}

/**
 * Check whether a roll is a 2d10 equal-dice critical.
 * @param {object} roll The roll
 * @returns {boolean}
 */
export function isEqualDiceCriticalRoll(roll) {
  if ( !is2d10DieFormula(roll?.options?.customDie) ) return false;

  const activeResults = getActiveD20Results(roll);
  return activeResults.length === 2 && activeResults[0] === activeResults[1];
}

/**
 * Check whether a roll total meets the configured critical window.
 * @param {object} roll The roll
 * @returns {boolean}
 */
export function isWindowCriticalRoll(roll) {
  const activeResults = getActiveD20Results(roll);
  if ( !activeResults.length ) return false;

  const threshold = clampAttackCriticalLowerBound(roll?.options?.customDnd5eCriticalLowerBound);
  return activeResults.reduce((sum, value) => sum + value, 0) >= threshold;
}
