'use strict';

const { Util } = require('homey-meshdriver');

const QubinoDimDevice = require('../../lib/QubinoDimDevice');
const { CAPABILITIES, COMMAND_CLASSES, SETTINGS } = require('../../lib/constants');

/**
 * Mini Dimmer (ZMNHHD)
 * TODO: add configuration actions for calibration (par 71, par 72 is calibration result) and meter reset
 * Extended manual: https://qubino.com/manuals/Mini_Dimmer_V3.4.pdf
 */
class ZMNHHD extends QubinoDimDevice {

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
    this.registerCapability(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL);
    this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_BINARY);
  }

  /**
   * Method that handles the parsing of many shared settings.
   */
  registerSettings() {
    super.registerSettings();

    // Override QubinoDimDevice setting handler
    this.registerSetting(SETTINGS.DIM_DURATION, value => value);

    // Conversion method expects value in milliseconds, spits out 0-127 in sec 128-253 in minutes
    this.registerSetting(SETTINGS.DIM_DURATION_KEY_PRESSED, value => Util.calculateZwaveDimDuration(value * 1000, { maxValue: 253 }));
  }
}

module.exports = ZMNHHD;
