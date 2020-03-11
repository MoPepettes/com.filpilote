'use strict';

const QubinoDevice = require('../../lib/QubinoDevice');
const { CAPABILITIES, COMMAND_CLASSES } = require('../../lib/constants');

/**
 * Flush 2 Relay (ZMNHBD)
 * Manual: https://qubino.com/manuals/Flush_2_Relay.pdf
 * TODO: add maintenance action for meter reset (both endpoints)
 */
class ZMNHBD extends QubinoDevice {
  async onMeshInit() {
    await super.onMeshInit();
    if (!this._isRootNode()) {
      // Listen for reset_meter maintenance action
      // Override capability listener from QubinoDevice
      this.registerCapabilityListener(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION, async () => {
        // Maintenance action button was pressed, return a promise
        if (typeof this.resetMeter === 'function') return this.resetMeter({ multiChannelNodeId: this.node.multiChannelNodeId});
        this.error('Reset meter failed');
        throw new Error('Reset meter not supported');
      });
    }
  }
  /**
   * Override settings migration map
   * @private
   */
  _settingsMigrationMap() {
    const migrationMap = {};
    if (this.getSetting('automatic_turning_off_output_q1_after_set_time') !== null) {
      migrationMap.autoOffQ1 = () => this.getSetting('automatic_turning_off_output_q1_after_set_time');
    }
    if (this.getSetting('automatic_turning_off_output_q2_after_set_time') !== null) {
      migrationMap.autoOffQ2 = () => this.getSetting('automatic_turning_off_output_q2_after_set_time');
    }
    if (this.getSetting('automatic_turning_on_output_q1_after_set_time') !== null) {
      migrationMap.autoOnQ1 = () => this.getSetting('automatic_turning_on_output_q1_after_set_time');
    }
    if (this.getSetting('automatic_turning_on_output_q2_after_set_time') !== null) {
      migrationMap.autoOnQ2 = () => this.getSetting('automatic_turning_on_output_q2_after_set_time');
    }
    if (this.getSetting('power_report_on_power_change_q1') !== null) {
      migrationMap.powerReportingThresholdQ1 = () => this.getSetting('power_report_on_power_change_q1');
    }
    if (this.getSetting('power_report_on_power_change_q2') !== null) {
      migrationMap.powerReportingThresholdQ2 = () => this.getSetting('power_report_on_power_change_q2');
    }
    if (this.getSetting('power_report_by_time_interval_q1') !== null) {
      migrationMap.powerReportingIntervalQ1 = () => this.getSetting('power_report_by_time_interval_q1');
    }
    if (this.getSetting('power_report_by_time_interval_q2') !== null) {
      migrationMap.powerReportingIntervalQ2 = () => this.getSetting('power_report_by_time_interval_q2');
    }
    if (this.getSetting('output_switch_selection_q1 ') !== null) { // Yes these spaces are needed..
      migrationMap.relayTypeQ1 = () => this.getSetting('output_switch_selection_q1 ');
    }
    if (this.getSetting('output_switch_selection_q2 ') !== null) {
      migrationMap.relayTypeQ2 = () => this.getSetting('output_switch_selection_q2 ');
    }
    return migrationMap;
  }

  /**
   * Method that handles migration of capabilities.
   * @returns {Promise<void>}
   */
  async migrateCapabilities() {
    await super.migrateCapabilities();

    if (!this._isRootNode()) {
      this.log('migrate capabilities for multi channel nodes');
      if (!this.hasCapability(CAPABILITIES.METER_POWER)) {
        await this.addCapability(CAPABILITIES.METER_POWER).catch(err => this.error(`Error adding ${CAPABILITIES.METER_POWER} capability`, err));
        this.log('added capability', CAPABILITIES.METER_POWER);
      }
      if (!this.hasCapability(CAPABILITIES.MEASURE_POWER)) {
        await this.addCapability(CAPABILITIES.MEASURE_POWER).catch(err => this.error(`Error adding ${CAPABILITIES.MEASURE_POWER} capability`, err));
        this.log('added capability', CAPABILITIES.MEASURE_POWER);
      }
    } else {
      this.log('migrate capabilities for root nodes');
      if (this.hasCapability(CAPABILITIES.ONOFF)) { // note: this breaks flows for users
        await this.removeCapability(CAPABILITIES.ONOFF).catch(err => this.error(`Error removing ${CAPABILITIES.ONOFF} capability`, err));
        this.log('removed capability', CAPABILITIES.ONOFF);
      }
      if (this.hasCapability(CAPABILITIES.METER_POWER)) { // note: this breaks flows for users
        await this.removeCapability(CAPABILITIES.METER_POWER).catch(err => this.error(`Error removing ${CAPABILITIES.METER_POWER} capability`, err));
        this.log('removed capability', CAPABILITIES.METER_POWER);
      }
      if (this.hasCapability(CAPABILITIES.MEASURE_POWER)) { // note: this breaks flows for users
        await this.removeCapability(CAPABILITIES.MEASURE_POWER).catch(err => this.error(`Error removing ${CAPABILITIES.MEASURE_POWER} capability`, err));
        this.log('removed capability', CAPABILITIES.MEASURE_POWER);
      }
      if (!this.hasCapability(CAPABILITIES.ALL_ON)) {
        await this.addCapability(CAPABILITIES.ALL_ON).catch(err => this.error(`Error adding ${CAPABILITIES.ALL_ON} capability`, err));
        this.log('added capability', CAPABILITIES.ALL_ON);
      }
      if (!this.hasCapability(CAPABILITIES.ALL_OFF)) {
        await this.addCapability(CAPABILITIES.ALL_OFF).catch(err => this.error(`Error adding ${CAPABILITIES.ALL_OFF} capability`, err));
        this.log('added capability', CAPABILITIES.ALL_OFF);
      }
    }
  }

  /**
   * Method that will register capabilities of the device based on its configuration.
   * @private
   */
  async registerCapabilities() {
    if (!this._isRootNode() && !this.hasCapability(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION)) {
      await this.addCapability(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION).catch(err => this.error(`Error adding ${CAPABILITIES.METER_RESET_MAINTENANCE_ACTION} capability`, err));
      this.log('added capability', CAPABILITIES.METER_RESET_MAINTENANCE_ACTION);
    }

    if (this.hasCapability(CAPABILITIES.ALL_ON)) this.registerCapabilityListener(CAPABILITIES.ALL_ON, this.turnAllOn.bind(this));
    if (this.hasCapability(CAPABILITIES.ALL_OFF)) this.registerCapabilityListener(CAPABILITIES.ALL_OFF, this.turnAllOff.bind(this));
    if (this.hasCapability(CAPABILITIES.METER_POWER)) this.registerCapability(CAPABILITIES.METER_POWER, COMMAND_CLASSES.METER);
    if (this.hasCapability(CAPABILITIES.MEASURE_POWER)) this.registerCapability(CAPABILITIES.MEASURE_POWER, COMMAND_CLASSES.METER);
    if (this.hasCapability(CAPABILITIES.ONOFF)) this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_BINARY);
  }

  /**
   * Method that determines if current node is root node.
   * @returns {boolean}
   * @private
   */
  _isRootNode() {
    return Object.prototype.hasOwnProperty.call(this.node, 'MultiChannelNodes') && Object.keys(this.node.MultiChannelNodes).length > 0;
  }

  /**
   * Method that sends a SWITCH_BINARY command to turn the device on.
   * @returns {Promise<*>}
   */
  async turnAllOn() {
    if (this.hasCommandClass(COMMAND_CLASSES.SWITCH_BINARY)) {
      return this.node.CommandClass[`COMMAND_CLASS_${COMMAND_CLASSES.SWITCH_BINARY}`].SWITCH_BINARY_SET({ 'Switch Value': 'on/enable' });
    }
    throw new Error('device_does_not_support_switch_binary');
  }

  /**
   * Method that sends a SWITCH_BINARY command to turn the device off.
   * @returns {Promise<*>}
   */
  async turnAllOff() {
    if (this.hasCommandClass(COMMAND_CLASSES.SWITCH_BINARY)) {
      return this.node.CommandClass[`COMMAND_CLASS_${COMMAND_CLASSES.SWITCH_BINARY}`].SWITCH_BINARY_SET({ 'Switch Value': 'off/disable' });
    }
    throw new Error('device_does_not_support_switch_binary');
  }
}

module.exports = ZMNHBD;
