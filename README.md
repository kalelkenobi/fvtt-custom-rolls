# Custom Rolls

A Foundry VTT module to customise dice rolls for the D&D 5e system.

## Features

### Configure Rolls

Customize the base die for:

- **Ability Checks**
- **Attack Rolls** (with custom critical hit rules)
- **Concentration Saving Throws**
- **Initiative Rolls**
- **Saving Throws**
- **Skill Checks**
- **Tool Checks**

### Alternative Critical Hit Rules (2d10)

When using 2d10 as the attack die, two alternative critical hit rules are available:

- **Equal Dice Results:** A critical hit occurs when both d10s show the same value.
- **Increase Critical Window:** A critical hit occurs when the 2d10 total meets or exceeds a configurable threshold.

### Custom Advantage/Disadvantage for 2d10

When using 2d10 as a custom die, advantage and disadvantage are handled via a +1d6/−1d6 bonus instead of rolling extra dice.

## Required Modules

### [libWrapper](https://foundryvtt.com/packages/lib-wrapper)

LibWrapper is used to patch the following:

- **`CONFIG.Dice.D20Die.prototype.applyAdvantage`**: Replaces roll formula to allow different numbers and faces of dice.
- **`CONFIG.Dice.D20Roll.fromConfig`**: Replaces the d20 die formula with the custom die formula.
- **`CONFIG.Dice.D20Roll.prototype.configureModifiers`**: Adds the custom die formula to the d20 options.
- **`CONFIG.Dice.D20Roll.prototype.validD20Roll`**: Additionally returns true when a custom die exists.

## Installation

1. In Foundry VTT, go to **Add-on Modules** > **Install Module**.
2. Paste the following manifest URL:
   ```
   https://github.com/kalelkenobi/fvtt-custom-rolls/releases/latest/download/module.json
   ```
3. Click **Install**.

## Credits

This module is derived from the **[Custom D&D 5e](https://github.com/Larkinabout/fvtt-custom-dnd5e)** module by **[Larkinabout](https://github.com/Larkinabout)**. The roll configuration feature was extracted and adapted into this standalone module with the original author's work as the foundation. All credit for the original implementation goes to Larkinabout.

## License

This module is provided as-is for use with Foundry VTT.
