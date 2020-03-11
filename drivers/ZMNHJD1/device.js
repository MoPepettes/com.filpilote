'use strict';

const QubinoDimDevice = require('../../lib/QubinoDimDevice');
const { CAPABILITIES, COMMAND_CLASSES } = require('../../lib/constants');

/**
 * Flush Dimmer (ZMNHDD)
 * Manual: https://qubino.com/manuals/Flush_Dimmer.pdf
 */
class ZMNHJD extends QubinoDimDevice {
 
  /**
   * Method that will register capabilities of the device based on its configuration.
   * @private
   */
  async registerCapabilities() {    
    
    this.registerCapability(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL);
    this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_BINARY);
  }
}

module.exports = ZMNHJD;
