# Safe YubiKey

> **⚠️ PROTOTYPE / EXPERIMENTAL**
>
> This project is a **proof-of-concept** and should be treated as experimental software.
> It is intended for research, learning, and testing purposes only.
>
> **DO NOT use this in production or with real funds without:**
> - Thorough security audits of all components
> - Professional review of the cryptographic implementations
> - Testing on testnets first
>
> The authors are not responsible for any loss of funds or security breaches.

---

Hardware-secured Safe wallet using YubiKey P256 signatures.

## Project

This repository contains an Electron desktop application that enables:

- **Hardware key storage**: P256 private key lives exclusively on YubiKey
- **Transaction signing**: Sign Safe transactions with YubiKey PIV applet
- **Native P256 verification**: Uses Ethereum's EIP-7951 precompile

## Getting Started

```bash
cd safe-yubikey-electron
npm install
npm run dev
```

See [safe-yubikey-electron/README.md](./safe-yubikey-electron/README.md) for full documentation.

## Requirements

- Node.js 18+
- YubiKey 5 series with PIV support
- ykman CLI tool

## License

MIT
