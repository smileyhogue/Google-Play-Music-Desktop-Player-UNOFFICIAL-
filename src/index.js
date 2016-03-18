import { app, BrowserWindow, screen } from 'electron';
import { argv } from 'yargs';

import configureApp from './main/configureApp';
import generateBrowserConfig from './main/configureBrowser';

import EmitterClass from './main/utils/Emitter';
import SettingsClass from './main/utils/Settings';
import WindowManagerClass from './main/utils/WindowManager';
import PlaybackAPIClass from './main/utils/PlaybackAPI';
import I3IpcHelperClass from './main/utils/I3IpcHelper';

import handleStartupEvent from './squirrel';

(() => {
  if (handleStartupEvent()) {
    return;
  }

  global.DEV_MODE = argv.development || argv.dev;

  configureApp(app);

  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  let mainWindow = null;

  // DEV: Make the app single instance
  const shouldQuit = app.makeSingleInstance(() => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
      mainWindow.setSkipTaskbar(false);
      if (app.dock && app.dock.show) app.dock.show();
    }
  });

  if (shouldQuit) {
    app.quit();
    return;
  }

  global.Emitter = new EmitterClass();
  global.WindowManager = new WindowManagerClass();
  global.Settings = new SettingsClass();
  global.PlaybackAPI = new PlaybackAPIClass();

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // This method will be called when Electron has finished
  //hello
  // initialization and is ready to create browser windows.
  app.on('ready', () => {
    mainWindow = new BrowserWindow(generateBrowserConfig());
    global.mainWindowID = WindowManager.add(mainWindow, 'main');

    const position = Settings.get('position');
    let inBounds = false;
    screen.getAllDisplays().forEach((display) => {
      if (position[0] >= display.workArea.x &&
          position[0] <= display.workArea.x + display.workArea.width &&
          position[1] >= display.workArea.y &&
          position[1] <= display.workArea.y + display.workArea.height) {
        inBounds = true;
      }
    });

    let size = Settings.get('size');
    size = size || [1200, 800];

    mainWindow.setSize(...size);
    if (position && inBounds) {
      mainWindow.setPosition(...position);
    } else {
      mainWindow.center();
    }

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/public_html/index.html`);
    require('./main/features');
    require('./old_win32');

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      mainWindow = null;
      PlaybackAPI.reset();
    });

    // setup i3 listener
    const I3IpcHelper = new I3IpcHelperClass();
    I3IpcHelper.setupEventListener();
  });

  app.on('before-quit', () => {
    global.quiting = true;
  });
})();
