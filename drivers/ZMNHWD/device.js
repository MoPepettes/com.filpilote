'use strict';

const { Util } = require('homey-meshdriver');

const QubinoDimDevice = require('../../lib/QubinoDimDevice');
const { CAPABILITIES, COMMAND_CLASSES, SETTINGS } = require('../../lib/constants');

const COLOR_REPORT_DEBOUNCE_TIMEOUT = 500; // ms
const MULTIPLE_CAPABILITIES_DEBOUNCE_TIMEOUT = 500; // ms

/**
 * Flush RGBW Dimmer (ZMNHWD)
 * Extended manual: https://qubino.com/manuals/Flush_RGBW_Dimmer.pdf
 * TODO: add support for 4 Dimmer mode using add/remove capability
 */
class ZMNHWD extends QubinoDimDevice {
  /**
   * Method that registers custom setting parsers.
   */
  registerSettings() {
    super.registerSettings();

    // Multiply dim duration by 10 instead of default 100
    this.registerSetting(SETTINGS.DIM_DURATION, value => value * 10);
  }

  /**
   * Method that will register capabilities of the device based on its configuration.
   * @private
   */
  async registerCapabilities() {
    // Keep track of color reports
    this._colorReportsQueue = [];

    // Set empty color component state
    this._colorComponentsState = {
      white: null,
      red: null,
      green: null,
      blue: null,
      dim: null,
    };

    // Register onoff capability
    this.registerCapability(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_MULTILEVEL, {
      getOpts: {
        getOnStart: false, // onoff value is retrieved manually in _getCapabilityValuesOnStart()
      },
    });

    // Register dim capability
    this.registerCapability(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL, {
      getOpts: {
        getOnStart: false, // dim value is retrieved manually in _getCapabilityValuesOnStart()
      },
    });

    // Register report listener for switch color command class, the reports are debounced
    this.registerReportListener(COMMAND_CLASSES.SWITCH_COLOR, COMMAND_CLASSES.SWITCH_COLOR_REPORT, report => {
      if (this._colorReportDebounce) clearTimeout(this._colorReportDebounce);
      this._colorReportsQueue.push(report);
      this._colorReportDebounce = setTimeout(this._debouncedColorReportListener.bind(this), COLOR_REPORT_DEBOUNCE_TIMEOUT);
    });

    // Register capability listener for all capabilities which affect each other
    this.registerMultipleCapabilityListener([CAPABILITIES.ONOFF, CAPABILITIES.DIM, CAPABILITIES.LIGHT_HUE, CAPABILITIES.LIGHT_SATURATION, CAPABILITIES.LIGHT_MODE, CAPABILITIES.LIGHT_TEMPERATURE], this._multipleCapabilitiesHandler.bind(this), MULTIPLE_CAPABILITIES_DEBOUNCE_TIMEOUT);

    // Fetch capability values from device
    await this._getCapabilityValuesOnStart();
  }

  /**
   * This method is debounced and loops all registered color reports and updates the device capabilities accordingly.
   * @returns {Promise<void>}
   * @private
   */
  _debouncedColorReportListener() {
    this.log('_debouncedColorReportListener()');

    let red = null;
    let green = null;
    let blue = null;
    let white = null;

    // Loop all color reports to find all RGBW values
    const dim = this.getCapabilityValue(CAPABILITIES.DIM);
    for (let i = 0; i < this._colorReportsQueue.length; i++) {
      const report = this._colorReportsQueue[i];
      if (report['Color Component ID'] === 0) { // white
        white = report.Value;
      } else if (report['Color Component ID'] === 2) { // red
        red = report.Value;
      } else if (report['Color Component ID'] === 3) { // green
        green = report.Value;
      } else if (report['Color Component ID'] === 4) { // blue
        blue = report.Value;
      }
    }

    // Ignore report when colors are reset to zero because Homey turned off the device
    if (red === 0 && green === 0 && blue === 0 && white === 0 && this._ignoreNextColorReport) {
      this.log('_debouncedColorReportListener() -> ignore this color report, device has been turned off by Homey');
      return;
    }

    // If not all color components are received request remaining
    if (red === null || green === null || blue === null || white === null) {
      this.log('_debouncedColorReportListener() -> missing a RGBW value, request others');
      // Color components [white = 0, cold white = 1, red = 2, green = 3, blue = 4]
      const commandClassColorSwitch = this.getCommandClass(COMMAND_CLASSES.SWITCH_COLOR);
      if (!(commandClassColorSwitch instanceof Error) && typeof commandClassColorSwitch.SWITCH_COLOR_GET === 'function') {
        // Get all color component values
        Promise.all([
          this._getColorValue(0), // white
          this._getColorValue(2), // red
          this._getColorValue(3), // green
          this._getColorValue(4), // blue
          this.refreshCapabilityValue(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL)
        ])
          .then(async result => {
            const [white, red, green, blue, dim] = result;
            this.log(`_debouncedColorReportListener() -> fetched rgbw(${red},${green},${blue},${white})`);

            // Update state if device is turned on
            if (red || green || blue || white) {
              // Store color components in state object
              this._colorComponentsState.red = red;
              this._colorComponentsState.green = green;
              this._colorComponentsState.blue = blue;
              this._colorComponentsState.white = white;
            }

            // Update device capabilities
            return this._processColorUpdates({
              white, red, green, blue, dim,
            });
          })
          .catch(err => this.error('_debouncedColorReportListener() -> failed to get color value(s)', err));
      }

      return;
    }

    // Reset
    if (this._ignoreNextColorReport) this._ignoreNextColorReport = false;

    // Clear reports
    this._colorReportsQueue = [];
    return this._processColorUpdates({
      white, red, green, blue, dim,
    });
  }

  /**
   * Method that determines the desired capability value for a given capabilityId. It looks in the
   * newCapabilitiesValuesObject and currentCapabilitiesValuesObject and compares if a new value is available, if
   * not the current value is returned.
   * @param {string} capabilityId
   * @param {Object} newCapabilitiesValuesObject
   * @param {Object} currentCapabilitiesValuesObject
   * @returns {*}
   * @private
   */
  _getDesiredCapabilityValue(capabilityId, newCapabilitiesValuesObject, currentCapabilitiesValuesObject) {
    if (typeof newCapabilitiesValuesObject[capabilityId] !== 'undefined') {
      return newCapabilitiesValuesObject[capabilityId];
    }
    return currentCapabilitiesValuesObject[capabilityId];
  }

  /**
   * Method that generates a color component object which is then set on the device. This color component object is
   * generated based on the current and new capability values.
   * @param {Object} newCapabilitiesValuesObject
   * @param {Object} currentCapabilitiesValuesObject
   * @returns {{red: number, green: number, blue: number, white: number}}
   * @private
   */
  _generateColorComponents(newCapabilitiesValuesObject, currentCapabilitiesValuesObject) {
    // Get desired capability values from new/current
    const onoff = this._getDesiredCapabilityValue('onoff', newCapabilitiesValuesObject, currentCapabilitiesValuesObject);
    const dim = this._getDesiredCapabilityValue('dim', newCapabilitiesValuesObject, currentCapabilitiesValuesObject);
    const hue = this._getDesiredCapabilityValue('light_hue', newCapabilitiesValuesObject, currentCapabilitiesValuesObject);
    const mode = this._getDesiredCapabilityValue('light_mode', newCapabilitiesValuesObject, currentCapabilitiesValuesObject);
    const saturation = this._getDesiredCapabilityValue('light_saturation', newCapabilitiesValuesObject, currentCapabilitiesValuesObject);
    const temperature = this._getDesiredCapabilityValue('light_temperature', newCapabilitiesValuesObject, currentCapabilitiesValuesObject);

    // Calculate RGB values based on dim value 1, RGB is scaled for dim later
    let { red, green, blue } = Util.convertHSVToRGB({ hue, saturation, value: 1 });
    let white = 255;

    // If mode is color set white mode to zero
    if (mode === 'color') {
      white = 0;
    } else if (mode === 'temperature') {
      blue = (1 - temperature) * 255; // In temperature mode mix in blue to imitate cool white mode
      red = 0; // Set red to zero since we don't want colors
      green = 0; // Set red to zero since we don't want colors
    }

    // Store colorComponent values when device is off
    if (onoff === false) {
      this._colorComponentsState.red = red;
      this._colorComponentsState.green = green;
      this._colorComponentsState.blue = blue;
      this._colorComponentsState.white = white;
      this.log('stored colorComponent values\n', this._colorComponentsState);
      this._colorChangedWhileOff = true; // Flag that indicates if color component state needs to be restored when turning on
    } else {
      this._colorChangedWhileOff = false // Reset flag
    }

    const colorComponentsObject = {
      red: red * dim,
      green: green * dim,
      blue: blue * dim,
      white: white * dim,
    };
    this.log(`_generateColorComponents() -> rgbw(${colorComponentsObject.red},${colorComponentsObject.green},${colorComponentsObject.blue},${colorComponentsObject.white})`);
    return colorComponentsObject;
  }

  /**
   * Method that is called when one of the device's capabilities is changed. It combines the capabilities into a single
   * command to the device.
   * @param {Object} values
   * @param {Object} options
   * @returns {Promise<*|undefined>}
   * @private
   */
  async _multipleCapabilitiesHandler(values, options = {}) {
    this.log('_multipleCapabilitiesHandler()', values, options);

    // Updated capabilities object
    const newCapabilitiesValuesObject = {
      onoff: values.onoff,
      dim: values.dim,
      light_hue: values.light_hue,
      light_saturation: values.light_saturation,
      light_temperature: values.light_temperature,
      light_mode: values.light_mode,
    };

    // Current capability values
    const currentCapabilitiesValuesObject = {
      onoff: this.getCapabilityValue('onoff'),
      dim: this.getCapabilityValue('dim'),
      light_hue: this.getCapabilityValue('light_hue'),
      light_saturation: this.getCapabilityValue('light_saturation'),
      light_temperature: this.getCapabilityValue('light_temperature'),
      light_mode: this.getCapabilityValue('light_mode'),
    };

    // Filter newCapabilityValues for undefined properties, resulting in object with updated capability values
    const updatedCapabilities = {};
    for (const [key, value] of Object.entries(newCapabilitiesValuesObject)) {
      if (typeof value !== 'undefined') updatedCapabilities[key] = value;
    }

    // Merged capabilities object represents the desired state of the device
    const mergedCapabilitiesValuesObject = { ...currentCapabilitiesValuesObject, ...updatedCapabilities };
    this.log('_multipleCapabilitiesHandler() -> current capabilities values\n', currentCapabilitiesValuesObject);
    this.log('_multipleCapabilitiesHandler() -> new capabilities values\n', newCapabilitiesValuesObject);
    this.log('_multipleCapabilitiesHandler() -> merged capabilities values\n', mergedCapabilitiesValuesObject);

    // Generate color components
    const colorComponents = this._generateColorComponents(newCapabilitiesValuesObject, currentCapabilitiesValuesObject);

    // Store set dim value for later reference (if not zero, else device is not turned on after dimming to off)
    if (typeof newCapabilitiesValuesObject.dim !== 'undefined' && newCapabilitiesValuesObject.dim) {
      this.log('_multipleCapabilitiesHandler() -> stored dim value', newCapabilitiesValuesObject.dim);
      this._colorComponentsState.dim = newCapabilitiesValuesObject.dim;
    }

    // Only dim changed
    if (Object.prototype.hasOwnProperty.call(values, CAPABILITIES.DIM)
      && !this._colorChangedWhileOff // when colors changed while off reset color component state
      && Object.keys(values).length === 1) {
      let dimDuration = null;
      if (Object.prototype.hasOwnProperty.call(options, CAPABILITIES.DIM) && Object.prototype.hasOwnProperty.call(options.dim, 'duration')) {
        dimDuration = options.dim.duration;
      }
      this.log('_multipleCapabilitiesHandler() -> only dim changed', mergedCapabilitiesValuesObject.dim, dimDuration);
      this._ignoreNextColorReport = true;
      // Execute dim only
      return this.executeCapabilitySetCommand(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL, mergedCapabilitiesValuesObject.dim, {
        duration: dimDuration,
      });
    }

    // Is turned off
    if (mergedCapabilitiesValuesObject.onoff === false && (typeof newCapabilitiesValuesObject.dim === 'undefined' || newCapabilitiesValuesObject.dim === 0)) {
      this.log('_multipleCapabilitiesHandler() -> turn off hard');

      this._ignoreNextColorReport = true;
      return this.executeCapabilitySetCommand(CAPABILITIES.ONOFF, COMMAND_CLASSES.SWITCH_MULTILEVEL, false);
    }

    // Is turned on via onoff or via dimming
    if ((currentCapabilitiesValuesObject.onoff === false && mergedCapabilitiesValuesObject.onoff === true)
    || currentCapabilitiesValuesObject.dim === 0 && mergedCapabilitiesValuesObject.onoff > 0) {
      this.log('_multipleCapabilitiesHandler() -> device is turned on, restore last known color components state\n', this._colorComponentsState);

      // Override colorComponent object with stored values
      colorComponents.red = this._colorComponentsState.red;
      colorComponents.green = this._colorComponentsState.green;
      colorComponents.blue = this._colorComponentsState.blue;
      colorComponents.white = this._colorComponentsState.white;

      if (typeof this._colorComponentsState.dim === 'number') this.setCapabilityValue(CAPABILITIES.DIM, this._colorComponentsState.dim);
      else this.setCapabilityValue(CAPABILITIES.DIM, 1);
    }

    // Set onoff to false when the rgbw values are zero
    if (mergedCapabilitiesValuesObject.light_mode === 'color' && colorComponents.red === 0 && colorComponents.green === 0 && colorComponents.blue === 0) {
      this.setCapabilityValue(CAPABILITIES.ONOFF, false);
    } else if (mergedCapabilitiesValuesObject.light_mode === 'temperature' && colorComponents.white === 0 && colorComponents.blue === 0) {
      this.setCapabilityValue(CAPABILITIES.ONOFF, false);
    }

    // Set onoff to true if the device is turned on via dimming
    if (mergedCapabilitiesValuesObject.dim > 0 && mergedCapabilitiesValuesObject.onoff === false) {
      this.setCapabilityValue(CAPABILITIES.ONOFF, true);
    }

    return this._sendColors({ ...colorComponents });
  }

  /**
   * Method that first fetches the dim value from the module. Following, the color component values will be retrieved.
   * Based on these values the capabilities will be updated (in case they changed externally).
   * @returns {Promise<*>}
   * @private
   */
  async _getCapabilityValuesOnStart() {
    this.log('_getCapabilityValuesOnStart()');

    // Get dim value from device
    let dim = null;
    try {
      dim = await this.refreshCapabilityValue(CAPABILITIES.DIM, COMMAND_CLASSES.SWITCH_MULTILEVEL);
      await this.setCapabilityValue(CAPABILITIES.ONOFF, dim > 0);
      this.log('_getCapabilityValuesOnStart() -> dim:', dim);
    } catch (err) {
      return this.error('failed to retrieve dim capability value', err);
    }

    // Color components [white = 0, cold white = 1, red = 2, green = 3, blue = 4]
    const commandClassColorSwitch = this.getCommandClass(COMMAND_CLASSES.SWITCH_COLOR);
    if (!(commandClassColorSwitch instanceof Error) && typeof commandClassColorSwitch.SWITCH_COLOR_GET === 'function') {
      // Get all color component values
      Promise.all([
        this._getColorValue(0), // white
        this._getColorValue(2), // red
        this._getColorValue(3), // green
        this._getColorValue(4), // blue
      ])
        .then(async result => {
          const [white, red, green, blue] = result;
          this.log(`_getCapabilityValuesOnStart() -> rgbw(${red},${green},${blue},${white})`);

          // Store color components in state object
          this._colorComponentsState.red = red;
          this._colorComponentsState.green = green;
          this._colorComponentsState.blue = blue;
          this._colorComponentsState.white = white;

          // Update device capabilities
          return this._processColorUpdates({
            white, red, green, blue, dim,
          });
        })
        .catch(err => this.error('_getCapabilityValuesOnStart() -> failed to get color value(s)', err));
    }
  }

  /**
   * Method that processes an RGBW object and updates the device capabilities accordingly.
   * @param {number} white - Range 0 - 255
   * @param {number} red - Range 0 - 255
   * @param {number} green - Range 0 - 255
   * @param {number} blue - Range 0 - 255
   * @param {number} dim - Range 0 - 1
   * @returns {Promise<void>}
   * @private
   */
  async _processColorUpdates({
    white, red, green, blue, dim,
  }) {
    this.log(`_processColorUpdates() -> rgbw(${red},${green},${blue},${white})`);

    // Device has been turned off
    if (white === 0 && red === 0 && green === 0 && blue === 0) {

      // Colors where dimmed to zero so device is basically off, do not continue further
      return this.setCapabilityValue(CAPABILITIES.ONOFF, false);
    } if (this.getCapabilityValue(CAPABILITIES.ONOFF) === false && (white > 0 || red > 0 || green > 0 || blue > 0)) {

      // Device was off but received color values that indicate device is on
      this.setCapabilityValue(CAPABILITIES.ONOFF, true);
    }

    // Detect color mode
    if (red > 0 || green > 0 || (blue > 0 && white === 0)) {
      this.setCapabilityValue('light_mode', 'color');
      this.log('_processColorUpdates() -> light_mode: color');
    } else if (white > 0) {
      this.setCapabilityValue('light_mode', 'temperature');
      this.log('_processColorUpdates() -> light_mode: temperature');
    }

    // Get hue and saturation from RGB values
    const { hue, saturation } = Util.convertRGBToHSV({
      red,
      green,
      blue,
    });

    this.setCapabilityValue('light_hue', hue);
    this.setCapabilityValue('light_saturation', saturation);
    this.log('_processColorUpdates() -> light_hue:', hue);
    this.log('_processColorUpdates() -> light_saturation:', saturation);

    // Calculate light temperature value
    let lightTemperature = null;
    if (dim === 0) lightTemperature = 0; // Prevent NaN
    else lightTemperature = Util.mapValueRange(0, 255, 1, 0, blue / dim);
    this.setCapabilityValue('light_temperature', lightTemperature);
    this.log('_processColorUpdates() -> light_temperature:', lightTemperature);
  }

  /**
   * Method that executes the SWITCH_COLOR_GET command.
   * @param {number} colorComponentID - [white = 0, cold white = 1, red = 2, green = 3, blue = 4]
   * @returns {Promise<number>}
   * @private
   */
  async _getColorValue(colorComponentID) {
    const commandClassColorSwitch = this.getCommandClass('SWITCH_COLOR');
    if (!(commandClassColorSwitch instanceof Error) && typeof commandClassColorSwitch.SWITCH_COLOR_GET === 'function') {
      try {
        const result = await commandClassColorSwitch.SWITCH_COLOR_GET({ 'Color Component ID': colorComponentID });
        return (result && typeof result.Value === 'number') ? result.Value : 0;
      } catch (err) {
        this.error(err);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Method that executes the SWITCH_COLOR_SET command and stores the last known color component values in
   * this._colorComponentsState.
   * @param {number} white - Range 0 - 255
   * @param {number} red - Range 0 - 255
   * @param {number} green - Range 0 - 255
   * @param {number} blue - Range 0 - 255
   * @returns {Promise<*>}
   * @private
   */
  async _sendColors({
    white, red, green, blue,
  }) {
    this.log(`_sendColors() -> r: ${Math.round(red)}, g: ${Math.round(green)}, b: ${Math.round(blue)}, w: ${Math.round(white)}`);
    const SwitchColorVersion = this.getCommandClass('SWITCH_COLOR').version || 1;

    let setCommand = {
      Properties1: {
        'Color Component Count': 4,
      },
      vg1: [
        {
          'Color Component ID': 0,
          Value: Math.round(white),
        },
        {
          'Color Component ID': 2,
          Value: Math.round(red),
        },
        {
          'Color Component ID': 3,
          Value: Math.round(green),
        },
        {
          'Color Component ID': 4,
          Value: Math.round(blue),
        },
      ],
    };

    this._colorComponentsState.white = setCommand.vg1[0].Value;
    this._colorComponentsState.red = setCommand.vg1[1].Value;
    this._colorComponentsState.green = setCommand.vg1[2].Value;
    this._colorComponentsState.blue = setCommand.vg1[3].Value;

    // Fix broken CC_SWITCH_COLOR_V2 parser
    if (SwitchColorVersion === 2) {
      this.log('_sendColors() -> create buffer manually');
      setCommand = new Buffer([setCommand.Properties1['Color Component Count'], 0, setCommand.vg1[0].Value, 2, setCommand.vg1[1].Value, 3, setCommand.vg1[2].Value, 4, setCommand.vg1[3].Value]);
    }

    return this.node.CommandClass.COMMAND_CLASS_SWITCH_COLOR.SWITCH_COLOR_SET(setCommand);
  }


  /**
   * Override onSettings to handle combined z-wave settings.
   * @param oldSettings
   * @param newSettings
   * @param changedKeysArr
   * @returns {Promise<T>}
   */
  async onSettings(oldSettings, newSettings, changedKeysArr) {
    // Get updated duration unit
    let autoSceneModeTransitionDurationUnit = oldSettings[SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION_UNIT];
    if (changedKeysArr.includes(SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION_UNIT)) {
      autoSceneModeTransitionDurationUnit = newSettings[SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION_UNIT];

      // If unit changed make sure duration is also added as changed
      if (!changedKeysArr.includes(SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION)) {
        changedKeysArr.push(SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION);
      }
    }

    // Get updated transition duration value
    let autoSceneModeTransitionDuration = oldSettings[SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION];
    if (changedKeysArr.includes(SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION)) {
      autoSceneModeTransitionDuration = newSettings[SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION];
    }

    // Add 1000 if unit is minutes
    if (autoSceneModeTransitionDurationUnit === 'min') {
      newSettings[SETTINGS.AUTO_SCENE_MODE_TRANSITION_DURATION] = autoSceneModeTransitionDuration + 1000;
    }

    return super.onSettings(oldSettings, newSettings, changedKeysArr);
  }
}

module.exports = ZMNHWD;
