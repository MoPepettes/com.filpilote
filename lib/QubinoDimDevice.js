'use strict';

const Homey = require('homey');

const { SETTINGS } = require('./constants');
const QubinoDevice = require('./QubinoDevice');

/**
 * This class adds basic functionality related Qubino devices supporting dimming (mostly lights), it handles setting
 * min/max dimming values.
 */
class QubinoDimDevice extends QubinoDevice {
  /**
   * Override onSettings to check minimum and maximum dim level settings.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {Promise<T>}
   */
  async onSettings(oldSettings, newSettings, changedKeysArr) {
    // Check if one of max/min dim value settings changed
    if (changedKeysArr.includes(SETTINGS.MAXIMUM_DIM_VALUE) || changedKeysArr.includes(SETTINGS.MINIMUM_DIM_VALUE)) {
      const maxDimValue = newSettings[SETTINGS.MAXIMUM_DIM_VALUE] || oldSettings[SETTINGS.MAXIMUM_DIM_VALUE];
      const minDimValue = newSettings[SETTINGS.MINIMUM_DIM_VALUE] || oldSettings[SETTINGS.MINIMUM_DIM_VALUE];

      // Check if max dim level is not less than min dim level else throw error
      if (maxDimValue < minDimValue) {
        return Promise.reject(new Error(Homey.__('error.max_dim_level_cannot_be_lower_than_min_dim_level')));
      }
    }

    return super.onSettings(oldSettings, newSettings, changedKeysArr);
  }

  /**
   * Method that handles the parsing of many shared settings.
   */
  registerSettings() {
    super.registerSettings();

    // Multiply dim duration by 100
    this.registerSetting(SETTINGS.DIM_DURATION, value => value * 100);
  }
}

module.exports = QubinoDimDevice;
