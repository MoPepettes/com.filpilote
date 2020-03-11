'use strict';

const { Util } = require('homey-meshdriver');

const QubinoThermostatDevice = require('../../lib/QubinoThermostatDevice');
const {
  CAPABILITIES, SETTINGS, COMMAND_CLASSES, FLOWS,
} = require('../../lib/constants');

/**
 * Flush On/Off Thermostat (ZMNHIA)
 */
class ZMNHIA extends QubinoThermostatDevice {
  /**
   * Override allOnAllOff Z-Wave setting size.
   * @returns {number}
   */
  static get allOnAllOffSize() {
    return 1;
  }

  /**
   * Override default multi channel configuration.
   * @returns {boolean}
   */
  get multiChannelConfigurationDisabled() {
    return true;
  }

  /**
   * Expose input configuration, two possible inputs (input 1 and input 2).
   * @returns {*[]}
   */
  get inputConfiguration() {
    return [
      {
        INPUT_ID: 2,
        DEFAULT_ENABLED: true,
      },
      {
        INPUT_ID: 3,
        DEFAULT_ENABLED: true,
      },
    ];
  }

  /**
   * Override settings migration map
   * @private
   */
  _settingsMigrationMap() {
    const migrationMap = {};

    if (this.getSetting(SETTINGS.SETPOINT_INPUT_2_ENABLED) !== null) {
      migrationMap.setpointInput2Enabled = () => {
        const currentValue = this.getSetting('input_2_set_point');
        if (currentValue !== 65535) return true;
        return false;
      };
    }
    if (this.getSetting('input_2_set_point') !== null) {
      migrationMap.setpointInput2 = () => {
        const currentValue = this.getSetting('input_2_set_point');
        if (currentValue === 65535) return 20;
        if (currentValue <= 990) {
          return currentValue / 10;
        }
        if (currentValue >= 1001) {
          return Util.mapValueRange(1001, 1150, 0.1, 15.0, currentValue) * -1;
        }
      };
    }
    if (this.getSetting(SETTINGS.SETPOINT_INPUT_3_ENABLED) !== null) {
      migrationMap.setpointInput3Enabled = () => {
        const currentValue = this.getSetting('input_3_set_point');
        if (currentValue !== 65535) return true;
        return false;
      };
    }
    if (this.getSetting('input_3_set_point') !== null) {
      migrationMap.setpointInput3 = () => {
        const currentValue = this.getSetting('input_3_set_point');
        if (currentValue === 65535) return 20;
        if (currentValue <= 990) {
          return currentValue / 10;
        }
        if (currentValue >= 1001) {
          return Util.mapValueRange(1001, 1150, 0.1, 15.0, currentValue) * -1;
        }
      };
    }
    if (this.getSetting('power_report_by_time_interval') !== null) {
      migrationMap.powerReportingInterval = () => this.getSetting('power_report_by_time_interval');
    }
    if (this.getSetting('temperature_hysteresis_on') !== null) {
      migrationMap.temperatureHysteresisOn = () => {
        const currentValue = this.getSetting('temperature_hysteresis_on');
        if (currentValue >= 128) return Util.mapValueRange(128, 255, 0.1, 12.7, currentValue) * -1;
        return currentValue / 10;
      };
    }
    if (this.getSetting('temperature_hysteresis_off') !== null) {
      migrationMap.temperatureHysteresisOff = () => {
        const currentValue = this.getSetting('temperature_hysteresis_off');
        if (currentValue >= 128) return Util.mapValueRange(128, 255, 0.1, 12.7, currentValue) * -1;
        return currentValue / 10;
      };
    }
    if (this.getSetting(SETTINGS.ANTIFREEZE_ENABLED) !== null) {
      migrationMap.antifreezeEnabled = () => {
        const currentValue = this.getSetting('antifreeze');
        if (currentValue !== 255) return true;
        return false;
      };
    }
    if (this.getSetting('antifreeze') !== null) {
      migrationMap.antifreeze = () => {
        const currentValue = this.getSetting('antifreeze');
        if (currentValue === 255) return 0;
        if (currentValue >= 128) return Util.mapValueRange(128, 254, 0.1, 12.6, currentValue) * -1;
        return currentValue / 10;
      };
    }
    if (this.getSetting('too_low_temperature_limit')) {
      migrationMap.tooLowTemperatureLimit = () => {
        return this.getSetting('too_low_temperature_limit') / 10;
      };
    }
    if (this.getSetting('too_high_temperature_limit')) {
      migrationMap.tooHighTemperatureLimit = () => {
        return this.getSetting('too_high_temperature_limit') / 10;
      };
    }
    if (this.getSetting('output_switch_selection') !== null) {
      migrationMap.relayType = () => this.getSetting('output_switch_selection');
    }
    return migrationMap;
  }

  /**
   * Method that handles migration of capabilities.
   * @returns {Promise<void>}
   */
  async migrateCapabilities() {
    await super.migrateCapabilities();

    if (this.hasCapability(CAPABILITIES.CUSTOM_THERMOSTAT_MODE)) {
      await this.removeCapability(CAPABILITIES.CUSTOM_THERMOSTAT_MODE).catch(err => this.error(`Error removing ${CAPABILITIES.CUSTOM_THERMOSTAT_MODE} capability`, err));
      this.log('added capability', CAPABILITIES.CUSTOM_THERMOSTAT_MODE);
    }
    if (!this.hasCapability(CAPABILITIES.METER_POWER)) {
      await this.addCapability(CAPABILITIES.METER_POWER).catch(err => this.error(`Error adding ${CAPABILITIES.METER_POWER} capability`, err));
      this.log('added capability', CAPABILITIES.METER_POWER);
    }
    if (!this.hasCapability(CAPABILITIES.MEASURE_POWER)) {
      await this.addCapability(CAPABILITIES.MEASURE_POWER).catch(err => this.error(`Error adding ${CAPABILITIES.MEASURE_POWER} capability`, err));
      this.log('added capability', CAPABILITIES.MEASURE_POWER);
    }
    if (!this.hasCapability(CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE)) {
      await this.addCapability(CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE).catch(err => this.error(`Error adding ${CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE} capability`, err));
      this.log('added capability', CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE);
    }
  }

  /**
   * Override onSettings to handle combined z-wave settings.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {Promise<T>}
   */
  async onSettings(oldSettings, newSettings, changedKeysArr) {
    // If enabled/disabled
    if (changedKeysArr.includes(SETTINGS.SETPOINT_INPUT_2_ENABLED)) {
      let setpointInput2Value = 65535;
      if (newSettings[SETTINGS.SETPOINT_INPUT_2_ENABLED]) {
        // Get value from newSettings if possible, else use stored setting value
        setpointInput2Value = Object.prototype.hasOwnProperty.call(newSettings, SETTINGS.SETPOINT_INPUT_2) ? newSettings[SETTINGS.SETPOINT_INPUT_2] : oldSettings[SETTINGS.SETPOINT_INPUT_2];
      }

      if (!(SETTINGS.SETPOINT_INPUT_2 in changedKeysArr)) changedKeysArr.push(SETTINGS.SETPOINT_INPUT_2);
      newSettings[SETTINGS.SETPOINT_INPUT_2] = setpointInput2Value;
    }

    // If enabled/disabled
    if (changedKeysArr.includes(SETTINGS.SETPOINT_INPUT_3_ENABLED)) {
      let setpointInput3Value = 65535;
      if (newSettings[SETTINGS.SETPOINT_INPUT_3_ENABLED]) {
        // Get value from newSettings if possible, else use stored setting value
        setpointInput3Value = Object.prototype.hasOwnProperty.call(newSettings, SETTINGS.SETPOINT_INPUT_3) ? newSettings[SETTINGS.SETPOINT_INPUT_3] : oldSettings[SETTINGS.SETPOINT_INPUT_3];
      }

      if (!(SETTINGS.SETPOINT_INPUT_3 in changedKeysArr)) changedKeysArr.push(SETTINGS.SETPOINT_INPUT_3);
      newSettings[SETTINGS.SETPOINT_INPUT_3] = setpointInput3Value;
    }

    return super.onSettings(oldSettings, newSettings, changedKeysArr);
  }

  /**
   * Method that registers custom setting parsers.
   */
  registerSettings() {
    super.registerSettings();

    this.registerSetting(SETTINGS.SETPOINT_INPUT_2, value => {
      if (!value || value === 65535) return value;
      if (value >= 0) return value * 10;
      return 1000 + Math.abs(value * 10);
    });

    this.registerSetting(SETTINGS.TEMPERATURE_HYSTERESIS_ON, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.7, 128, 255, value);
    });

    this.registerSetting(SETTINGS.TEMPERATURE_HYSTERESIS_ON, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.7, 128, 255, value);
    });

    this.registerSetting(SETTINGS.ANTIFREEZE, value => {
      if (!value || value === 255) return value;
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.6, 128, 254, value);
    });

    this.registerSetting(SETTINGS.TOO_LOW_TEMPERATURE_LIMIT, value => value * 10);
  }

  /**
   * Method that will register capabilities of the device based on its configuration.
   * @private
   */
  async registerCapabilities() {
    if (!this.hasCapability(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION)) {
      await this.addCapability(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION).catch(err => this.error(`Error adding ${CAPABILITIES.METER_RESET_MAINTENANCE_ACTION} capability`, err));
      this.log('added capability', CAPABILITIES.METER_RESET_MAINTENANCE_ACTION);
    }
    
    this.registerCapability(CAPABILITIES.METER_POWER, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.MEASURE_POWER, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.TARGET_TEMPERATURE, COMMAND_CLASSES.THERMOSTAT_SETPOINT);

    let preReportValue = this.getCapabilityValue(CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE);
    this.registerCapability(CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE, COMMAND_CLASSES.THERMOSTAT_MODE, {
      get: 'THERMOSTAT_MODE_GET',
      getOpts: {
        getOnStart: true,
      },
      set: 'THERMOSTAT_MODE_SET',
      setParser: mode => ({
        Level: {
          Mode: (mode === 'off') ? 'Off' : 'Auto',
        },
      }),
      report: 'THERMOSTAT_MODE_REPORT',
      reportParser: report => {
        if (report && Object.prototype.hasOwnProperty.call(report, 'Level')
          && Object.prototype.hasOwnProperty.call(report.Level, 'Mode')
          && typeof report.Level.Mode !== 'undefined') {
          // Trigger flow and check if value actually changed
          const newCapabilityValue = report.Level.Mode.toLowerCase();
          if (typeof preReportValue !== 'undefined' && preReportValue !== null && preReportValue !== newCapabilityValue) {
            this.driver.triggerFlow(FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED, this, {}, { mode: newCapabilityValue }).catch(err => this.error('failed to trigger flow', FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED, err));
          }

          // Update pre report value
          preReportValue = newCapabilityValue;

          return newCapabilityValue;
        }
        return null;
      },
    });
  }
}

module.exports = ZMNHIA;
