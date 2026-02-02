/**
 * Main Process Entry Point
 *
 * Sets up the Electron app, creates the main window,
 * and registers IPC handlers for YubiKey and EVM operations.
 */

import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';

import { YubiKeyPCSC } from './yubikey-pcsc';
import { EvmConnector, SafeTransactionParams } from './evm-connector';

// ============================================================================
// Globals
// ============================================================================

let yubikey: YubiKeyPCSC | null = null;
let evmConnector: EvmConnector | null = null;

// ============================================================================
// Window Creation
// ============================================================================

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    if (is.dev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ============================================================================
// IPC Handlers
// ============================================================================

function registerIpcHandlers(): void {
  // --------------------------------------------------------------------------
  // YubiKey Handlers
  // --------------------------------------------------------------------------

  ipcMain.handle('yubikey:connect', async () => {
    if (!yubikey) {
      return { success: false, error: 'YubiKey handler not initialized' };
    }
    return yubikey.connect();
  });

  ipcMain.handle('yubikey:disconnect', async () => {
    if (!yubikey) {
      return { success: false, error: 'YubiKey handler not initialized' };
    }
    return yubikey.disconnect();
  });

  ipcMain.handle('yubikey:getInfo', async () => {
    if (!yubikey) {
      return { success: false, error: 'YubiKey handler not initialized' };
    }
    return yubikey.getInfo();
  });

  ipcMain.handle('yubikey:verifyPin', async (_event, pin: string) => {
    if (!yubikey) {
      return { success: false, error: 'YubiKey handler not initialized' };
    }
    return yubikey.verifyPin(pin);
  });

  ipcMain.handle('yubikey:generateKey', async () => {
    if (!yubikey) {
      return { success: false, error: 'YubiKey handler not initialized' };
    }
    return yubikey.generateP256Key();
  });

  ipcMain.handle('yubikey:readPublicKey', async () => {
    if (!yubikey) {
      return { success: false, error: 'YubiKey handler not initialized' };
    }
    return yubikey.readPublicKeyFromSlot();
  });

  ipcMain.handle('yubikey:signHash', async (_event, hashHex: string) => {
    if (!yubikey) {
      return { success: false, error: 'YubiKey handler not initialized' };
    }
    return yubikey.signHash(hashHex);
  });

  // --------------------------------------------------------------------------
  // EVM Connector Handlers (exposed as "relayer" for backward compatibility)
  // --------------------------------------------------------------------------

  ipcMain.handle('relayer:setRpcUrl', async (_event, rpcUrl: string) => {
    if (!evmConnector) {
      return { success: false, error: 'EVM connector not initialized' };
    }
    return evmConnector.setRpcUrl(rpcUrl);
  });

  ipcMain.handle('relayer:getRpcUrl', async () => {
    if (!evmConnector) {
      return { success: false, error: 'EVM connector not initialized' };
    }
    return evmConnector.getRpcUrl();
  });

  ipcMain.handle('relayer:setPrivateKey', async (_event, privateKey: string) => {
    if (!evmConnector) {
      return { success: false, error: 'EVM connector not initialized' };
    }
    return evmConnector.setPrivateKey(privateKey);
  });

  ipcMain.handle('relayer:getBalance', async () => {
    if (!evmConnector) {
      return { success: false, error: 'EVM connector not initialized' };
    }
    return evmConnector.getBalance();
  });

  ipcMain.handle('relayer:predictSafeAddress', async (_event, ownerAddress: string) => {
    if (!evmConnector) {
      return { success: false, error: 'EVM connector not initialized' };
    }
    return evmConnector.predictSafeAddress(ownerAddress);
  });

  ipcMain.handle('relayer:isSafeDeployed', async (_event, safeAddress: string) => {
    if (!evmConnector) {
      return { success: false, error: 'EVM connector not initialized' };
    }
    return evmConnector.isSafeDeployed(safeAddress);
  });

  ipcMain.handle('relayer:deploySafe', async (_event, ownerAddress: string) => {
    if (!evmConnector) {
      return { success: false, error: 'EVM connector not initialized' };
    }
    return evmConnector.deploySafe(ownerAddress);
  });

  ipcMain.handle(
    'relayer:executeTransaction',
    async (_event, safeAddress: string, params: SafeTransactionParams) => {
      if (!evmConnector) {
        return { success: false, error: 'EVM connector not initialized' };
      }
      return evmConnector.executeTransaction(safeAddress, params);
    }
  );
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.safe-yubikey');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize services
  yubikey = new YubiKeyPCSC();
  evmConnector = new EvmConnector();

  // Register IPC handlers
  registerIpcHandlers();

  // Create main window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (yubikey) {
    yubikey.disconnect();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
