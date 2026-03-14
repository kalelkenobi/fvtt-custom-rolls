import { MODULE } from "../constants.js";
import { Logger, openDocument, setSetting } from "../utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Base class for Custom Rolls forms.
 */
export class CustomRollsForm extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Constructor for CustomRollsForm.
   *
   * @param {object} [options={}] The options for the form.
   */
  constructor(options = {}) {
    super(options);
  }

  /* -------------------------------------------- */

  /**
   * Default options for the form.
   *
   * @type {object}
   */
  static DEFAULT_OPTIONS = {
    actions: {
      reset: CustomRollsForm.reset,
      help: CustomRollsForm.openHelp
    },
    classes: [`${MODULE.ID}-app`, "dnd5e2", "sheet"],
    tag: "form",
    form: {
      submitOnChange: false,
      closeOnSubmit: true
    },
    position: {
      width: 540,
      height: 680
    },
    window: {
      minimizable: true,
      resizable: true
    }
  };

  /* -------------------------------------------- */

  /**
   * Reset the form.
   *
   * @param {Event} event The event that triggered the action.
   * @param {HTMLElement} target The target element.
   */
  static reset(event, target) {}

  /* -------------------------------------------- */

  /**
   * Open the help document.
   *
   * @param {Event} event The event that triggered the action.
   * @param {HTMLElement} target The target element.
   */
  static async openHelp(event, target) {
    const uuid = target.dataset.uuid;
    openDocument(uuid);
  }

  /* -------------------------------------------- */

  /**
   * Handle the rendering of the form.
   *
   * @param {object} context The context for rendering.
   * @param {object} options The options for rendering.
   */
  _onRender(context, options) {
    if ( this.headerButton ) {
      const windowHeader = this.element.querySelector(".window-header");
      const existingButton = windowHeader.querySelector(`[data-action="${this.headerButton.action}"]`);

      if ( !existingButton ) {
        const closeButton = windowHeader.querySelector('[data-action="close"]');
        const button = document.createElement("button");
        button.setAttribute("type", "button");
        button.setAttribute("class", `header-control icon fa-solid ${this.headerButton.icon}`);
        button.setAttribute("data-tooltip", this.headerButton.tooltip);
        button.setAttribute("aria-label", this.headerButton.tooltip);
        button.setAttribute("data-action", this.headerButton.action);
        button.setAttribute("data-uuid", this.headerButton.uuid);
        windowHeader.insertBefore(button, closeButton);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle the form submission.
   *
   * @param {object} processedFormData The processed form data.
   * @param {string} settingKey The setting key.
   * @param {boolean} [requiresReload=false] Whether a reload is required.
   */
  async handleSubmit(processedFormData, settingKey, requiresReload = false) {
    try {
      const settingData = foundry.utils.deepClone(processedFormData);
      await setSetting(settingKey, {});
      await setSetting(settingKey, settingData);

      if ( requiresReload ) {
        foundry.applications.settings.SettingsConfig.reloadConfirm();
      }
    } catch (err) {
      Logger.error(`Failed to save configuration: ${err.message}`, true);
    }

    this.close();
  }
}
