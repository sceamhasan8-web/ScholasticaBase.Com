const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const url = require('url');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'ScholasticBase',
    icon: path.join(__dirname, '../public/appicon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#064E3B',
    show: false, // Don't show until ready to avoid white flash
  });

  // Load the built React app from the dist folder
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadURL(
    url.format({
      pathname: indexPath,
      protocol: 'file:',
      slashes: true,
    })
  );

  // Show window once the content is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (openUrl.startsWith('http')) {
      shell.openExternal(openUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Build custom application menu
function buildMenu() {
  const template = [
    {
      label: 'ScholasticBase',
      submenu: [
        { label: 'About ScholasticBase', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle hooks
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  // On macOS, re-create the window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
