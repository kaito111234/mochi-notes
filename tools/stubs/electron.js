'use strict';
// Stub 'electron' cho test node thuần (tools/test-core.js cài bằng Module._load hook). Chỉ đủ để require() không nổ.
const { EventEmitter } = require('events');

class Notification extends EventEmitter {
  constructor(opts) { super(); this.opts = opts || {}; Notification.created.push(this); }
  show() { this.shown = true; }
  close() { this.emit('close'); }
  static isSupported() { return true; }
}
Notification.created = [];

const app = Object.assign(new EventEmitter(), {
  getPath: () => process.env.MOCHI_DATA_DIR || require('os').tmpdir(),
  getVersion: () => '0.0.0-test',
  setPath() {}, setAppUserModelId() {}, requestSingleInstanceLock: () => true, quit() {}, isReady: () => true, isPackaged: false
});

const noop = () => {};
module.exports = {
  app, Notification,
  ipcMain: { handle: noop, on: noop, removeHandler: noop },
  BrowserWindow: class {}, Menu: { setApplicationMenu: noop }, Tray: class {}, globalShortcut: { register: noop, unregisterAll: noop },
  powerMonitor: new EventEmitter(), screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, nativeImage: { createFromPath: () => ({}) }
};
