'use strict';

const QubinoDimDevice = require('../../lib/QubinoDimDevice');
const { CAPABILITIES, COMMAND_CLASSES } = require('../../lib/constants');

/**
 * Flush Dimmer 0 - 10V (ZMNHVD)
 * Manual: https://qubino.com/manuals/Flush_Dimmer_0-10V.pdf
 * TODO: switching input 1 does not have any effect
 * TODO: add support for analogue sensor connected to input 1
 */
class ZMNHVD extends QubinoDimDevice {
  /**
   * Override default multi channel configuration.
   * @returns {boolean}
   */
  get multiChannelConfigurationDisabled() {
    return true;
  }

  /**
   * Method that will register capabilities of the device based on its configuration.
   * @private
   */
  registerCapabilities() {
    this.registerCapability(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL);
    this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_BINARY);

    // Hacky fix, this device reports SENSOR_MULTILEVEL_REPORTS on the root node even though the second multi channel node is the GENERIC_TYPE_SENSOR_MULTILEVEL
    if (this.hasCommandClass(COMMAND_CLASSES.SENSOR_MULTILEVEL)) {
      this.registerReportListener(COMMAND_CLASSES.SENSOR_MULTILEVEL, COMMAND_CLASSES.SENSOR_MULTILEVEL_REPORT, report => {
        if (report &&
          report.hasOwnProperty('Sensor Type') &&
          report['Sensor Type'] === 'Temperature (version 1)' &&
          report.hasOwnProperty('Sensor Value (Parsed)') &&
          report.hasOwnProperty('Level') &&
          report.Level.hasOwnProperty('Scale')) {

          // Some devices send this when no temperature sensor is connected
          if (report['Sensor Value (Parsed)'] === -999.9) return null;
          if (report.Level.Scale === 0) return this.setCapabilityValue(CAPABILITIES.MEASURE_TEMPERATURE, report['Sensor Value (Parsed)'])
          if (report.Level.Scale === 1) return this.setCapabilityValue(CAPABILITIES.MEASURE_TEMPERATURE, (report['Sensor Value (Parsed)'] - 32) / 1.8)
        }
        return null;
      })
    }
  }
}

module.exports = ZMNHVD;
