'use strict';

const QubinoDevice = require('../../lib/QubinoDevice');
const { CAPABILITIES, COMMAND_CLASSES } = require('../../lib/constants');

/**
 * Flush 1 Relay (ZMNHAD)
 * Extended manual: https://qubino.com/manuals/Flush_1_Relay.pdf
 */
class ZMNHAD extends QubinoDevice {
  /**
   * Expose input configuration, two possible inputs (input 2 and input 3).
   * @returns {*[]}
   */
  get inputConfiguration() {
    return [
      {
        INPUT_ID: 2,
        PARAMETER_INDEX: 100,
      },
      {
        INPUT_ID: 3,
        PARAMETER_INDEX: 101,
      },
    ];
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
    this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_BINARY);
  }
}

module.exports = ZMNHAD;
