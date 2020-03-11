# Qubino

This app adds support for Qubino Z-Wave modules in Homey.

### Changelog
Version 3.0.2
* Finalised SDKv2 update
* Added support for Mini Dimmer (ZMNHHD)
* Added support for Flush On/Off Thermostat 2 (ZMNKID)
* Added Flow cards for devices with thermostat mode
* Added Flow cards for devices with inputs
* Added support for Energy
* Improved stability for RGBW Dimmer (ZMNHWD)
* Improved support for Flush Shutter (ZMNHCD)
* Improved support for Flush Shutter DC (ZMNHOD)
* Improved advanced settings for all devices
* Improved Flow cards for all devices
* Various bug fixes and improvements
* Note: a breaking change had to be implemented for Flush 2 Relays (ZMNHBD). The capabilities `onoff`, `meter_power` and `measure_power` have been removed which can break Flows using these capabilities.
* Note: a breaking change had to be implemented for Flush Dimmer (ZMNHDA). The capability `alarm_contact` has been removed which can break Flows using this capability.
* Note: a breaking change had to be implemented for Smart Meter (ZMNHTD). The capabilities `onoff` and `meter_power` have been removed which can break Flows using these capabilities.

Version 2.0.10
* Added support for ZMNHWD (Flush RGBW Dimmer)
* Fixed an issue that might prevent power meter values from being updated

Version 2.0.8
* Fixed an issue that caused connected devices to dim to full brightness when being turned on by Homey (via onoff capability)
* Fixed an issue for the Flush Shutters (ZMNHCD and ZMNHOD) that might cause weird behaviour (especially i.c.w. the invert direction setting)

Version 2.0.7
* Removed ZMNHID (Flush On/Off Thermostat) Flow Cards for input 1/2/3 due to firmware issue with device

Version 2.0.6
* Fixed an issue that could cause the "invert direction" setting of some devices to malfunction

Version 2.0.5
* Update app icon

Version 2.0.4
* Added support for ZMNHYD (Smart Plug)
* Added support for ZMNHKD (Flush PWM Thermostat)

Version 2.0.3
* Added support for ZMNHID (Flush On/Off Thermostat)

Version 2.0.1
* Updated dependencies
* Updated power meter report parsers to accommodate for incomplete reports

Version 2.0.0
* Major update to SDKv2 (please note, it is advised to re-pair your devices, otherwise some functionality might break)
* Added support for roller shutters (ZMNHCD and ZMNHOD)
* Added missing configuration parameters
* Added input functionality (please note, this might require some configuration of the device, refer to the device manual, the device settings and the Flow Card hints for more information)
* Added dim duration ability on Flow Cards of devices supporting 'dimming over time'
* Added 'reset power meter' Flow Cards and button capabilities to devices that support this functionality
* Added 'calibration' button capabilities to devices that support this functionality

Version 1.1.6
* Minor bug fixes for dimming duration setting (parameter 66) for ZMNHVD1, ZMNHSD1 and ZMNHDA2

Version 1.1.0
* Add support for ZMNHDD1 (Flush Dimmer)
* Add support for ZMNHBD1 (Flush 2 Relays)
* Add support for ZMNHAD1 (Flush 1 Relay)
* Add support for ZMNHDA2 (Flush Dimmer)
* Add support for ZMNHND1 (Flush 1D Relay)
* Add support for ZMNHVD1 (Flush Dimmer 0 - 10V)
* Add support for ZMNHKD1 (Flush Heat & Cool Thermostat)
* Add support for ZMNHIA2 (Flush On/Off Thermostat)
* Add support for ZMNHTD1 (Smart Meter)
* Add support for ZMNHSD1 (DIN Dimmer)
* Known limitations:
    * ZMNHDD1 (Flush Dimmer): input 2 and 3 can not be used in Flows
    * ZMNHBD1 (Flush 2 Relays): 
        * input 1 and 2 can not be used in Flows
        * power consumption for multichannel nodes not reporting
        * on/off state for multichannel nodes not reporting
    * ZMNHAD1 (Flush 1 Relay): input 2 and 3 can not be used in Flows
    * ZMNHKD1 (Flush Heat & Cool Thermostat): input 2 and 3 can not be used in Flows
    * ZMNHIA2 (Flush On/Off Thermostat): input 2 and 3 can not be used in Flows
    * ZMNHSD1 (DIN Dimmer): input 1 can not be used in Flows
