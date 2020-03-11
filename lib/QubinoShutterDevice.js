'use strict';

const Homey = require('homey');

const QubinoDevice = require('./QubinoDevice');
const { CAPABILITIES, SETTINGS } = require('./constants');

const CALBRATION_RESET_TIMEOUT = 90000;
const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds))

/**
 * This class extends QubinoDevice and adds some Qubino Shutter device functionality, such as a custom save message
 * which indicates that the device needs to be re-paired after changing it, a calibration method, and a method that
 * handles tilt set commands when they are unsupported.
 */
class QubinoShutterDevice extends QubinoDevice {
  async onMeshInit(){ 
    await super.onMeshInit();

    // Listen for calibration maintenance action
    this.registerCapabilityListener(CAPABILITIES.CALIBRATION_MAINTENANCE_ACTION, this._calibrationHandler.bind(this));
  }

  /**
   * Set calibration configuration parameter 78 to 1 and back to 0 after CALBRATION_RESET_TIMEOUT.
   */
  async _calibrationHandler() {
    this.log('starting calibration...');

    // If calibration is started before it was properly reset
    if (this._calibrationResetTimeout) {
      // Reset calibration process
      await this._resetCalibrationProcess();

      // Short delay to not confuse the device
      await sleep(500);
    }

    // Start calibration
    await this.configurationSet({
      index: 78,
      size: 1
    }, 1);

    // Reset the calibration setting after CALBRATION_RESET_TIMEOUT
    this._calibrationResetTimeout = setTimeout(this._resetCalibrationProcess.bind(this), CALBRATION_RESET_TIMEOUT);
  }

  /**
   * Reset calibration configuration parameter and abort running timeout.
   */
  async _resetCalibrationProcess(){
    this.log('reset calibration process');

    // Clear timeout and reset calibration setting
    clearTimeout(this._calibrationResetTimeout);
    this._calibrationResetTimeout = null;

    // Reset calibration setting
    await this.configurationSet({
      index: 78,
      size: 1
    }, 0);
  }

  /**
   * When venetian blind mode setting was changed notify user of the need to re-pair.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {{en: string, nl: string}}
   */
  customSaveMessage(oldSettings, newSettings, changedKeysArr = []) {
    if (changedKeysArr.includes(SETTINGS.OPERATING_MODE)) {
      return Homey.__('settings.re_pair_required');
    }
    return super.customSaveMessage();
  }

  /**
   * Override onSettings to invert the capability values when the invert settigns are changed.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {Promise<T>}
   */
  async onSettings(oldSettings, newSettings, changedKeysArr) {
    // Check if one of the invert settings changed if so invert the capability value
    if (changedKeysArr.includes(SETTINGS.INVERT_WINDOW_COVERINGS_TILT_DIRECTION)
      && this.hasCapability(CAPABILITIES.WINDOWCOVERINGS_TILT_SET)) {
      this.setCapabilityValue(CAPABILITIES.WINDOWCOVERINGS_TILT_SET, 1 - this.getCapabilityValue(CAPABILITIES.WINDOWCOVERINGS_TILT_SET));
    }
    if (changedKeysArr.includes(SETTINGS.INVERT_WINDOW_COVERINGS_DIRECTION)
      && this.hasCapability(CAPABILITIES.DIM)) {
      this.setCapabilityValue(CAPABILITIES.DIM, 1 - this.getCapabilityValue(CAPABILITIES.DIM));
    }

    return super.onSettings(oldSettings, newSettings, changedKeysArr);
  }

  /**
   * Method that handles the parsing of many shared settings.
   */
  registerSettings() {
    // Multiply motor operation detection by 10
    this.registerSetting(SETTINGS.MOTOR_OPERATION_DETECTION, value => value * 10);

    // Multiply slats tilting time by 100
    this.registerSetting(SETTINGS.SLATS_TILTING_TIME, value => value * 100);

    // Multiply motor moving time by 10
    this.registerSetting(SETTINGS.MOTOR_MOVING_TIME, value => value * 10);

    // Multiply power report delay time by 10
    this.registerSetting(SETTINGS.POWER_REPORT_DELAY_TIME, value => value * 10);

    // Multiply delay between motor movement by 10
    this.registerSetting(SETTINGS.DELAY_BETWEEN_MOTOR_MOVEMENT, value => value * 10);

    // Multiply motor off delay limit switch by 10
    this.registerSetting(SETTINGS.MOTOR_OFF_DELAY_LIMIT_SWITCH, value => value * 10);
  }
}

module.exports = QubinoShutterDevice;
