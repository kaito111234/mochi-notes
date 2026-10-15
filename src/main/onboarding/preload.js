'use strict';
// Preload riêng của cửa sổ hướng dẫn lần đầu: chỉ lộ đúng 2 hàm, không đụng cầu nối chung.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mochi', {
  onboarding: {
    finish: how => ipcRenderer.send('onboarding:finish', how === 'skip' ? 'skip' : 'start'),
    close: () => ipcRenderer.send('onboarding:close')
  }
});
