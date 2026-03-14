export const MODULE = {
  ID: "custom-rolls",
  NAME: "Custom Rolls"
};

export const CONSTANTS = {
  DEBUG: {
    SETTING: {
      KEY: "debug"
    }
  },
  ROLLS: {
    ID: "rolls",
    MENU: {
      KEY: "rolls-menu",
      HINT: "CUSTOM_ROLLS.menu.rolls.hint",
      ICON: "fas fa-dice-d20",
      LABEL: "CUSTOM_ROLLS.menu.rolls.label",
      NAME: "CUSTOM_ROLLS.menu.rolls.name"
    },
    SETTING: {
      ROLLS: {
        KEY: "rolls"
      }
    },
    TEMPLATE: {
      FORM: "modules/custom-rolls/templates/rolls-form.hbs"
    },
    UUID: null
  }
};

export const JOURNAL_HELP_BUTTON = {
  icon: "fa-regular fa-circle-info",
  tooltip: "CUSTOM_ROLLS.openGuide",
  action: "help",
  uuid: null
};
