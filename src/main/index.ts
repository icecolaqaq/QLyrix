import { app,BrowserWindow, ipcMain } from 'electron'
import { is,electronApp ,optimizer} from '@electron-toolkit/utils'
import { join } from 'path'
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import getqmusiclrc from './api';

let mainWindow: BrowserWindow | null = null
let musicWs:WebSocket;
let WebSocketclose = false;
let qMusicSupportport = 0;
let songId = 0;


app.whenReady().then(() => {
  createMainWindow()})

app.commandLine.appendSwitch('disable-web-security');

app.whenReady().then(() => {

  electronApp.setAppUserModelId('QLyrix')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
})

export function getmainWindow() {
  return mainWindow
}

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: true,
    },
  })
  
  mainWindow.on('show', () => {
    //mainWindow?.webContents.openDevTools()
    initmainWindow()
  })

  mainWindow.on("close", () => {
    WebSocketclose = true
    musicWs?.close()
    musicWs?.removeAllListeners();
    try {
      const execSync = require('child_process').execSync;
      execSync('taskkill /F /IM QMusicSupport.exe');
      console.log('QMusicSupport.exe 进程已结束');
    } catch (error) {
      console.error('结束 QMusicSupport.exe 进程时出错:', error);
    }
  })

  mainWindow.hookWindowMessage(278, function () {
    mainWindow?.setEnabled(false) //窗口禁用
    let timer = setTimeout(() => {
        mainWindow?.setEnabled(true)
      clearTimeout(timer)
    }, 100) // 延时太快会立刻启动，太慢会妨碍窗口其他操作，可自行测试最佳时间
    return true
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.setMenu(null)
    mainWindow?.setMaximizable(true)
    mainWindow?.setResizable(true)
    mainWindow?.show()
  })

  // 监听Esc
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false);
      event.preventDefault();
    }
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html`)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

async function initmainWindow() {
  let qMusicSupportState  = await QMusicSupportState()
  if(qMusicSupportState){
    connectToQMusicSupport(qMusicSupportport)
  }
}

let child;

async function QMusicSupportState() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = 200; 
    const timeout = 3000; 
    const portRegex = /ws:\/\/localhost:(\d+)/;
    const checker = setInterval(() => {
      try {
        const execSync = require('child_process').execSync;
        const output = execSync('tasklist /FI "IMAGENAME eq QMusicSupport.exe"').toString();
        const isRunning = output.includes('QMusicSupport.exe');

        if (isRunning) {
          clearInterval(checker);
          resolve(true);
        } else if (Date.now() - startTime >= timeout) {
          clearInterval(checker);
          resolve(false);
        }
      } catch (error) {
        clearInterval(checker);
        resolve(false);
      }
    }, checkInterval);

    try {
      let rootPath;
      if (is.dev) {
        rootPath = path.join(__dirname, '../../');
      } else {
        rootPath = path.join(process.resourcesPath, '../');
      }
      console.log('程序根目录:', rootPath);
      const QMusicSupportpath = path.join(rootPath, '/library/QMusicSupport/QMusicSupport.exe')
      console.log('QMusicSupportpath:', QMusicSupportpath);
      const QMusicSupportExists = fs.existsSync(QMusicSupportpath);
      const execSync = require('child_process').execSync;
      const output = execSync('tasklist /FI "IMAGENAME eq QMusicSupport.exe"').toString();
      console.log('QMusicSupportExists:', QMusicSupportExists);
      if (QMusicSupportExists && !output.includes('QMusicSupport.exe')) {
        child = spawn(QMusicSupportpath, [], { 
          windowsHide: true, 
          detached: true ,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        child.stdout.on('data', (data) => {
          const output = data.toString();
          const match = output.match(portRegex);
          if (match && match[1]) {
            qMusicSupportport = parseInt(match[1]);
            console.log(`检测到WebSocket端口号: ${qMusicSupportport}`);
          }
        });
        const portCheckInterval = setInterval(() => {
          if (qMusicSupportport > 0) {
            clearInterval(portCheckInterval);
            clearTimeout(portTimeout);
            resolve(true);
          }
        }, 500);

        const portTimeout = setTimeout(() => {
          clearInterval(portCheckInterval);
          console.error('端口号检测超时');
          resolve(false);
        }, 2000);
      }else{
         try {
          const execSync = require('child_process').execSync;
          execSync('taskkill /F /IM QMusicSupport.exe')
          QMusicSupportState()
        }catch (error) {
          console.error('结束 QMusicSupport.exe 进程时出错:', error);
        }
      }
    } catch (error) {
      mainWindow?.webContents.send("qmusicinfo", {server:0});
      console.error('进程启动失败:', error);
      resolve(false);
    }
  });
}

function setlyric(newsongId){
if(newsongId !== 0 && !isNaN(newsongId)){
    if(newsongId != songId){
      console.log('ID:',newsongId)
      songId = newsongId
      getqmusiclrc(newsongId).then((data) => {
        mainWindow?.webContents.send("qmusiclrc", data);
      })
    }
  }
}


function connectToQMusicSupport(port: number) {
    musicWs = new WebSocket('ws://127.0.0.1:' + port,{ reconect: false })
      musicWs.on('message', (data) => {
          try {
            const jsonString = new TextDecoder('utf-8').decode(data);
            const cleanedString = jsonString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const jsonData = JSON.parse(cleanedString);
            
              let latestMusicInfo = {
                  ...jsonData,
                  title: jsonData.title || '未知歌曲',
                  artist: jsonData.artist || '未知歌手',
                  album: jsonData.album || '未知专辑',
                  cover: jsonData.cover || '',
                  progress: Math.floor(jsonData.progress) || 0,
                  duration: Math.floor(jsonData.duration) || 0,
                  isPlaying: !jsonData.pause,
                  volume:jsonData.volume,
                  state:jsonData.state,
                  server:1,
                  quality:jsonData.quality,
              };
              setlyric(Number(jsonData.id))
              mainWindow?.webContents.send("qmusicinfo", latestMusicInfo);
          } catch (error) {
              mainWindow?.webContents.send("qmusicinfo", {server:0});
              console.error('解析音乐信息失败:', error);
          }
    });
  
  musicWs.on('open', () => {
      console.log('已连接到QMusicSupport WebSocket服务');
  });
  
  musicWs.on('close', () => {
    
      if(WebSocketclose){
        return;
      }else{
        setTimeout(() => {
          connectToQMusicSupport(qMusicSupportport);
        }, 3000);
      }
      mainWindow?.webContents.send("qmusicinfo", {server:0});
      console.log('与QMusicSupport WebSocket服务断开连接');
  });
  
  musicWs.on('error', () => {
      mainWindow?.webContents.send("qmusicinfo", {server:0});
      console.error('QMusicSupport WebSocket连接错误:');
  });

}

function sendToQMusicSupport(command: string, arg?: any) {
    const message = { command, arg };
    if(arg === undefined){
      message.arg = 0;
    }
    musicWs.send(JSON.stringify(message));
}


ipcMain.on('qmusiccontrol', (_, args) => {
  switch (args.functionname) {
    case 'play':
      sendToQMusicSupport('play');
      break;
    case 'stop':
      sendToQMusicSupport('stop');
      break;
    case 'next':
      sendToQMusicSupport('next');
      break;
    case 'prev':
      sendToQMusicSupport('prev');
      break;
    case 'volume':
      sendToQMusicSupport('volume', args.arg);
      break;
    case 'maximize':
      if(!mainWindow?.isMaximized()){
        mainWindow?.maximize()
      }else{
        mainWindow?.unmaximize()
      }
      break;
    case'minimize':
      mainWindow?.minimize()
      break;
    case'close':
      mainWindow?.close()
      break;
    case'fullscreen':
      if(!mainWindow?.isFullScreen()){
        mainWindow?.setFullScreen(true) 
      }else{
        mainWindow?.setFullScreen(false)
      }
      break;
    case 'progress': 
      if (typeof args.arg === 'number' && !Number.isInteger(args.arg)) {
        args.arg = Math.round(args.arg);
      }
      sendToQMusicSupport('progress', args.arg);
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        sendToQMusicSupport('stop');
      })();
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 800));
        sendToQMusicSupport('stop');
      })();

      case 'progress2':
      if (typeof args.arg === 'number' && !Number.isInteger(args.arg)) {
        args.arg = Math.round(args.arg);
      }
        sendToQMusicSupport('progress', args.arg);
      break;
  }
})