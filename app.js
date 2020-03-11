'use strict';

const Homey = require('homey');
const Log = require('homey-log').Log;

/**
 * TODO: remove migration logic after this version has been stable for a while
 */
class QubinoApp extends Homey.App {
  onInit() {
    this.log(`${Homey.manifest.id} running...`);
  }
}

module.exports = QubinoApp;
