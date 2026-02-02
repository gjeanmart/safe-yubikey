import type { YubiKeyApi, RelayerApi } from './index';

declare global {
  interface Window {
    yubiKey: YubiKeyApi;
    relayer: RelayerApi;
  }
}

export {};
