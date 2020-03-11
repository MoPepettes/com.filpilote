'use strict';

const QubinoDimDevice = require('../../lib/QubinoDimDevice');
const { CAPABILITIES, COMMAND_CLASSES } = require('../../lib/constants');

/**
 * Flush Dimmer (ZMNHDD)
 * Manual: https://qubino.com/manuals/Flush_Dimmer.pdf
 */
class ZMNHDD extends QubinoDimDevice {
  /**
   * Expose input configuration, two possible inputs (input 2 and input 3).
   * @returns {*[]}
   */
  get inputConfiguration() {
    return [
      {
        INPUT_ID: 2,
        PARAMETER_INDEX: 100,
        FLOW_TRIGGERS: {
          ON: 'I2_on',
          OFF: 'I2_off',
          TOGGLE: 'inputTwoToggled',
        },
      },
      {
        INPUT_ID: 3,
        PARAMETER_INDEX: 101,
        FLOW_TRIGGERS: {
          ON: 'I3_on',
          OFF: 'I3_off',
          TOGGLE: 'inputThreeToggled',
        },
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
    this.registerCapability(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL);
    this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_BINARY);
  }
}

module.exports = ZMNHDD;
