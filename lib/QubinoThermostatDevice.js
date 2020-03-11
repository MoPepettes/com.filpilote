'use strict';

const { Util } = require('homey-meshdriver');

const QubinoDevice = require('./QubinoDevice');
const { CAPABILITIES, COMMAND_CLASSES, SETTINGS } = require('./constants');

const ANTI_FREEZE_DISABLED_VALUE = 255;

/**
 * This class adds basic functionality related Qubino devices supporting dimming (mostly lights), it handles setting
 * min/max dimming values.
 */
class QubinoThermostatDevice extends QubinoDevice {
  /**
   * Override onSettings to handle combined z-wave settings.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {Promise<T>}
   */
  async onSettings(oldSettings, newSettings, changedKeysArr) {

    // If enabled/disabled
    if (changedKeysArr.includes(SETTINGS.ANTIFREEZE_ENABLED)) {
      let antifreezeValue = this.ANTI_FREEZE_DISABLED_VALUE || ANTI_FREEZE_DISABLED_VALUE; // allow device.js override
      if (newSettings[SETTINGS.ANTIFREEZE_ENABLED]) {
        // Get value from newSettings if possible, else use stored setting value
        antifreezeValue = Object.prototype.hasOwnProperty.call(newSettings, SETTINGS.ANTIFREEZE) ? newSettings[SETTINGS.ANTIFREEZE] : oldSettings[SETTINGS.ANTIFREEZE];
      }

      if (!(SETTINGS.ANTIFREEZE in changedKeysArr)) {
        changedKeysArr.push(SETTINGS.ANTIFREEZE);
      }
      newSettings[SETTINGS.ANTIFREEZE] = antifreezeValue;
    }

    // If enabled/disabled
    if (changedKeysArr.includes(SETTINGS.ANTIFREEZE)) {
      let antifreezeEnabledValue = Object.prototype.hasOwnProperty.call(newSettings, SETTINGS.ANTIFREEZE_ENABLED) ? newSettings[SETTINGS.ANTIFREEZE_ENABLED] : oldSettings[SETTINGS.ANTIFREEZE_ENABLED];
      if (!antifreezeEnabledValue) {
        // Get value from newSettings if possible, else use stored setting value
        newSettings[SETTINGS.ANTIFREEZE] = this.ANTI_FREEZE_DISABLED_VALUE || ANTI_FREEZE_DISABLED_VALUE; // allow device.js override
      }
    }

    return super.onSettings(oldSettings, newSettings, changedKeysArr);
  }

  /**
   * Method that registers custom setting parsers.
   */
  registerSettings() {
    super.registerSettings();

    this.registerSetting(SETTINGS.TEMPERATURE_HYSTERESIS_ON, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -25.5, 1001, 1255, value);
    });

    this.registerSetting(SETTINGS.TEMPERATURE_HYSTERESIS_OFF, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -25.5, 1001, 1255, value);
    });

    this.registerSetting(SETTINGS.ANTIFREEZE, value => {
      if (!value
        || value === this.ANTI_FREEZE_DISABLED_VALUE
        || value === ANTI_FREEZE_DISABLED_VALUE) return value;
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.6, 1001, 1126, value);
    });

    this.registerSetting(SETTINGS.TOO_LOW_TEMPERATURE_LIMIT, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -15, 1001, 1150, value);
    });

    this.registerSetting(SETTINGS.TOO_HIGH_TEMPERATURE_LIMIT, value => value * 10);
  }

  /**
   * Wrapper for execute capability set command from Flow card.
   * @param value - mode ['auto'/'off']
   * @returns {Promise<string|*>}
   */
  setThermostatMode(value) {
    return this.executeCapabilitySetCommand(CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE, COMMAND_CLASSES.THERMOSTAT_MODE, value);
  }
}

module.exports = QubinoThermostatDevice;
