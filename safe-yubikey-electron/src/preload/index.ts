/**
 * Preload Script
 *
 * Exposes Electron APIs to the renderer process via contextBridge.
 * This is the secure bridge between the main process and renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================================================
// YubiKey API
// ============================================================================

export type YubiKeyApi = {
  connect: () => Promise<any>;
  disconnect: () => Promise<any>;
  getInfo: () => Promise<any>;
  verifyPin: (pin: string) => Promise<any>;
  generateKey: () => Promise<any>;
  readPublicKey: () => Promise<any>;
  signHash: (hashHex: string) => Promise<any>;
};

const yubiKeyApi: YubiKeyApi = {
  /**
   * Connect to YubiKey.
   */
  connect: () => ipcRenderer.invoke('yubikey:connect'),

  /**
   * Disconnect from YubiKey.
   */
  disconnect: () => ipcRenderer.invoke('yubikey:disconnect'),

  /**
   * Get YubiKey info.
   */
  getInfo: () => ipcRenderer.invoke('yubikey:getInfo'),

  /**
   * Verify PIN.
   */
  verifyPin: (pin: string) => ipcRenderer.invoke('yubikey:verifyPin', pin),

  /**
   * Generate P256 key in slot 9A.
   */
  generateKey: () => ipcRenderer.invoke('yubikey:generateKey'),

  /**
   * Read existing public key from slot 9A (without generating).
   */
  readPublicKey: () => ipcRenderer.invoke('yubikey:readPublicKey'),

  /**
   * Sign a 32-byte hash.
   */
  signHash: (hashHex: string) => ipcRenderer.invoke('yubikey:signHash', hashHex),
};

// ============================================================================
// Relayer API
// ============================================================================

export type RelayerApi = {
  setRpcUrl: (rpcUrl: string) => Promise<any>;
  getRpcUrl: () => Promise<any>;
  setPrivateKey: (privateKey: string) => Promise<any>;
  getBalance: () => Promise<any>;
  predictSafeAddress: (ownerAddress: string) => Promise<any>;
  isSafeDeployed: (safeAddress: string) => Promise<any>;
  deploySafe: (ownerAddress: string) => Promise<any>;
  executeTransaction: (safeAddress: string, params: any) => Promise<any>;
};

const relayerApi: RelayerApi = {
  /**
   * Set RPC URL.
   */
  setRpcUrl: (rpcUrl: string) => ipcRenderer.invoke('relayer:setRpcUrl', rpcUrl),

  /**
   * Get current RPC URL.
   */
  getRpcUrl: () => ipcRenderer.invoke('relayer:getRpcUrl'),

  /**
   * Set relayer private key.
   */
  setPrivateKey: (privateKey: string) => ipcRenderer.invoke('relayer:setPrivateKey', privateKey),

  /**
   * Get relayer balance.
   */
  getBalance: () => ipcRenderer.invoke('relayer:getBalance'),

  /**
   * Predict Safe address.
   */
  predictSafeAddress: (ownerAddress: string) =>
    ipcRenderer.invoke('relayer:predictSafeAddress', ownerAddress),

  /**
   * Check if Safe is deployed.
   */
  isSafeDeployed: (safeAddress: string) =>
    ipcRenderer.invoke('relayer:isSafeDeployed', safeAddress),

  /**
   * Deploy Safe.
   */
  deploySafe: (ownerAddress: string) => ipcRenderer.invoke('relayer:deploySafe', ownerAddress),

  /**
   * Execute Safe transaction.
   */
  executeTransaction: (safeAddress: string, params: any) =>
    ipcRenderer.invoke('relayer:executeTransaction', safeAddress, params),
};

// ============================================================================
// Expose to Renderer
// ============================================================================

contextBridge.exposeInMainWorld('yubiKey', yubiKeyApi);
contextBridge.exposeInMainWorld('relayer', relayerApi);
