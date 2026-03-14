import { CONSTANTS, MODULE } from "./constants.js";
import { registerSetting } from "./utils.js";
import { register as registerRolls } from "./rolls.js";
import { patchD20Die } from "./patches/d20-die.js";
import { patchD20Roll } from "./patches/d20-roll.js";

/**
 * Initialize the module and register settings, hooks, and templates.
 */
Hooks.on("init", async () => {
  registerSetting(
    CONSTANTS.DEBUG.SETTING.KEY,
    {
      scope: "world",
      config: false,
      type: Boolean,
      default: false
    }
  );

  patchD20Die();
  patchD20Roll();

  registerRolls();
});
