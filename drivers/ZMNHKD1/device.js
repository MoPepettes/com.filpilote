'use strict';

const { Util } = require('homey-meshdriver');

const QubinoThermostatDevice = require('../../lib/QubinoThermostatDevice');
const {
  CAPABILITIES, COMMAND_CLASSES, SETTINGS, FLOWS, DEVICE_CLASS_GENERIC,
} = require('../../lib/constants');

/**
 * Flush Heat & Cool Thermostat (ZMNHKD)
 */
class ZMNHKD extends QubinoThermostatDevice {
  /**
   * Expose input configuration, two possible inputs (input 1 and input 2).
   * @returns {*[]}
   */
  get inputConfiguration() {
    return [
      {
        INPUT_ID: 1,
        PARAMETER_INDEX: 100,
      },
      {
        INPUT_ID: 2,
        PARAMETER_INDEX: 101,
      },
    ];
  }

  /**
   * Expose root device class generic.
   * @returns {string}
   */
  get rootDeviceClassGeneric() {
    return DEVICE_CLASS_GENERIC.THERMOSTAT;
  }

  /**
   * Method that handles migration of capabilities.
   * @returns {Promise<void>}
   */
  async migrateCapabilities() {
    await super.migrateCapabilities();

    if (this.hasCapability(CAPABILITIES.CUSTOM_THERMOSTAT_MODE)) {
      await this.removeCapability(CAPABILITIES.CUSTOM_THERMOSTAT_MODE).catch(err => this.error(`Error removing ${CAPABILITIES.CUSTOM_THERMOSTAT_MODE} capability`, err));
      this.log('removed capability', CAPABILITIES.CUSTOM_THERMOSTAT_MODE);
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
        Object.prototype.hasOwnProperty.call(report, 'Level');
        if (report && Object.prototype.hasOwnProperty.call(report, 'Level')
          && Object.prototype.hasOwnProperty.call(report.Level, 'Mode')
          && typeof report.Level.Mode !== 'undefined') {
          // Trigger flow
          const newCapabilityValue = report.Level.Mode.toLowerCase();
          if (typeof preReportValue !== 'undefined' && preReportValue !== null && preReportValue !== newCapabilityValue) {
            this.driver.triggerFlow(FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED, this, {}, { mode: newCapabilityValue }).catch(err => this.error('failed to trigger flow', FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED, err));
          }
          preReportValue = newCapabilityValue;
          return newCapabilityValue;
        }
        return null;
      },
    });
  }

  /**
   * Override settings migration map
   * @private
   */
  _settingsMigrationMap() {
    const migrationMap = {};
    if (this.getSetting('input_1_status_on_delay') !== null) {
      migrationMap.statusOnDelayInput1 = () => this.getSetting('input_1_status_on_delay');
    }
    if (this.getSetting('input_2_status_on_delay') !== null) {
      migrationMap.statusOnDelayInput2 = () => this.getSetting('input_2_status_on_delay');
    }
    if (this.getSetting('input_1_status_off_delay') !== null) {
      migrationMap.statusOffDelayInput1 = () => this.getSetting('input_1_status_off_delay');
    }
    if (this.getSetting('input_2_status_off_delay') !== null) {
      migrationMap.statusOffDelayInput2 = () => this.getSetting('input_2_status_off_delay');
    }
    if (this.getSetting('input_1_functionality_selection') !== null) {
      migrationMap.functionalityInput1 = () => this.getSetting('input_1_functionality_selection');
    }
    if (this.getSetting('input_2_functionality_selection') !== null) {
      migrationMap.functionalityInput2 = () => this.getSetting('input_2_functionality_selection');
    }
    if (this.getSetting('power_report_on_power_change_q1') !== null) {
      migrationMap.powerReportingThreshold = () => this.getSetting('power_report_on_power_change_q1');
    }
    if (this.getSetting('power_report_by_time_interval_q1') !== null) {
      migrationMap.powerReportingInterval = () => this.getSetting('power_report_by_time_interval_q1');
    }
    if (this.getSetting('temperature_hysteresis_heating_on') !== null) {
      migrationMap.temperatureHeatingHysteresisOn = () => this.getSetting('temperature_hysteresis_heating_on') / 10;
    }
    if (this.getSetting('temperature_hysteresis_heating_off') !== null) {
      migrationMap.temperatureHeatingHysteresisOff = () => this.getSetting('temperature_hysteresis_heating_off') / 10;
    }
    if (this.getSetting('temperature_hysteresis_cooling_on') !== null) {
      migrationMap.temperatureCoolingHysteresisOn = () => this.getSetting('temperature_hysteresis_cooling_on') / 10;
    }
    if (this.getSetting('temperature_hysteresis_cooling_off') !== null) {
      migrationMap.temperatureCoolingHysteresisOff = () => this.getSetting('temperature_hysteresis_cooling_off') / 10;
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
        if (currentValue >= 0 && currentValue <= 127) return Util.mapValueRange(0, 127, 0.1, 12.7, currentValue);
        return 0;
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
    if (this.getSetting('output_switch_selection_q1 ') !== null) { // Yes these spaces are needed..
      migrationMap.relayTypeQ1 = () => this.getSetting('output_switch_selection_q1 ');
    }
    if (this.getSetting('output_switch_selection_q2 ') !== null) { // Yes these spaces are needed..
      migrationMap.relayTypeQ2 = () => this.getSetting('output_switch_selection_q2 ');
    }

    return migrationMap;
  }

  /**
   * Method that registers custom setting parsers.
   */
  registerSettings() {
    super.registerSettings();

    this.registerSetting(SETTINGS.TEMPERATURE_HEATING_HYSTERESIS_ON, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.7, 1001, 1127, value); // different; -12.7 - +12.7
    });

    this.registerSetting(SETTINGS.TEMPERATURE_HEATING_HYSTERESIS_OFF, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.7, 1001, 1127, value); // different; -12.7 - +12.7
    });

    this.registerSetting(SETTINGS.TEMPERATURE_COOLING_HYSTERESIS_ON, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.7, 1001, 1127, value); // different; -12.7 - +12.7
    });

    this.registerSetting(SETTINGS.TEMPERATURE_COOLING_HYSTERESIS_OFF, value => {
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.7, 1001, 1127, value); // different; -12.7 - +12.7
    });

    this.registerSetting(SETTINGS.ANTIFREEZE, value => {
      if (!value || value === 255) return value;
      if (value >= 0) return value * 10;
      return Util.mapValueRange(-0.1, -12.6, 1001, 1127, value); // different; to 1127
    });
  }
}

module.exports = ZMNHKD;
