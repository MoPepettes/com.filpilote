'use strict';

const QubinoDimDevice = require('../../lib/QubinoDimDevice');
const { CAPABILITIES, COMMAND_CLASSES } = require('../../lib/constants');

const CACHED_DIM_VALUE_STORE_KEY = 'cachedDimValue';

/**
 * Flush Dimmer (ZMNHDA)
 * Manual: https://smart-telematik.se/dokument/qubino-flush-dimmer.pdf
 */
class ZMNHDA extends QubinoDimDevice {
  /**
   * Override default multi channel configuration.
   * @returns {boolean}
   */
  get multiChannelConfigurationDisabled() {
    return true;
  }

  /**
   * Expose input configuration, two possible inputs (input 2 and input 3).
   * @returns {*[]}
   */
  get inputConfiguration() {
    return [
      {
        INPUT_ID: 2,
        DEFAULT_ENABLED: true,
        FLOW_TRIGGERS: {
          ON: 'I2_on',
          OFF: 'I2_off',
          TOGGLE: 'inputTwoToggled',
        },
      },
      {
        INPUT_ID: 3,
        DEFAULT_ENABLED: true,
        FLOW_TRIGGERS: {
          ON: 'I3_on',
          OFF: 'I3_off',
          TOGGLE: 'inputThreeToggled',
        },
      },
    ];
  }

  /**
   * Method that handles migration of capabilities.
   * @returns {Promise<void>}
   */
  async migrateCapabilities() {
    await super.migrateCapabilities();

    if (this.hasCapability(CAPABILITIES.ALARM_CONTACT)) {
      await this.removeCapability(CAPABILITIES.ALARM_CONTACT).catch(err => this.error(`Error removing ${CAPABILITIES.ALARM_CONTACT} capability`, err));
      this.log('removed capability', CAPABILITIES.ALARM_CONTACT);
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
    this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_BINARY, {
      setParserV1: value => { // Custom parser that caches and updates dim value since device does report it itself
        const currentDimValue = this.getCapabilityValue(CAPABILITIES.DIM);
        if (currentDimValue > 0) {
          this.setStoreValue(CACHED_DIM_VALUE_STORE_KEY, currentDimValue).catch(this.error.bind(this));
        }
        if (!value) {
          this.setCapabilityValue(CAPABILITIES.DIM, 0).catch(this.error.bind(this));
        } else {
          const cachedDimValue = this.getStoreValue(CACHED_DIM_VALUE_STORE_KEY);
          this.setCapabilityValue(CAPABILITIES.DIM, cachedDimValue).catch(this.error.bind(this));
        }
        return {
          'Switch Value': (value) ? 'on/enable' : 'off/disable',
        };
      },
    });
    this.registerCapability(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL, {
      reportParserV1: report => { // Custom parser that caches dim value since device does not report it itself
        if (report && Object.prototype.hasOwnProperty.call(report, 'Value (Raw)')) {
          if (this.hasCapability(CAPABILITIES.ONOFF)) this.setCapabilityValue(CAPABILITIES.ONOFF, report['Value (Raw)'][0] > 0);
          if (report['Value (Raw)'][0] === 255) {
            this.setStoreValue(CACHED_DIM_VALUE_STORE_KEY, 1).catch(this.error.bind(this));
            return 1;
          }
          const returnValue = report['Value (Raw)'][0] / 99;
          this.setStoreValue(CACHED_DIM_VALUE_STORE_KEY, returnValue).catch(this.error.bind(this));
          return returnValue;
        }
        return null;
      },
    });
  }
}

module.exports = ZMNHDA;
