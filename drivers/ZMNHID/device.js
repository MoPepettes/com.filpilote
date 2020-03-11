'use strict';

const QubinoThermostatDevice = require('../../lib/QubinoThermostatDevice');
const {
  CAPABILITIES, COMMAND_CLASSES, FLOWS, DEVICE_CLASS_GENERIC, SETTINGS,
} = require('../../lib/constants');

/**
 * Flush On/Off Thermostat (ZMNHID)
 * Manual: https://qubino.com/manuals/Flush_On%20Off_Thermostat.pdf
 * Note: this device sends ALARM_REPORTS but does not advertise this as a support command class in its NIF.
 * Therefore, the settings enableInput1/enableInput2/enableInput3 can only accept value 9 SENSOR_BINARY_REPORT.
 *
 * Note 2: this device sends ALARM_REPORTS but does not advertise this as a support command class in its NIF.
 * Therefore, the status of the thermostat mode can not be updated when switched manually.
 */
class ZMNHID extends QubinoThermostatDevice {
  /**
   * Expose input configuration, three possible inputs (input 1, input 2 and input 3).
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
      {
        INPUT_ID: 3,
        PARAMETER_INDEX: 102,
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
   * Method that will register capabilities of the device based on its configuration.
   * @private
   */
  async registerCapabilities() {
    if (!this.hasCapability(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION)) {
      await this.addCapability(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION).catch(err => this.error(`Error adding ${CAPABILITIES.METER_RESET_MAINTENANCE_ACTION} capability`, err));
      this.log('added capability', CAPABILITIES.METER_RESET_MAINTENANCE_ACTION);
    }

    const THERMOSTAT_MODE = await this._getThermostatModeSetting();
    this.log(`found thermostatMode: ${THERMOSTAT_MODE}`);

    // Used by thermostatSetpoint command class
    this.thermostatSetpointType = `${THERMOSTAT_MODE}ing 1`;
    this.log(`determined thermostatSetpointType: ${this.thermostatSetpointType}`);

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
          Mode: (mode === 'off') ? 'Off' : THERMOSTAT_MODE,
        },
      }),
      report: 'THERMOSTAT_MODE_REPORT',
      reportParser: report => {
        if (report && Object.prototype.hasOwnProperty.call(report, 'Level')
          && Object.prototype.hasOwnProperty.call(report.Level, 'Mode')
          && typeof report.Level.Mode !== 'undefined') {
          if (report.Level.Mode.toLowerCase() === 'heat' || report.Level.Mode.toLowerCase() === 'cool') {
            // Update the thermostatMode since it may be overriden by input 3
            this.setSettings({ [SETTINGS.THERMOSTAT_MODE]: report.Level.Mode === 'Heat' ? '0' : '1' });
            this.setStoreValue('thermostatMode', report.Level.Mode);

            // Trigger flow
            const newCapabilityValue = 'auto';
            if (typeof preReportValue !== 'undefined' && preReportValue !== null && preReportValue !== newCapabilityValue) {
              this.driver.triggerFlow(FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED, this, {}, { mode: newCapabilityValue }).catch(err => this.error('failed to trigger flow', FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED, err));
            }
            preReportValue = newCapabilityValue;
            return newCapabilityValue;
          }

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
   * Method that fetches the thermostat mode setting which is needed to determine if dimming is enabled or not.
   * @returns {Promise<*>}
   * @private
   */
  async _getThermostatModeSetting() {
    if (typeof this.getStoreValue('thermostatMode') !== 'string') {
      const thermostatMode = await this.safeConfigurationGet(59);
      if (thermostatMode && Object.prototype.hasOwnProperty.call(thermostatMode, 'Configuration Value')) {
        const result = thermostatMode['Configuration Value'][0] ? 'Cool' : 'Heat';
        this.setSettings({ [SETTINGS.THERMOSTAT_MODE]: result === 'Heat' ? '0' : '1' });
        this.setStoreValue('thermostatMode', result);
        return result;
      }
      return null;
    }
    return this.getStoreValue('thermostatMode');
  }
}

module.exports = ZMNHID;
