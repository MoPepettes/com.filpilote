'use strict';

const QubinoDevice = require('../../lib/QubinoDevice');
const { CAPABILITIES, COMMAND_CLASSES, SETTINGS } = require('../../lib/constants');

/**
 * Flush 1 Relay (ZMNHAA)
 * Manual: http://www.benext.eu/static/manual/qubino/flush-1-relay-ZMNHAA2.pdf
 * TODO: add meter reset maintenance action
 */
class ZMNHAA extends QubinoDevice {
  /**
   * Override allOnAllOff Z-Wave setting size.
   * @returns {number}
   */
  static get allOnAllOffSize() {
    return 1;
  }

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
   * Override settings migration map
   * @private
   */
  _settingsMigrationMap() {
    const migrationMap = {};
    if (this.getSetting('automatic_turning_off_output_q1_after_set_time') !== null) {
      migrationMap.autoOff = () => this.getSetting('automatic_turning_off_output_q1_after_set_time');
    }
    if (this.getSetting('power_report_on_power_change_q1') !== null) {
      migrationMap.powerReportingThreshold = () => this.getSetting('power_report_on_power_change_q1');
    }
    if (this.getSetting('power_report_by_time_interval_q1') !== null) {
      migrationMap.powerReportingInterval = () => this.getSetting('power_report_by_time_interval_q1');
    }
    return migrationMap;
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

  /**
   * Method that will register custom setting parsers for this device.
   */
  registerSettings() {
    super.registerSettings();
    this.registerSetting(SETTINGS.AUTO_OFF, value => value * 100);
  }
}

module.exports = ZMNHAA;
