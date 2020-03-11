'use strict';

const QubinoDevice = require('../../lib/QubinoDevice');
const { CAPABILITIES, COMMAND_CLASSES } = require('../../lib/constants');

/**
 * Smart Meter (ZMNHTD)
 * Manual: https://qubino.com/manuals/Smart_Meter.pdf
 * TODO: maintenance action for reset meter
 */
class ZMNHTD extends QubinoDevice {
  /**
   * Method that registers custom setting parsers.
   */
  registerSettings() {
    super.registerSettings();
  }

  /**
   * Override settings migration map
   * @private
   */
  _settingsMigrationMap() {
    const migrationMap = {};
    if (this.getSetting('automatic_turning_off_ir_output_after_set_time') !== null) {
      migrationMap.autoOffQ1 = () => this.getSetting('automatic_turning_off_ir_output_after_set_time');
    }
    if (this.getSetting('automatic_turning_on_ir_output_after_set_time') !== null) {
      migrationMap.autoOnQ1 = () => this.getSetting('automatic_turning_on_ir_output_after_set_time');
    }
    if (this.getSetting('automatic_turning_off_relay_output_after_set_time') !== null) {
      migrationMap.autoOffQ2 = () => this.getSetting('automatic_turning_off_relay_output_after_set_time');
    }
    if (this.getSetting('automatic_turning_on_relay_output_after_set_time') !== null) {
      migrationMap.autoOnQ2 = () => this.getSetting('automatic_turning_on_relay_output_after_set_time');
    }
    if (this.getSetting('enable_disable_endpoints') !== null) {
      migrationMap.enableInput1 = () => this.getSetting('enable_disable_endpoints');
    }
    return migrationMap;
  }

  /**
   * Method that handles migration of capabilities.
   * @returns {Promise<void>}
   */
  async migrateCapabilities() {
    await super.migrateCapabilities();

    if (this.hasCapability(CAPABILITIES.ONOFF)) {
      this.removeCapability(CAPABILITIES.ONOFF).catch(err => this.error(`Error removing ${CAPABILITIES.ONOFF} capability`, err));
      this.log('removed capability', CAPABILITIES.ONOFF);
    }
    if (this.hasCapability(CAPABILITIES.METER_POWER)) {
      this.removeCapability(CAPABILITIES.METER_POWER).catch(err => this.error(`Error removing ${CAPABILITIES.METER_POWER} capability`, err));
      this.log('removed capability', CAPABILITIES.METER_POWER);
    }

    // Loop all current capabilities and add if necessary
    const currentCapabilities = [
      CAPABILITIES.MEASURE_VOLTAGE,
      CAPABILITIES.MEASURE_CURRENT,
      CAPABILITIES.METER_POWER_IMPORT,
      CAPABILITIES.METER_POWER_EXPORT,
      CAPABILITIES.POWER_REACTIVE,
      CAPABILITIES.POWER_TOTAL_REACTIVE,
      CAPABILITIES.POWER_TOTAL_APPARENT,
      CAPABILITIES.POWER_FACTOR,
    ];
    for (const i in currentCapabilities) {
      const currentCapability = currentCapabilities[i];
      if (!this.hasCapability(currentCapability)) {
        await this.addCapability(currentCapability).catch(err => this.error(`Error adding ${currentCapability} capability`, err));
      }
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
    this.registerCapability(CAPABILITIES.MEASURE_VOLTAGE, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.MEASURE_CURRENT, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.MEASURE_POWER, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.METER_POWER_IMPORT, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.METER_POWER_EXPORT, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.POWER_REACTIVE, COMMAND_CLASSES.METER); // TODO: validate this is in kVar
    this.registerCapability(CAPABILITIES.POWER_TOTAL_REACTIVE, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.POWER_TOTAL_APPARENT, COMMAND_CLASSES.METER);
    this.registerCapability(CAPABILITIES.POWER_FACTOR, COMMAND_CLASSES.METER);
  }
}

module.exports = ZMNHTD;
