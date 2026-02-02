# Safe YubiKey - Hardware-Secured Safe

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

A desktop application for hardware-secured Safe transactions using YubiKey P256 signatures with native on-chain verification.

## Overview

This Electron app enables you to create and manage a Safe wallet where all transaction signatures are performed by a **YubiKey hardware security key**. The private key never leaves the YubiKey - it's generated on-device and all cryptographic operations happen in the secure element.

### Key Features

- **Hardware-secured signing**: P256 private key lives exclusively on the YubiKey
- **No key extraction**: The YubiKey's PIV applet prevents private key export
- **Native P256 verification**: Uses the secp256r1 precompile (EIP-7212)
- **No modules required**: Direct Safe signature support (unofficial, potential Safe 1.6.0)
- **Relayer support**: Deploy and execute transactions without MetaMask
- **Sepolia testnet**: Currently configured for testing on Sepolia

### Important: Experimental Status

This app uses an **unofficial Safe singleton** that includes native P256 signature support. This feature:

- Is **not yet part of official Safe releases** (current official is v1.4.1)
- May be included in a **future Safe v1.6.0** release
- Requires the **EIP-7212 precompile** (available on Sepolia after Fusaka upgrade)
- Should be **audited before mainnet use**

## How It Works

### The Flow

```
1. Connect YubiKey     → PC/SC establishes connection to PIV applet
2. Enter PIN           → Authenticates to the YubiKey (required for crypto ops)
3. Generate/Read Key   → P256 key pair in slot 9A, public key stored as X.509 cert
4. Deploy Safe         → Creates a Safe with your P256-derived address as owner
5. Create Transaction  → Build a Safe transaction (e.g., send ETH)
6. Sign with YubiKey   → Hash is signed by YubiKey's P256 key
7. Execute             → Transaction verified on-chain via RIP-7212 precompile
```

## YubiKey Details

### Where the Key Lives

The P256 key pair is stored in the YubiKey's **PIV (Personal Identity Verification) applet**:

| Component       | Location                                     | Exportable? |
| --------------- | -------------------------------------------- | ----------- |
| **Private Key** | YubiKey secure element, Slot 9A              | ❌ Never    |
| **Public Key**  | YubiKey slot 9A (as X.509 certificate)       | ✅ Yes      |
| **Certificate** | Self-signed X.509 cert containing public key | ✅ Yes      |

### Why Slot 9A?

YubiKey's PIV applet has 4 standard slots, each designed for different purposes:

| Slot   | Name                | PIN Required | Typical Use                              |
| ------ | ------------------- | ------------ | ---------------------------------------- |
| **9A** | Authentication      | ✅ Always    | Client authentication, general signing   |
| 9C     | Digital Signature   | ✅ Always    | Document/email signing (non-repudiation) |
| 9D     | Key Management      | ✅ Always    | Encrypting/decrypting data               |
| 9E     | Card Authentication | ❌ Never     | Physical access (building entry)         |

**We use Slot 9A because:**

1. **PIN Protection**: Slot 9A always requires PIN verification before signing, ensuring only you can authorize transactions
2. **General Purpose**: Designed for authentication use cases, which aligns with transaction signing
3. **Standard Compliance**: Follows NIST SP 800-73 PIV standard
4. **No Export**: Private keys in PIV slots cannot be extracted - they're generated and used only on-device
5. **Touch Not Required**: Unlike FIDO2, PIV slots don't require physical touch for each operation (PIN is sufficient)

**Not Slot 9E** because it doesn't require PIN (anyone with physical access could sign).
**Not Slot 9C** because it's intended for non-repudiation signatures with stricter policies.

### PIN Management

| PIN Type           | Default              | Purpose                            |
| ------------------ | -------------------- | ---------------------------------- |
| **PIV PIN**        | `123456`             | Required to sign with the key      |
| **PUK**            | `12345678`           | Unlock PIN after too many failures |
| **Management Key** | Default 3DES/AES key | Required for key generation        |

**Important**: Change default PIN/PUK for production use:

```bash
ykman piv access change-pin
ykman piv access change-puk
```

### Key Generation Process

When you click "Generate New Key", the app:

1. **Authenticates** with the management key (AES192 mutual auth)
2. **Generates** a P256 key pair on-device via APDU command
3. **Creates** a self-signed X.509 certificate containing the public key
4. **Stores** the certificate in slot 9A using `ykman` CLI
5. **Reads back** the public key to derive the Ethereum address

The public key is extracted from the certificate and used to derive the Safe owner address:

```
owner_address = keccak256(pubkey.x || pubkey.y)[12:32]
```

### Signing Process

When you sign a Safe transaction:

1. **Transaction hash** is calculated (EIP-712 Safe transaction hash)
2. **PIN is verified** on YubiKey (cached for session)
3. **ECDSA signature** is performed in YubiKey's secure element
4. **DER signature** is returned and parsed to (r, s) values
5. **Low-S normalization** is applied (required by Safe contract)
6. **Signature is formatted** with v=2 to indicate P256

### Portability

Since the private key lives exclusively on the YubiKey:

- **No local storage**: No keys, caches, or secrets on your computer
- **Use anywhere**: Plug YubiKey into any computer with this app
- **Hardware bound**: Only your physical YubiKey can sign transactions

## Safe Contract Integration

### EIP-7212: The P256 Precompile

[EIP-7212](https://eips.ethereum.org/EIPS/eip-7212) adds a precompile for secp256r1 (P256) curve signature verification at address `0x100`. This was included in Ethereum's **Fusaka upgrade** and is now available on Sepolia.

```
Precompile Address: 0x0000000000000000000000000000000000000100

Input:  hash (32 bytes) || r (32 bytes) || s (32 bytes) || x (32 bytes) || y (32 bytes)
Output: 0x01 if valid, 0x00 if invalid
```

### Native P256 Support in Safe (Unofficial)

Our Safe singleton extends the official Safe contract to support P256 signatures natively using signature type `v=2`. This feature:

- Is based on a [pending PR](https://github.com/safe-global/safe-smart-account/pull/860) to Safe
- May be included in **Safe v1.6.0** (not yet released)
- Uses the EIP-7212 precompile for on-chain verification
- Requires **no additional modules** - just the core Safe contract

```
Signature Format (v=2):
├── Static Part (65 bytes)
│   ├── bytes 0-31:   Signer address (padded to 32 bytes)
│   ├── bytes 32-63:  Offset to dynamic data (0x41 = 65)
│   └── byte 64:      v = 2 (indicates P256)
│
└── Dynamic Part (128 bytes)
    ├── bytes 0-31:   Signature r
    ├── bytes 32-63:  Signature s
    ├── bytes 64-95:  Public key x
    └── bytes 96-127: Public key y
```

### Contract Addresses (Sepolia)

| Contract           | Address                                      | Notes                                |
| ------------------ | -------------------------------------------- | ------------------------------------ |
| **Safe Singleton** | `0x35F315F38234e8358B3907C8F26b5f440CEbb53F` | ⚠️ Unofficial, includes P256 support |
| Proxy Factory      | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` | Official Safe factory [1.4.1]        |
| Fallback Handler   | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` | Official Safe handler [1.4.1]        |
| P256 Precompile    | `0x0000000000000000000000000000000000000100` | EIP-7212, Fusaka upgrade             |

> **⚠️ Warning**: The Safe singleton used here is **unofficial** and deployed from unaudited code. Do not use on mainnet without proper security review.

## Why Native P256, Not Passkeys?

This app uses **native P256 signature support** in the Safe contract rather than the Safe Passkey Module. Here's why:

### Native vs Module Approach

| Aspect             | Native P256 (our approach)      | Passkey Module                      |
| ------------------ | ------------------------------- | ----------------------------------- |
| **Attack surface** | Minimal - core Safe code only   | Additional module contract to audit |
| **Dependencies**   | Just Safe + RIP-7212 precompile | Safe + Module + WebAuthn verifier   |
| **Gas cost**       | Lower (direct precompile call)  | Higher (module overhead)            |
| **Complexity**     | Simple signature format         | WebAuthn authenticator data parsing |
| **Upgrade risk**   | None - no module to upgrade     | Module bugs require migration       |

### Why Not WebAuthn/Passkeys?

While passkeys are excellent for web authentication, they introduce complexity for blockchain use:

1. **WebAuthn overhead**: Passkey signatures include authenticator data, client data JSON, and flags that must be parsed on-chain. Native P256 is just `(r, s, x, y)`.

2. **Browser dependency**: Passkeys require a browser's WebAuthn API. Our approach uses YubiKey's PIV applet directly via PC/SC - no browser needed.

3. **Module trust**: The Safe Passkey Module is additional code that must be:
   - Deployed and enabled on your Safe
   - Audited for security vulnerabilities
   - Maintained over time

4. **Simpler recovery**: With native P256, your Safe is a standard Safe with a P256 owner. No module state to worry about.

### The Principle: Less Code = Less Risk

```
Native P256 path:
  YubiKey → Sign hash → Safe.execTransaction() → RIP-7212 precompile
  (2 contracts: Safe + Precompile)

Passkey Module path:
  Browser → WebAuthn API → Sign with authenticator data →
  Safe.execTransaction() → Module → WebAuthn Verifier → P256 Verifier
  (4+ contracts: Safe + Module + Verifiers)
```

Every additional contract is a potential point of failure or vulnerability. Native integration minimizes this.

### Trade-offs

Native P256 does have some limitations:

- **No attestation**: WebAuthn provides device attestation; PIV doesn't
- **Manual key management**: No cloud sync like passkeys offer
- **Less portable**: Requires this specific app (not any WebAuthn-enabled site)

For a high-security Safe wallet, we believe these trade-offs favor the simpler, native approach.

## Why Electron?

Browser WebUSB cannot access the YubiKey's PIV interface on macOS because:

- Chrome blocks CCID (smart card) devices in its security blocklist
- macOS system daemons claim exclusive device access

Electron solves this by using **PC/SC** (native smart card API) via the `pcsclite` library:

- Works with macOS/Linux/Windows smart card services
- Provides full access to PIV operations
- Is the standard way to interact with smart cards

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron App                             │
├─────────────────────────────────────────────────────────────────┤
│  Renderer (React)              │  Main Process (Node.js)        │
│  ┌───────────────────────┐     │  ┌─────────────────────────┐   │
│  │ UI Components         │◄────┼──┤ IPC Handlers            │   │
│  │ - StepConnect         │     │  │ - yubikey:connect       │   │
│  │ - StepGenerateKey     │     │  │ - yubikey:verifyPin     │   │
│  │ - StepDeploySafe      │     │  │ - yubikey:generateKey   │   │
│  │ - StepCreateTx        │     │  │ - yubikey:signHash      │   │
│  │ - StepSign            │     │  │ - relayer:deploySafe    │   │
│  │ - StepExecute         │     │  │ - relayer:execute...    │   │
│  └───────────────────────┘     │  └───────────┬─────────────┘   │
│                                │              │                  │
│  ┌───────────────────────┐     │  ┌───────────▼─────────────┐   │
│  │ Crypto/Safe Utilities │     │  │ YubiKeyPCSC             │   │
│  │ - EIP-712 hashing     │     │  │ - APDU commands         │   │
│  │ - Signature formatting│     │  │ - Certificate parsing   │   │
│  │ - Address derivation  │     │  │ - DER signature parsing │   │
│  └───────────────────────┘     │  └───────────┬─────────────┘   │
│                                │              │                  │
│  ┌───────────────────────┐     │  ┌───────────▼─────────────┐   │
│  │ Relayer               │     │  │ PC/SC Service           │   │
│  │ - Deploy Safe         │     │  │ (pcscd / smartcard.dll) │   │
│  │ - Execute transactions│     │  └───────────┬─────────────┘   │
│  │ - Pay gas fees        │     │              │                  │
│  └───────────────────────┘     │  ┌───────────▼─────────────┐   │
│                                │  │ YubiKey PIV Applet      │   │
│                                │  │ ┌─────────────────────┐ │   │
│                                │  │ │ Slot 9A             │ │   │
│                                │  │ │ - P256 Private Key  │ │   │
│                                │  │ │ - X.509 Certificate │ │   │
│                                │  │ └─────────────────────┘ │   │
│                                │  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Requirements

- **Node.js** 18+
- **YubiKey 5 series** with PIV support
- **ykman** CLI tool (YubiKey Manager)
- **macOS**, Windows, or Linux
- **Sepolia ETH** for the relayer (get from faucet)

### Installing ykman

```bash
# macOS
brew install ykman

# Ubuntu/Debian
sudo apt install yubikey-manager

# Windows
# Download from https://www.yubico.com/support/download/yubikey-manager/
```

## Installation

```bash
# Install dependencies (automatically rebuilds native modules)
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Usage

### 1. Connect YubiKey

Insert your YubiKey and click "Connect YubiKey". The app uses PC/SC to establish a connection.

### 2. Verify PIN & Generate Key

Enter your PIV PIN (default: `123456`). The app will check for an existing P256 key or let you generate a new one.

### 3. Select or Deploy Safe

Choose an existing Safe or deploy a new one. You'll need to configure a relayer with Sepolia ETH to pay for gas.

### 4. Create Transaction

Create an ETH transfer from your Safe. The app calculates the EIP-712 transaction hash.

### 5. Sign with YubiKey

Click "Sign with YubiKey" - the hash is sent to the YubiKey for ECDSA signing.

### 6. Execute Transaction

Configure the relayer and execute. The transaction is submitted with the P256 signature.

## Relayer

The relayer is a simple mechanism to pay for gas without requiring MetaMask:

1. Enter a Sepolia-funded private key
2. The app uses this key to submit transactions
3. Get Sepolia ETH from: https://sepolia-faucet.pk910.de

**Note**: The relayer key is only used for gas payment, not for signing Safe transactions.

## Security Model

### What This App Protects Against

| Threat                     | Mitigation                                       |
| -------------------------- | ------------------------------------------------ |
| **Private key theft**      | Key never leaves YubiKey's secure element        |
| **Malware key extraction** | PIV applet prevents key export by design         |
| **Unauthorized signing**   | PIN required for every signing session           |
| **Remote attacks**         | Physical YubiKey possession required             |
| **Relayer compromise**     | Relayer can only pay gas, not control Safe funds |
| **Signature replay**       | Safe nonce prevents replay attacks               |

### Trust Assumptions

This implementation assumes you trust:

| Component               | What You're Trusting                                      |
| ----------------------- | --------------------------------------------------------- |
| **YubiKey hardware**    | Yubico's secure element implementation, no key leakage    |
| **Safe contract**       | The singleton contract code verifies signatures correctly |
| **RIP-7212 precompile** | Ethereum's P256 verification is correct                   |
| **RPC endpoint**        | Returns accurate blockchain state (can be verified)       |
| **This application**    | Constructs valid transactions, doesn't modify data        |
| **Your local machine**  | No keylogger capturing PIN, display not manipulated       |

### Known Limitations & Risks

| Limitation                | Risk                                         | Mitigation                               |
| ------------------------- | -------------------------------------------- | ---------------------------------------- |
| **Single owner**          | No recovery if YubiKey is lost               | Use multisig with additional owners      |
| **Default PIN (123456)**  | Anyone with physical access can sign         | Change PIN immediately                   |
| **Blind signing**         | User trusts app to show correct tx data      | Verify transaction hash independently    |
| **Session PIN cache**     | PIN verified once per session                | Re-insert YubiKey to require PIN again   |
| **One key per slot**      | Can't have multiple Safe owner keys          | Use multiple YubiKeys or different slots |
| **Testnet only**          | Not tested on mainnet                        | Audit before mainnet use                 |
| **Custom Safe singleton** | Not officially audited/deployed by Safe team | Audit the contract yourself              |
| **No tx simulation**      | Transaction might fail on-chain              | Add simulation before signing            |

### What This App Does NOT Protect Against

- **Physical theft of YubiKey** + knowledge of PIN
- **Compromised local machine** that modifies displayed transaction data
- **Supply chain attacks** on YubiKey hardware
- **Side-channel attacks** on the YubiKey (requires physical access + expertise)
- **Social engineering** to reveal your PIN
- **Loss of YubiKey** without backup/recovery mechanism

### Recommendations for Production

1. **Change default PIN/PUK immediately**

   ```bash
   ykman piv access change-pin
   ykman piv access change-puk
   ```

2. **Use a strong PIN** (8 characters recommended, alphanumeric supported)

3. **Use multisig** - Add additional owners (EOA or another hardware key) for recovery

4. **Dedicated YubiKey** - Use a separate YubiKey for Safe operations

5. **Verify transaction hashes** - Cross-check the displayed hash before signing

6. **Audit the Safe singleton** - The contract at `0x35F315F...` is unofficial

7. **Use your own RPC** - Don't rely solely on public endpoints for mainnet

8. **Store YubiKey securely** - Treat it like a hardware wallet

9. **Test recovery** - Ensure you can recover funds if YubiKey is lost

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TRUST BOUNDARY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐      ┌──────────────────┐                 │
│  │   Your Machine   │      │    YubiKey       │                 │
│  │                  │      │  ┌────────────┐  │                 │
│  │  ┌────────────┐  │      │  │ Secure     │  │                 │
│  │  │ Electron   │  │ PIN  │  │ Element    │  │                 │
│  │  │ App        │──┼──────┼──┤            │  │                 │
│  │  │            │  │      │  │ P256 Key   │  │                 │
│  │  │ Shows hash │  │ Sig  │  │ (slot 9A)  │  │                 │
│  │  │ to sign    │◄─┼──────┼──┤            │  │                 │
│  │  └────────────┘  │      │  └────────────┘  │                 │
│  │        │         │      └──────────────────┘                 │
│  │        ▼         │                                            │
│  │  ┌────────────┐  │      ┌──────────────────┐                 │
│  │  │ Relayer    │  │      │   Ethereum       │                 │
│  │  │ (gas only) │──┼──────┼──┤                │                 │
│  │  └────────────┘  │      │  │ Safe Contract │                 │
│  └──────────────────┘      │  │ + RIP-7212    │                 │
│                            └──────────────────┘                 │
│                                                                  │
│  Relayer private key: In memory only (not persisted)            │
│  YubiKey PIN: Verified by YubiKey, not stored by app            │
│  Transaction data: Constructed locally, verified on-chain       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Type check
npm run typecheck

# Development mode with hot reload
npm run dev

# Build for production
npm run build
```

## Starting Fresh / YubiKey Reset

If you want to start from scratch with a new key, you have several options:

### Option 1: Delete Only the Key in Slot 9A

This removes just the P256 key and certificate, leaving other PIV data intact:

```bash
# Delete the key and certificate from slot 9A
ykman piv keys delete 9a
ykman piv certificates delete 9a
```

After this, the app will prompt you to generate a new key.

### Option 2: Reset the Entire PIV Applet

This resets ALL PIV data (all slots, PIN, PUK, management key) to factory defaults:

```bash
# Reset PIV to factory state (requires blocking PIN and PUK first)
# WARNING: This deletes ALL keys in ALL slots!

# First, block the PIN (enter wrong PIN 3 times)
ykman piv access verify-pin --pin 00000000
ykman piv access verify-pin --pin 00000000
ykman piv access verify-pin --pin 00000000

# Then, block the PUK (enter wrong PUK 3 times)
ykman piv access unblock-pin --puk 00000000 --new-pin 000000
ykman piv access unblock-pin --puk 00000000 --new-pin 000000
ykman piv access unblock-pin --puk 00000000 --new-pin 000000

# Now reset is possible
ykman piv reset
```

After reset, defaults are restored:

- PIN: `123456`
- PUK: `12345678`
- Management Key: default 3DES key

### Checking Current State

```bash
# View what's in slot 9A
ykman piv info

# View the certificate details
ykman piv certificates export 9a - | openssl x509 -text -noout
```

## Troubleshooting

### "No YubiKey found"

- Ensure YubiKey is inserted
- Check if PC/SC service is running (`pcscd` on Linux)
- Try removing and reinserting the YubiKey

### "PIN verification failed"

- Default PIN is `123456`
- After 3 failures, PIN is blocked (use PUK to reset)

### "Key generation failed"

- Ensure `ykman` CLI is installed: `brew install ykman`
- The app uses `ykman` to store the certificate

### "Transaction failed: GS027/GS028"

- GS027: Invalid signature format
- GS028: Signature verification failed
- Check that you're using our unofficial Safe singleton with P256 support
- Verify the EIP-7212 precompile is available on your network

## Technical References

### Ethereum

- [EIP-7212 - secp256r1 Precompile](https://eips.ethereum.org/EIPS/eip-7212) - P256 curve verification precompile
- [Fusaka Upgrade](https://ethereum.org/en/history/) - Network upgrade that activated EIP-7212

### Safe

- [Safe Smart Account](https://github.com/safe-global/safe-smart-account) - Official Safe contracts
- [P256 Support PR](https://github.com/safe-global/safe-smart-account/pull/860) - Native P256 signature support (pending)

### YubiKey

- [YubiKey PIV Application](https://developers.yubico.com/PIV/) - PIV implementation guide
- [NIST SP 800-73 (PIV)](https://csrc.nist.gov/publications/detail/sp/800-73/4/final) - PIV standard specification

## License

MIT
