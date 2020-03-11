'use strict';

const Homey = require('homey');
const { ZwaveDevice, Util } = require('homey-meshdriver');

const {
  CAPABILITIES, SETTINGS, COMMAND_CLASSES, DEVICE_CLASS_GENERIC, INPUT_MAP,
} = require('./constants');

const RETRY_GET_CONFIG = 3;
const SETTINGS_MIGRATED_STORE_FLAG = 'migratedSettings';

/**
 * This class adds basic functionality related to most if not all Qubino devices, it detects the devices
 * multi channel endpoint structure, configures its multi channel association reporting accordingly and handles some
 * very common settings.
 */
class QubinoDevice extends ZwaveDevice {
  async onMeshInit() {
    this.enableDebug(); // TODO: remove this when this app version becomes stable
    this.printNode(); // TODO: remove this when this app version becomes stable

    // Mark device as unavailable while configuring
    this.setUnavailable(Homey.__('pairing.configuring'));

    // Register common settings
    this.registerSettings();

    // Migrate settings and capabilities
    await this._migrateSettingsAndCapabilities();

    this._inputs = {};

    // Get number of multi channel nodes
    this.numberOfMultiChannelNodes = Object.keys(this.node.MultiChannelNodes || {}).length;

    this.log(`found ${this.numberOfMultiChannelNodes} multi channel nodes`);
    this.log('multi channel configuration is:', this.multiChannelConfigurationDisabled ? 'disabled' : 'enabled');

    // Get reference to driver
    this.driver = this.getDriver();

    // Configure multi channel reporting if necessary
    if (!this.multiChannelConfigurationDisabled) {
      this.log('configure multi channel reporting');
      try {
        await this._configureReporting();
      } catch (err) {
        this.error('failed to configure reporting', err);
      }
    }

    // Register configuration dependent capabilities
    await this.registerCapabilities();
    this.log('registered capabilities');

    // Listen for reset_meter maintenance action
    this.registerCapabilityListener(CAPABILITIES.METER_RESET_MAINTENANCE_ACTION, async () => {
      // Maintenance action button was pressed, return a promise
      if (typeof this.resetMeter === 'function') return this.resetMeter();
      this.error('Reset meter failed');
      throw new Error('Reset meter not supported');
    });

    // Register temperature sensor endpoint
    this.registerTemperatureSensor();

    // Register input endpoints
    await this.registerInputs();

    // Finally device is ready to be used, mark as available
    this.setAvailable();
  }

  /**
   * Method that handles migration of settings and capabilities if needed.
   * @returns {Promise<void>}
   * @private
   */
  async _migrateSettingsAndCapabilities() {
    // Check if migration is needed
    const isMigrated = this.getStoreValue(SETTINGS_MIGRATED_STORE_FLAG);
    if (isMigrated) this.log('device has already been migrated');
    else this.log('device is not yet migrated');

    // Migrate settings
    if (!isMigrated && typeof this._migrateSettings === 'function') {
      this._migrateSettings(this.getSettings());
      this.setStoreValue(SETTINGS_MIGRATED_STORE_FLAG, true);
    }

    // Migrate capabilities
    if (!isMigrated && typeof this.migrateCapabilities === 'function') {
      await this.migrateCapabilities().catch(err => this.error('capability migrations failed', err));
    }
  }

  /**
   * Method that handles migration of capabilities.
   * TODO: remove this when this app version becomes stable
   * @returns {Promise<void>}
   */
  async migrateCapabilities() {
    if (this.hasCapability(CAPABILITIES.RESET_METER)) {
      await this.removeCapability(CAPABILITIES.RESET_METER).catch(err => this.error(`Error removing ${CAPABILITIES.RESET_METER} capability`, err));
      this.log('removed capability', CAPABILITIES.RESET_METER);
    }
    if (this.hasCapability(CAPABILITIES.CALIBRATION)) {
      await this.removeCapability(CAPABILITIES.CALIBRATION).catch(err => this.error(`Error removing ${CAPABILITIES.CALIBRATION} capability`, err));
      this.log('removed capability', CAPABILITIES.CALIBRATION);
    }
  }

  /**
   * Method that handles migration of allOnAllOff setting.
   * @param key
   * @param newKeyOn
   * @param newKeyOff
   * @private
   */
  _migrateAllOnAllOff(key, newKeyOn, newKeyOff) {
    const value = this.getSetting(key);
    const settingsObj = {};
    this.log(`migrate setting ${key}`);
    switch (Number(value)) {
      case 255:
        settingsObj[newKeyOn] = true;
        settingsObj[newKeyOff] = true;
        break;
      case 0:
        settingsObj[newKeyOn] = false;
        settingsObj[newKeyOff] = false;
        break;
      case 1:
        settingsObj[newKeyOn] = false;
        settingsObj[newKeyOff] = true;
        break;
      case 2:
        settingsObj[newKeyOn] = true;
        settingsObj[newKeyOff] = false;
        break;
      default:
        this.error('failed to migrated all on/all off setting');
    }
    this.setSettings(settingsObj).catch(err => this.error('failed to set settings after migration of allOn/allOff', err));
  }

  /**
   * This is a map of often used settings and migrations.
   * @returns {{switchTypeInput1: *, switchTypeInput2: *, contactTypeInput2: *, contactTypeInput3: *, autoOn: number, autoOff: number, restoreStatus: boolean, powerReportingThreshold: *, powerReportingInterval: number, maximumDimValue: *, minimumDimValue: *, dimDuration: number, dimDurationKeyPressed: *}}
   * @private
   */
  _genericMigrationMap() {
    const migrationMap = {};
    if (this.getSetting('power_report_on_power_change') !== null) {
      migrationMap.powerReportingThreshold = () => this.getSetting('power_report_on_power_change');
    }
    if (this.getSetting('input_1_type') !== null) {
      migrationMap.switchTypeInput1 = () => this.getSetting('input_1_type');
    }
    if (this.getSetting('input_2_type') !== null) {
      migrationMap.switchTypeInput2 = () => this.getSetting('input_2_type');
    }
    if (this.getSetting('input_3_type') !== null) {
      migrationMap.switchTypeInput3 = () => this.getSetting('input_3_type');
    }
    if (this.getSetting('input_2_contact_type') !== null) {
      migrationMap.contactTypeInput2 = () => this.getSetting('input_2_contact_type');
    }
    if (this.getSetting('input_3_contact_type') !== null) {
      migrationMap.contactTypeInput3 = () => this.getSetting('input_3_contact_type');
    }
    if (this.getSetting('automatic_turning_on_output_after_set_time') !== null) {
      migrationMap.autoOn = () => this.getSetting('automatic_turning_on_output_after_set_time');
    }
    if (this.getSetting('automatic_turning_off_output_after_set_time') !== null) {
      migrationMap.autoOff = () => this.getSetting('automatic_turning_off_output_after_set_time');
    }
    if (this.getSetting('state_of_device_after_power_failure') !== null) {
      migrationMap.restoreStatus = () => !this.getSetting('state_of_device_after_power_failure');
    }
    if (this.getSetting('power_report_by_time_interval') !== null) {
      migrationMap.powerReportingInterval = () => this.getSetting('power_report_by_time_interval');
    }
    if (this.getSetting('maximum_dimming_value') !== null) {
      migrationMap.maximumDimValue = () => this.getSetting('maximum_dimming_value');
    }
    if (this.getSetting('minimum_dimming_value') !== null) {
      migrationMap.minimumDimValue = () => this.getSetting('minimum_dimming_value');
    }
    if (this.getSetting('dimming_time_soft_on_off') !== null) {
      migrationMap.dimDuration = () => this.getSetting('dimming_time_soft_on_off') / 100;
    }
    if (this.getSetting('dimming_time_when_key_pressed') !== null) {
      migrationMap.dimDurationKeyPressed = () => this.getSetting('dimming_time_when_key_pressed');
    }
    if (this.getSetting('temperature_sensor_offset') !== null) {
      migrationMap.temperatureSensorOffset = () => {
        const value = this.getSetting('temperature_sensor_offset');
        if (value === 32536) return 0;
        if (value >= 1 && value <= 100) {
          return Util.mapValueRange(1, 100, 0.1, 10, value);
        }
        if (value >= 1001) {
          return Util.mapValueRange(1001, 1100, 0.1, 10, value) * -1;
        }
      };
    }
    if (this.getSetting('digital_temperature_sensor_reporting') !== null) {
      migrationMap.temperatureSensorReportingThreshold = () => this.getSetting('digital_temperature_sensor_reporting') / 10;
    }
    return migrationMap;
  }

  /**
   * Method that gets the generic migration map and the device specific migration map if possible. Then applies migrations
   * based on the settings keys available in the device (as described in app.json manifest).
   * @private
   */
  _migrateSettings() {
    // Get generic settings migration map
    const genericSettingsMigrationMap = this._genericMigrationMap();

    // Get device specific settings migration map
    const deviceSpecificSettingsMigrationMap = typeof this._settingsMigrationMap === 'function' ? this._settingsMigrationMap() : {};

    // Merge the two, device should override generic
    const settingsMigrationMap = { ...genericSettingsMigrationMap, ...deviceSpecificSettingsMigrationMap };

    // Get all settings keys of the device
    const currentSettings = this.getSettings();
    const currentSettingsKeys = Object.keys(currentSettings);

    // Filter out all settings keys that are not available in the manifest settings
    const migratedSettingsMap = {};
    currentSettingsKeys.forEach(settingKey => {
      if (Object.prototype.hasOwnProperty.call(settingsMigrationMap, settingKey)) {
        this.log(`migrate setting ${settingKey}`);
        migratedSettingsMap[settingKey] = settingsMigrationMap[settingKey]();
      } else {
        migratedSettingsMap[settingKey] = currentSettings[settingKey];
      }
      const manifestSetting = this.getManifestSetting(settingKey);
      if (manifestSetting && Object.prototype.hasOwnProperty.call(manifestSetting, 'attr')) {
        if (Object.prototype.hasOwnProperty.call(manifestSetting.attr, 'min') && migratedSettingsMap[settingKey] < manifestSetting.attr.min) {
          this.log(`migrate setting ${settingKey} - value (${migratedSettingsMap[settingKey]}) lower than min (${manifestSetting.attr.min})`);
          migratedSettingsMap[settingKey] = Math.max(migratedSettingsMap[settingKey], manifestSetting.attr.min); // ensure not lower than minimum value
        }
        if (Object.prototype.hasOwnProperty.call(manifestSetting.attr, 'max') && migratedSettingsMap[settingKey] > manifestSetting.attr.max) {
          this.log(`migrate setting ${settingKey} - value (${migratedSettingsMap[settingKey]}) higher than max (${manifestSetting.attr.max})`);
          migratedSettingsMap[settingKey] = Math.min(migratedSettingsMap[settingKey], manifestSetting.attr.max); // ensure not higher than maximum value
        }
        if (Object.prototype.hasOwnProperty.call(manifestSetting.attr, 'step') && manifestSetting.attr.step === 0.1 && migratedSettingsMap[settingKey] % 1 !== 0) {
          this.log(`migrate setting ${settingKey} - value (${migratedSettingsMap[settingKey]}) rounded at 1 decimal`);
          migratedSettingsMap[settingKey] = Math.round(migratedSettingsMap[settingKey] * 10) / 10; // ensure rounding on 1 decimal
        }
      }
    });

    // Set new settings object, migration done
    this.setSettings(migratedSettingsMap).catch(err => this.error('failed to set settings after settings migrations', err));

    // Migrate all on all off setting
    if (this.getSetting('deactivate_ALL_ON_ALL_OFF') !== null) {
      this._migrateAllOnAllOff('deactivate_ALL_ON_ALL_OFF', 'allOn', 'allOff');
    }
  }

  /**
   * Stub method which can be overridden by devices which do not support the new multi channel device structure of
   * Qubino.
   * @returns {boolean}
   */
  get multiChannelConfigurationDisabled() {
    return false;
  }

  /**
   * Get method that will return an object with the multi channel node id property if needed, else it will return
   * an empty object.
   * @returns {*}
   */
  get multiChannelNodeObject() {
    if (this.numberOfMultiChannelNodes === 0 || this.multiChannelConfigurationDisabled) return {};
    return {
      multiChannelNodeId: this.findRootDeviceEndpoint(),
    };
  }

  /**
   * Overrides registerCapability. This method ass the multiChannelNodeObject to the userOpts part of the
   * registerCapability call (if necessary), it also checks if a device has a capability before trying to register it.
   * @param args
   */
  registerCapability(...args) {
    if (this.hasCapability(args[0])) {
      if (args.length >= 2) args[2] = Object.assign(this.multiChannelNodeObject, args[2]);
      else if (args.length === 1) args.push(this.multiChannelNodeObject);
      super.registerCapability(...args);
    }
  }

  /**
   * Method that resets the accumulated power meter value on the node. It tries to find the root node of the device
   * and then looks for the COMMAND_CLASS_METER.
   * @returns {*}
   */
  resetMeter({multiChannelNodeId} = {}) {
    const multiChannelRootNodeId = multiChannelNodeId || this.findRootDeviceEndpoint();
    if (typeof multiChannelRootNodeId === 'number') {
      return this.meterReset({ multiChannelNodeId: multiChannelRootNodeId })
        .then(async res => {
          if (this.hasCapability(CAPABILITIES.METER_POWER)) {
            await this.setCapabilityValue(CAPABILITIES.METER_POWER, 0);
          }
          return res;
        });
    }
    return this.meterReset()
      .then(async res => {
        if (this.hasCapability(CAPABILITIES.METER_POWER)) {
          await this.setCapabilityValue(CAPABILITIES.METER_POWER, 0);
        }
        return res;
      });
  }

  /**
   * When settings have been changed that change the device structure notify the user of requirement to re-pair.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {{en: string, nl: string}}
   */
  customSaveMessage(oldSettings, newSettings, changedKeysArr = []) {
    if (changedKeysArr.includes(SETTINGS.ENABLE_INPUT_1)
      || changedKeysArr.includes(SETTINGS.ENABLE_INPUT_2)
      || changedKeysArr.includes(SETTINGS.ENABLE_INPUT_3)
      || changedKeysArr.includes(SETTINGS.FUNCTIONALITY_INPUT_3)
      || changedKeysArr.includes(SETTINGS.THERMOSTAT_MODE)
      || changedKeysArr.includes(SETTINGS.WORKING_MODE)) {
      return Homey.__('settings.re_pair_required');
    }
  }

  /**
   * Method that checks the multi channel nodes of the device and will return an array with the multi channel node ids
   * of the found input sensor endpoints.
   * @returns {Array}
   */
  findInputSensorEndpoints() {
    const foundEndpoints = [];
    for (const [i, multiChannelNode] of Object.entries(this.node.MultiChannelNodes)) {
      if (multiChannelNode.deviceClassGeneric === DEVICE_CLASS_GENERIC.SENSOR_BINARY
        || multiChannelNode.deviceClassGeneric === DEVICE_CLASS_GENERIC.SENSOR_NOTIFICATION) {
        foundEndpoints.push(Number(i));
      }
    }
    return foundEndpoints;
  }

  /**
   * Method that checks the multi channel nodes of the device and will return the multi channel node id of the found
   * endpoint that supports the temperature sensor.
   * @returns {*}
   */
  findTemperatureSensorEndpoint() {
    return this.getMultiChannelNodeIdsByDeviceClassGeneric(DEVICE_CLASS_GENERIC.SENSOR_MULTILEVEL)[0] || null;
  }

  /**
   * Method that registers the temperature sensor capability if applicable.
   */
  registerTemperatureSensor() {
    const temperatureSensorEndpoint = this.findTemperatureSensorEndpoint();
    if (typeof temperatureSensorEndpoint === 'number') { // command class on multi channel endpoint
      this.log('configured temperature sensor on multi channel node', temperatureSensorEndpoint);
      this.registerCapability(CAPABILITIES.MEASURE_TEMPERATURE, COMMAND_CLASSES.SENSOR_MULTILEVEL, {
        multiChannelNodeId: temperatureSensorEndpoint,
      });
    } else if (this.hasCommandClass(COMMAND_CLASSES.SENSOR_MULTILEVEL) && this.hasCapability(CAPABILITIES.MEASURE_TEMPERATURE)) { // command class on root node
      this.log('configured temperature sensor on root node', temperatureSensorEndpoint);
      this.registerCapability(CAPABILITIES.MEASURE_TEMPERATURE, COMMAND_CLASSES.SENSOR_MULTILEVEL);
    } else if (this.hasCapability(CAPABILITIES.MEASURE_TEMPERATURE)) {
      this.log('could not find temperature sensor command class on root or multi channel node, removing measure_temperature capability');
      this.removeCapability(CAPABILITIES.MEASURE_TEMPERATURE).catch(err => this.error('Error removing measure_temperature capability', err));
    }
  }

  /**
   * Method that checks the multi channel nodes of the device and will return the multi channel node id of the found
   * endpoint that supports the basic device controls.
   * @returns {*}
   */
  findRootDeviceEndpoint() {
    if (this.numberOfMultiChannelNodes === 0) return null;
    const rootDeviceClassGeneric = this.rootDeviceClassGeneric;
    for (const i in this.node.MultiChannelNodes) {
      if (this.node.MultiChannelNodes[i].deviceClassGeneric === DEVICE_CLASS_GENERIC.SWITCH_BINARY
        || this.node.MultiChannelNodes[i].deviceClassGeneric === DEVICE_CLASS_GENERIC.SWITCH_MULTILEVEL
        || (typeof rootDeviceClassGeneric === 'string'
          && this.node.MultiChannelNodes[i].deviceClassGeneric === rootDeviceClassGeneric)) {
        return Number(i);
      }
    }
    return null;
  }

  /**
   * Method that reads the inputConfiguration array of a device and based on that will register the input endpoints.
   * If the configuration of the endpoints is not known it will be fetched (configurationGet) once.
   * @returns {Promise<void>}
   */
  async registerInputs() {
    this.log('registering inputs...');

    const inputSensorEndpoints = this.findInputSensorEndpoints();
    if (!Array.isArray(inputSensorEndpoints) || inputSensorEndpoints.length === 0) {
      this.log('no enabled input endpoints found');
      return;
    }
    this.log('found sensor endpoints', inputSensorEndpoints);

    const inputConfigs = this.inputConfiguration;
    if (!Array.isArray(inputConfigs)) {
      this.log('missing input configuration');
      return;
    }

    for (const inputConfig of inputConfigs) {
      if (!Object.prototype.hasOwnProperty.call(inputConfig, 'DEFAULT_ENABLED') || inputConfig.DEFAULT_ENABLED === false) {
        const storeKey = `enableInput${inputConfig.INPUT_ID}`;
        inputConfig.ENABLED = this.getSetting(storeKey) > 0;
        if ((inputConfig.ENABLED !== true && inputConfig.ENABLED !== false) || typeof this.getStoreValue(storeKey) !== 'number') {

          // Get configuration parameter value for input enabled setting
          const payload = await this.safeConfigurationGet(inputConfig.PARAMETER_INDEX);
          if (payload === null) {
            this.error('failed to get input parameter value, aborting...');
            return;
          }

          // Parse the received payload
          const parsedPayload = this._parseInputParameterPayload(payload, inputConfig.INPUT_ID);
          inputConfig.ENABLED = parsedPayload > 0;

          // Mark input as initialized to prevent future config parameter gets
          this.setStoreValue(storeKey, parsedPayload);

          // Finally save the fetched setting value
          this.setSettings({ [storeKey]: parsedPayload.toString() });
        }
      }

      // Input is enabled, get the first found mc endpoint
      if (inputConfig.ENABLED === true || inputConfig.DEFAULT_ENABLED === true) {
        inputConfig.multiChannelEndpoint = inputSensorEndpoints.shift();

        // Add custom flow trigger definitions
        if (Object.prototype.hasOwnProperty.call(inputConfig, 'FLOW_TRIGGERS')) {
          this.registerInputEndpointListener(inputConfig.multiChannelEndpoint, inputConfig.INPUT_ID, inputConfig.FLOW_TRIGGERS);
        } else {
          this.registerInputEndpointListener(inputConfig.multiChannelEndpoint, inputConfig.INPUT_ID);
        }
      }
    }
  }

  /**
   * Method that registers a multi channel report listener for the specified endpoint and corresponding input.
   * @param inputSensorEndpoint
   * @param inputId
   */
  registerInputEndpointListener(inputSensorEndpoint, inputId, customFlowTriggers) {
    this.log(`configured input sensor ${inputId} on multi channel node ${inputSensorEndpoint}`);

    // Determine inputMap, first check for custom map, then use default
    let _inputMap = null;
    if (customFlowTriggers) {
      _inputMap = { INPUT_ID: inputSensorEndpoint, FLOW_TRIGGERS: customFlowTriggers };
    } else {
      _inputMap = INPUT_MAP[inputId];
    }

    this._inputs[inputSensorEndpoint] = _inputMap;

    this.registerMultiChannelReportListener(
      inputSensorEndpoint,
      COMMAND_CLASSES.SENSOR_BINARY,
      COMMAND_CLASSES.SENSOR_BINARY_REPORT,
      (...args) => this.processInputEvent(inputSensorEndpoint, ...args),
    );

    this.registerMultiChannelReportListener(
      inputSensorEndpoint,
      COMMAND_CLASSES.NOTIFICATION,
      COMMAND_CLASSES.NOTIFICATION_REPORT,
      (...args) => this.processInputEvent(inputSensorEndpoint, ...args),
    );
  }

  /**
   * Method that acts as a wrapper for configurationGet, it adds retrying (which is sometimes needed, since devices
   * do not always respond), and does some error handling.
   * @param index
   * @param retryOverride
   * @returns {Promise<*>}
   */
  async safeConfigurationGet(index, retryOverride = RETRY_GET_CONFIG) {
    let result;
    for (let i = 0; i < retryOverride; ++i) {
      try {
        result = await this.configurationGet({ index });
        break;
      } catch (err) {
        this.error(`failed to get configuration parameter ${index}, retrying (${i + 1}/${retryOverride})`);
      }
    }
    if (!result) {
      this.error(`failed to get configuration parameter ${index}`);
      return null;
    }

    this.log(`got configuration parameter ${index}: ${result}`);
    return result;
  }

  /**
   * Method that processes a notification report and triggers the corresponding Flow.
   * @param inputSensorEndpoint
   * @param report
   * @private
   */
  processInputEvent(inputSensorEndpoint, report) {
    if (!inputSensorEndpoint) throw new Error('missing_input_sensor_endpoint');
    if (!report || (!Object.prototype.hasOwnProperty.call(report, 'Event (Parsed)') && !Object.prototype.hasOwnProperty.call(report, 'Sensor Value'))) return;
    let newState = null;

    // Determine new state from sensor binary report or notification report
    if (Object.prototype.hasOwnProperty.call(report, 'Sensor Value')) {
      newState = (report['Sensor Value'] === 'detected an event');
    } else if (Object.prototype.hasOwnProperty.call(report, 'Event (Parsed)')) {
      newState = (report['Event (Parsed)'] !== 'Event inactive');
    }
    if (newState === null) return;

    // Get input object
    const inputObj = this._inputs[inputSensorEndpoint];
    if (!inputObj || typeof inputObj.INPUT_ID === 'undefined') throw new Error(`unknown_input_sensor_endpoint_${inputSensorEndpoint}`);
    if (inputObj.state === newState) return; // Do nothing when state did not change
    inputObj.state = newState;

    this.log(`received notification from input ${inputObj.INPUT_ID}: ${newState}`);

    // Always trigger toggle
    this.driver.triggerFlow(inputObj.FLOW_TRIGGERS.TOGGLE, this).catch(err => this.error(`error triggering flow ${inputObj.FLOW_TRIGGERS.TOGGLE}`, err));

    // Trigger flow based on state
    if (newState) {
      this.driver.triggerFlow(inputObj.FLOW_TRIGGERS.ON, this).catch(err => this.error(`error triggering flow ${inputObj.FLOW_TRIGGERS.ON}`, err));
    } else {
      this.driver.triggerFlow(inputObj.FLOW_TRIGGERS.OFF, this).catch(err => this.error(`error triggering flow ${inputObj.FLOW_TRIGGERS.OFF}`, err));
    }
  }

  /**
   * Override onSettings to handle combined z-wave settings.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {Promise<T>}
   */
  async onSettings(oldSettings, newSettings, changedKeysArr) {
    // Handle all on/all off settings
    if (changedKeysArr.includes(SETTINGS.ALL_ON) || changedKeysArr.includes(SETTINGS.ALL_OFF)) {
      const allOnAllOf = QubinoDevice._combineAllOnAllOffSettings(newSettings);
      const allOnAllOfSize = this.allOnAllOffSize || SETTINGS.SIZE.ALL_ON_ALL_OFF;
      await this.configurationSet({
        index: SETTINGS.INDEX.ALL_ON_ALL_OFF,
        size: allOnAllOfSize,
        signed: allOnAllOfSize !== 1,
      }, allOnAllOf);

      // Remove all on all off changed keys
      changedKeysArr = [...changedKeysArr.filter(changedKey => changedKey !== SETTINGS.ALL_ON && changedKey !== SETTINGS.ALL_OFF)];
    }

    return super.onSettings(oldSettings, newSettings, changedKeysArr);
  }

  /**
   * Combine two settings (all on/all off) into one value.
   * @param newSettings
   * @returns {number}
   * @private
   */
  static _combineAllOnAllOffSettings(newSettings) {
    const allOn = newSettings[SETTINGS.ALL_ON];
    const allOff = newSettings[SETTINGS.ALL_OFF];
    if (allOn && allOff) return 255;
    if (allOn && !allOff) return 2;
    if (!allOn && allOff) return 1;
    return 0;
  }

  /**
   * Method that will configure reporting in case the device has multi channel nodes and it has not been configured
   * yet. In that case it will try to set association group 1 to '1.1` which enables multi channel node reporting.
   * @returns {Promise<void>}
   * @private
   */
  async _configureReporting() {
    if (this.numberOfMultiChannelNodes > 0 && !this.getSetting(SETTINGS.MULTI_CHANNEL_REPORTING_CONFIGURED)) {
      try {
        await this._configureMultiChannelReporting();
      } catch (err) {
        this.error('failed configure reporting', err);
        this.setUnavailable(Homey.__('error.missing_multi_channel_command_class'));
      }
      this.setSettings({ [SETTINGS.MULTI_CHANNEL_REPORTING_CONFIGURED]: true });
    }
  }

  /**
   * Method that will first remove any present association in group 1 and will then set association group 1 to '1.1'.
   * @returns {Promise<boolean>}
   * @private
   */
  async _configureMultiChannelReporting() {
    if (this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION) {
      if (this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION.MULTI_CHANNEL_ASSOCIATION_SET) {
        await this.node.CommandClass.COMMAND_CLASS_ASSOCIATION.ASSOCIATION_REMOVE(new Buffer([1, 1]));
        await this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION.MULTI_CHANNEL_ASSOCIATION_SET(
          new Buffer([1, 0x00, 1, 1]),
        );
        await this.setSettings({ zw_group_1: '1.1' });
        this.log('multi channel association configured');
        return true;
      }
    }
    throw new Error('multi_channel_association_not_supported');
  }

  /**
   * Method that safely parses a received configuration get payload.
   * @param payload
   * @returns {*}
   * @private
   */
  _parseInputParameterPayload(payload) {
    try {
      return payload['Configuration Value'][0];
    } catch (err) {
      this.error(`_parseInputParameterPayload() -> failed to parse payload (${payload})`);
      return 0;
    }
  }

  /**
   * Method that handles the parsing of many shared settings.
   */
  registerSettings() {
    // Invert restore status value
    this.registerSetting(SETTINGS.RESTORE_STATUS, value => !value);

    this.registerSetting(SETTINGS.PID_DEADBAND, value => value * 10);

    // Multiply temperature sensor threshold by 10
    this.registerSetting(SETTINGS.TEMPERATURE_SENSOR_REPORTING_THRESHOLD, value => value * 10);

    // Map temperature calibration value
    this.registerSetting(SETTINGS.TEMPERATURE_SENSOR_OFFSET, value => {
      if (value === 0) return 32536;

      // -10 till -0.1 becomes 1100 till 1001
      if (value < 0) return Util.mapValueRange(-10, -0.1, 1100, 1001, value);

      // 10 till 0.1 becomes 100 till 1
      return Util.mapValueRange(10, 0.1, 100, 1, value);
    });
  }
}

module.exports = QubinoDevice;
