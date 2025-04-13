const { contextBridge, ipcRenderer } = require('electron')

let validChannels = ['qmusiclrc_windows','qmusicinfo','qmusiccontrol','qmusiclrc'] // 配置合法消息名

contextBridge.exposeInMainWorld('ipcRenderer', {

  send: (channel, data) => {

    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  receive: (channel, func) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => func(...args))
    }
  }
})