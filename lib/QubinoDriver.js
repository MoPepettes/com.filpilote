'use strict';

const Homey = require('homey');

const { FLOWS, CAPABILITIES, COMMAND_CLASSES } = require('./constants');

/**
 * This class extends Homey Driver and handles the registration and triggering of Flow cards for Qubino devices.
 */
class QubinoDriver extends Homey.Driver {
  /**
   * Method that registers the Flow Cards of a Qubino device.
   */
  onInit() {
    [
      {
        key: FLOWS.RESET_METER,
        fn: this.resetMeterFlowAction,
      },
      {
        key: FLOWS.SET_OFF_AUTO_THERMOSTAT_MODE,
        fn: this.setOffAutoThermostatMode,
      },
    ].forEach(obj => {
      this._registerFlowCardAction(obj.key, obj.fn);
    });

    [
      FLOWS.INPUT_ONE_TOGGLED,
      FLOWS.INPUT_ONE_TURNED_ON,
      FLOWS.INPUT_ONE_TURNED_OFF,
      FLOWS.INPUT_TWO_TOGGLED,
      FLOWS.INPUT_TWO_TURNED_ON,
      FLOWS.INPUT_TWO_TURNED_OFF,
      FLOWS.INPUT_THREE_TOGGLED,
      FLOWS.INPUT_THREE_TURNED_ON,
      FLOWS.INPUT_THREE_TURNED_OFF,
    ].forEach(key => {
      this._registerFlowCardTriggerDevice(key);
    });

    // Register legacy flow cards
    [
      FLOWS.LEGACY_INPUT_ONE_TURNED_ON,
      FLOWS.LEGACY_INPUT_ONE_TURNED_OFF,
      FLOWS.LEGACY_INPUT_TWO_TURNED_ON,
      FLOWS.LEGACY_INPUT_TWO_TURNED_OFF,
      FLOWS.LEGACY_INPUT_THREE_TURNED_ON,
      FLOWS.LEGACY_INPUT_THREE_TURNED_OFF,
    ].forEach(key => {
      this._registerLegacyFlowCardTriggerDevice(key);
    });

    // Register thermostat mode changed flow card trigger device with listener
    this._registerThermostatModeChangedFlowCardTriggerDevice();
  }

  _registerFlowCardAction(key, fn) {
    if (!this.flowCardAction) this.flowCardAction = {};
    try {
      this.flowCardAction[key] = new Homey.FlowCardAction(`${key}_${this.id}`)
        .register()
        .registerRunListener(fn.bind(this));
      this.log('_registerFlowCardAction() -> registered', `${key}_${this.id}`);
    } catch (err) {
      // this.error(`failed to register flow card action ${key} for ${this.id}`, err.message);
    }
  }

  _registerFlowCardTriggerDevice(key) {
    if (!this.flowCardTriggerDevice) this.flowCardTriggerDevice = {};
    try {
      this.flowCardTriggerDevice[key] = new Homey.FlowCardTriggerDevice(`${key}_${this.id}`).register();
      this.log('_registerFlowCardTriggerDevice() -> registered', `${key}_${this.id}`);
    } catch (err) {
      // this.error(`failed to register flow card trigger device ${key} for ${this.id}`, err.message);
    }
  }

  _registerLegacyFlowCardTriggerDevice(key) {
    if (!this.flowCardTriggerDevice) this.flowCardTriggerDevice = {};
    try {
      this.flowCardTriggerDevice[key] = new Homey.FlowCardTriggerDevice(`${this.id}_${key}`).register();
      this.log('_registerLegacyFlowCardTriggerDevice() -> registered', `${this.id}_${key}`);
    } catch (err) {
      // this.error(`failed to register flow card trigger device ${key} for ${this.id}`, err.message);
    }
  }

  _registerThermostatModeChangedFlowCardTriggerDevice() {
    if (!this.flowCardTriggerDevice) this.flowCardTriggerDevice = {};
    try {
      this.flowCardTriggerDevice[FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED] = new Homey.FlowCardTriggerDevice(`${FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED}_${this.id}`)
        .registerRunListener((args, state) => args.mode && state.mode && args.mode.toLowerCase() === state.mode.toLowerCase())
        .register();
      this.log('_registerThermostatModeChangedFlowCardTriggerDevice() -> registered', `${FLOWS.OFF_AUTO_THERMOSTAT_MODE_CHANGED}_${this.id}`);
    } catch (err) {
      // this.error(`failed to register flow card trigger device ${FLOWs.offAutoThermostatModeChanged} for ${this.id}`, err.message);
    }
  }

  /**
   * Flow Action handler that will reset the accumulated meter power on the device.
   * @param args
   * @returns {Promise<*>}
   */
  async resetMeterFlowAction(args) {
    if (args && args.device) {
      if (typeof args.device.resetMeter === 'function') {
        return args.device.resetMeter();
      }
      return Promise.reject(new Error('device_does_not_support_meter_reset'));
    }
    return Promise.reject(new Error('missing_device_instance'));
  }

  /**
   * Flow Action handler that will set the thermostat state on a device.
   * @param args
   */
  async setOffAutoThermostatMode(args) {
    if (args && args.device) {
      if (typeof args.device.setThermostatMode !== 'function') throw new Error('device_does_not_support_set_thermostat_mode');
      return args.device.setThermostatMode(args.mode).then(() => args.device.refreshCapabilityValue(CAPABILITIES.OFF_AUTO_THERMOSTAT_MODE, COMMAND_CLASSES.THERMOSTAT_MODE));
    }
    throw new Error('missing_device_instance');
  }

  /**
   * Method that triggers a Flow from a device instance.
   * @param flowId
   * @param device
   * @param tokens
   * @param state
   * @returns {Promise<void>}
   */
  async triggerFlow(flowId, device, tokens = {}, state = {}) {
    if (!flowId) return this.error('flow id is undefined:', flowId);
    if (!device || !(device instanceof Homey.Device)) return this.error('missing device argument for flow:', flowId);
    if (!Object.prototype.hasOwnProperty.call(this.flowCardTriggerDevice, flowId)) return this.error(`flow is not registered: ${flowId}`);
    try {
      this.log('trigger flow', flowId, tokens, state);
      await this.flowCardTriggerDevice[flowId].trigger(device, tokens, state);
    } catch (err) {
      this.error(`flow failed to trigger, reason: ${err.message}`);
    }
  }
}

module.exports = QubinoDriver;
