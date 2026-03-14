import { MODULE } from "./constants.js";

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

/* -------------------------------------------- */

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
/*  Dice                                        */
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
