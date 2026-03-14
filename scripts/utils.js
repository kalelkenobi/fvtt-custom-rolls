import { CONSTANTS, MODULE } from "./constants.js";

/* -------------------------------------------- */
/*  Logging                                     */
/* -------------------------------------------- */

/** Console logger. */
export class Logger {
  /**
   * Log an info message.
   * @param {string} message
   * @param {boolean} [notify=false] Whether to show a UI notification
   * @param {object} [options]
   * @param {boolean} [options.prefix=true]
   */
  static info(message, notify = false, { prefix = true } = {}) {
    const label = prefix ? `${MODULE.NAME} | ${message}` : message;
    if ( notify ) ui.notifications.info(label);
    else console.log(prefix ? `${MODULE.NAME} Info | ${message}` : message);
  }

  /**
   * Log an error message.
   * @param {string} message
   * @param {boolean} [notify=false] Whether to show a UI notification
   * @param {object} [options]
   * @param {boolean} [options.prefix=true]
   */
  static error(message, notify = false, { prefix = true } = {}) {
    const label = prefix ? `${MODULE.NAME} | ${message}` : message;
    if ( notify ) ui.notifications.error(label);
    else console.error(prefix ? `${MODULE.NAME} Error | ${message}` : message);
  }

  /**
   * Log a debug message.
   * @param {string} message
   * @param {*} [data]
   */
  static debug(message, data) {
    try {
      if ( !game.settings?.get(MODULE.ID, CONSTANTS.DEBUG.SETTING.KEY) ) return;
    } catch {
      return;
    }
    if ( !data ) {
      console.log(`${MODULE.NAME} Debug | ${message}`);
      return;
    }
    const dataClone = foundry.utils.deepClone(data);
    console.log(`${MODULE.NAME} Debug | ${message}`, dataClone);
  }
}

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

/**
 * Register a menu.
 * @param {string} key
 * @param {object} options
 */
export function registerMenu(key, options) {
  game.settings.registerMenu(MODULE.ID, key, options);
}

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
  let value = defaultValue ?? null;
  try {
    value = game.settings.get(MODULE.ID, key);
  } catch {
    Logger.debug(`Setting '${key}' not found. Searching world settings storage...`);
    const worldStorage = game.settings.storage.get("world").find(value => value.key === `${MODULE.ID}.${key}`);

    if ( worldStorage !== undefined ) return worldStorage.value;

    Logger.debug(`Setting '${key}' not found. Searching client settings storage...`);

    const clientStorage = game.settings.storage.get("client")[`${MODULE.ID}.${key}`];

    if ( clientStorage !== undefined ) return clientStorage;

    Logger.debug(`Setting '${key}' not found`);
  }
  return value;
}

/* -------------------------------------------- */

/**
 * Set a setting value.
 * @param {string} key
 * @param {*} value
 */
export async function setSetting(key, value) {
  if ( game.settings.settings.has(`${MODULE.ID}.${key}`) ) {
    await game.settings.set(MODULE.ID, key, value);
    Logger.debug(`Setting '${key}' set to '${value}'`);
  } else {
    Logger.debug(`Setting '${key}' not found`);
  }
}

/* -------------------------------------------- */
/*  Documents & Templates                       */
/* -------------------------------------------- */

/**
 * Open a document.
 * @param {string} uuid
 */
export async function openDocument(uuid) {
  if ( !uuid ) return;
  const document = await fromUuid(uuid);
  if ( document instanceof JournalEntryPage ) {
    document.parent.sheet.render(true, {pageId: document.id, anchor: undefined});
  } else {
    document?.sheet?.render(true);
  }
}

/* -------------------------------------------- */

/**
 * Load templates.
 * @param {Array} templates
 */
export async function c5eLoadTemplates(templates) {
  Logger.debug("Loading templates", templates);
  try {
    const result = await foundry.applications.handlebars.loadTemplates(templates);
    Logger.debug("Templates loaded", { templates, result });
  } catch (error) {
    Logger.debug("Failed to load templates", { templates, error });
  }
}

/* -------------------------------------------- */
/*  Dice & Rolls                                */
/* -------------------------------------------- */

/**
 * Get parts of a die string.
 * @param {string} input
 * @returns {object|null}
 */
export function getDieParts(input) {
  const match = input?.match(/\b(\d+)[dD](\d+)\b/);
  return match ? { number: parseInt(match[1], 10), faces: parseInt(match[2], 10) } : null;
}
