/**
 * YubiKey PC/SC Communication
 *
 * This module handles communication with YubiKey PIV applet via PC/SC.
 * It uses the pcsclite library to access the smart card interface.
 */

import pcsclite from 'pcsclite';

// ============================================================================
// Types
// ============================================================================

export type YubiKeyResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type YubiKeyInfo = {
  readerName: string;
  atr: string;
};

export type PublicKeyResult = {
  publicKeyHex: string; // 65 bytes: 04 || x || y
  x: string; // 32 bytes hex
  y: string; // 32 bytes hex
};

export type SignatureResult = {
  signatureDer: string; // DER-encoded signature
  r: string; // 32 bytes hex
  s: string; // 32 bytes hex
};

// ============================================================================
// PIV Constants
// ============================================================================

const PIV_AID = Buffer.from([0xa0, 0x00, 0x00, 0x03, 0x08]);

const PIV_SLOT = {
  AUTHENTICATION: 0x9a,
} as const;

const PIV_ALGORITHM = {
  ECCP256: 0x11,
} as const;

// PC/SC constants (use literal values for reliability)
const SCARD_SHARE_SHARED = 2;
const SCARD_PROTOCOL_T1 = 2;
const SCARD_STATE_PRESENT = 0x20; // 32 in decimal

// ============================================================================
// YubiKey PC/SC Handler
// ============================================================================

export class YubiKeyPCSC {
  private pcsc: pcsclite.PCSCLite | null = null;
  private reader: pcsclite.CardReader | null = null;
  private protocol: number | null = null;
  private isConnected: boolean = false;
  private connectPromiseResolved: boolean = false;

  /**
   * Connect to a YubiKey via PC/SC.
   */
  async connect(): Promise<YubiKeyResult<YubiKeyInfo>> {
    // If already connected, return success immediately
    if (this.isConnected && this.reader) {
      console.log('Already connected, returning existing connection');
      return {
        success: true,
        data: {
          readerName: this.reader.name,
          atr: '',
        },
      };
    }

    // Reset flags for fresh connection
    this.isConnected = false;
    this.connectPromiseResolved = false;

    // Clean up any existing connection
    if (this.reader) {
      try {
        this.reader.close();
      } catch (e) {
        console.log('Error closing reader:', e);
      }
      this.reader = null;
    }
    if (this.pcsc) {
      try {
        this.pcsc.close();
      } catch (e) {
        console.log('Error closing pcsc:', e);
      }
      this.pcsc = null;
    }
    this.protocol = null;

    return new Promise((resolve) => {
      try {
        this.pcsc = pcsclite();

        this.pcsc.on('reader', (reader) => {
          console.log('Reader detected:', reader.name);

          // Check if this is a YubiKey
          if (!reader.name.toLowerCase().includes('yubi')) {
            console.log('Not a YubiKey, skipping:', reader.name);
            return;
          }

          this.reader = reader;

          reader.on('status', (status) => {
            console.log('Reader status:', status);

            // Check if card is present
            const hasCard = (status.state & SCARD_STATE_PRESENT) !== 0;

            // Skip if already connected or promise already resolved
            if (this.isConnected || this.connectPromiseResolved) {
              console.log('Already connected, skipping reconnect');
              return;
            }

            if (hasCard) {
              // Connect to card with shared access and T=1 protocol
              reader.connect(
                { share_mode: SCARD_SHARE_SHARED, protocol: SCARD_PROTOCOL_T1 },
                (err, protocol) => {
                  if (err) {
                    console.error('Connect error:', err);
                    if (!this.connectPromiseResolved) {
                      this.connectPromiseResolved = true;
                      resolve({ success: false, error: err.message });
                    }
                    return;
                  }

                  // Only set protocol if we got a valid value
                  if (typeof protocol === 'number') {
                    this.protocol = protocol;
                    this.isConnected = true;
                  }
                  console.log('Connected with protocol:', this.protocol);

                  // Select PIV application
                  this.selectPIV()
                    .then((selectResult) => {
                      if (this.connectPromiseResolved) return;
                      this.connectPromiseResolved = true;

                      if (!selectResult.success) {
                        resolve(selectResult as YubiKeyResult<YubiKeyInfo>);
                        return;
                      }

                      resolve({
                        success: true,
                        data: {
                          readerName: reader.name,
                          atr: status.atr?.toString('hex') || '',
                        },
                      });
                    })
                    .catch((e) => {
                      if (this.connectPromiseResolved) return;
                      this.connectPromiseResolved = true;
                      resolve({
                        success: false,
                        error: e instanceof Error ? e.message : 'Unknown error',
                      });
                    });
                }
              );
            }
          });

          reader.on('error', (err) => {
            console.error('Reader error:', err);
          });

          reader.on('end', () => {
            console.log('Reader removed:', reader.name);
            this.reader = null;
          });
        });

        this.pcsc.on('error', (err) => {
          console.error('PC/SC error:', err);
          resolve({ success: false, error: err.message });
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.reader) {
            resolve({ success: false, error: 'No YubiKey found. Please insert your YubiKey.' });
          }
        }, 10000);
      } catch (e) {
        resolve({
          success: false,
          error: e instanceof Error ? e.message : 'Failed to initialize PC/SC',
        });
      }
    });
  }

  /**
   * Disconnect from YubiKey.
   */
  disconnect(): YubiKeyResult {
    try {
      if (this.reader) {
        this.reader.close();
        this.reader = null;
      }
      if (this.pcsc) {
        this.pcsc.close();
        this.pcsc = null;
      }
      this.protocol = null;
      this.isConnected = false;
      this.connectPromiseResolved = false;
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to disconnect',
      };
    }
  }

  /**
   * Temporarily disconnect to allow ykman access.
   */
  private disconnectForYkman(): void {
    console.log('Disconnecting for ykman access...');
    if (this.reader) {
      try {
        this.reader.close();
      } catch (_e) {
        // Ignore
      }
      this.reader = null;
    }
    if (this.pcsc) {
      try {
        this.pcsc.close();
      } catch (_e) {
        // Ignore
      }
      this.pcsc = null;
    }
    this.protocol = null;
    this.isConnected = false;
    this.connectPromiseResolved = false;
  }

  /**
   * Reconnect after ykman is done.
   */
  private async reconnectAfterYkman(): Promise<void> {
    console.log('Reconnecting after ykman...');
    // Wait a bit for ykman to release the device
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Reconnect
    await this.connect();
  }

  /**
   * Get YubiKey info.
   */
  getInfo(): YubiKeyResult<YubiKeyInfo> {
    if (!this.reader) {
      return { success: false, error: 'Not connected' };
    }
    return {
      success: true,
      data: {
        readerName: this.reader.name,
        atr: '',
      },
    };
  }

  /**
   * Select PIV application.
   */
  private async selectPIV(): Promise<YubiKeyResult> {
    // SELECT command: 00 A4 04 00 [len] [AID]
    const command = Buffer.concat([Buffer.from([0x00, 0xa4, 0x04, 0x00, PIV_AID.length]), PIV_AID]);

    const response = await this.transmit(command);
    if (!response.success) {
      return response;
    }

    // Check status word (last 2 bytes should be 90 00)
    const sw = response.data.slice(-2);
    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return {
        success: false,
        error: `Failed to select PIV: SW=${sw.toString('hex')}`,
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Verify PIN.
   */
  async verifyPin(pin: string): Promise<YubiKeyResult<{ remainingAttempts?: number }>> {
    console.log('Verifying PIN...');

    // Pad PIN to 8 bytes with 0xFF
    const pinBytes = Buffer.alloc(8, 0xff);
    Buffer.from(pin, 'ascii').copy(pinBytes);

    // VERIFY command: 00 20 00 80 08 [PIN]
    const command = Buffer.concat([Buffer.from([0x00, 0x20, 0x00, 0x80, 0x08]), pinBytes]);

    console.log('Sending VERIFY PIN command');
    const response = await this.transmit(command);
    if (!response.success) {
      console.error('PIN transmit failed:', response.error);
      return response as YubiKeyResult<{ remainingAttempts?: number }>;
    }

    const sw = response.data.slice(-2);
    const sw1 = sw[0]!;
    const sw2 = sw[1]!;
    console.log('PIN verification response SW:', sw.toString('hex'));

    // Success
    if (sw1 === 0x90 && sw2 === 0x00) {
      console.log('PIN verified successfully');
      return { success: true, data: {} };
    }

    // Wrong PIN - 63 Cx where x = remaining attempts
    if (sw1 === 0x63 && (sw2 & 0xf0) === 0xc0) {
      const remaining = sw2 & 0x0f;
      console.log('Wrong PIN, remaining attempts:', remaining);
      return {
        success: false,
        error: `Wrong PIN. ${remaining} attempts remaining.`,
      };
    }

    // PIN blocked
    if (sw1 === 0x69 && sw2 === 0x83) {
      return { success: false, error: 'PIN is blocked.' };
    }

    return { success: false, error: `PIN verification failed: SW=${sw.toString('hex')}` };
  }

  /**
   * Read existing public key from a slot.
   */
  private async readPublicKey(slot: number): Promise<YubiKeyResult<PublicKeyResult>> {
    console.log('Reading public key from slot:', slot.toString(16));

    // GET DATA command to read public key
    // For slot 9A, the object ID is 5FC105
    const objectId = this.getSlotObjectId(slot);
    if (!objectId) {
      return { success: false, error: 'Invalid slot' };
    }

    // GET DATA: 00 CB 3F FF [Lc] 5C [len] [tag]
    const command = Buffer.concat([
      Buffer.from([0x00, 0xcb, 0x3f, 0xff]),
      Buffer.from([objectId.length + 2]), // Lc
      Buffer.from([0x5c, objectId.length]), // Tag list
      objectId,
      Buffer.from([0x00]), // Le
    ]);

    console.log('Sending GET DATA command:', command.toString('hex'));
    const response = await this.transmit(command);
    if (!response.success) {
      return response as YubiKeyResult<PublicKeyResult>;
    }

    const data = response.data;
    const sw = data.slice(-2);
    console.log('GET DATA response SW:', sw.toString('hex'));

    // 6A82 = data not found (no key in slot)
    if (sw[0] === 0x6a && sw[1] === 0x82) {
      return { success: false, error: 'NO_KEY' };
    }

    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return { success: false, error: `Read public key failed: SW=${sw.toString('hex')}` };
    }

    // Parse the certificate/key data to extract public key
    const pubKey = this.parsePublicKeyFromCert(data.slice(0, -2));
    if (!pubKey) {
      return { success: false, error: 'Failed to parse public key from response' };
    }

    return { success: true, data: pubKey };
  }

  /**
   * Get object ID for a PIV slot.
   */
  private getSlotObjectId(slot: number): Buffer | null {
    // PIV slot to object ID mapping
    const mapping: Record<number, number[]> = {
      0x9a: [0x5f, 0xc1, 0x05], // Authentication
      0x9c: [0x5f, 0xc1, 0x0a], // Signature
      0x9d: [0x5f, 0xc1, 0x0b], // Key Management
      0x9e: [0x5f, 0xc1, 0x01], // Card Authentication
    };
    const id = mapping[slot];
    return id ? Buffer.from(id) : null;
  }

  /**
   * Parse public key from certificate data.
   * Properly parses X.509 certificate structure to find EC public key.
   */
  private parsePublicKeyFromCert(data: Buffer): PublicKeyResult | null {
    try {
      console.log('Parsing certificate, length:', data.length);
      console.log('Certificate hex:', data.toString('hex'));

      // EC public key OID: 1.2.840.10045.2.1 = 06 07 2a 86 48 ce 3d 02 01
      const ecPubKeyOid = Buffer.from([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);

      // P-256 curve OID: 1.2.840.10045.3.1.7 = 06 08 2a 86 48 ce 3d 03 01 07
      const _p256Oid = Buffer.from([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);

      // Find the EC public key OID
      let ecOidIndex = -1;
      for (let i = 0; i < data.length - ecPubKeyOid.length; i++) {
        if (data.slice(i, i + ecPubKeyOid.length).equals(ecPubKeyOid)) {
          ecOidIndex = i;
          console.log('Found EC public key OID at index:', i);
          break;
        }
      }

      if (ecOidIndex === -1) {
        console.log('EC public key OID not found, trying fallback search');
        return this.parsePublicKeyFallback(data);
      }

      // After the algorithm sequence, look for BIT STRING (tag 0x03) containing the public key
      // Search from after the OIDs for a BIT STRING with 66 bytes (1 unused bits byte + 65 key bytes)
      for (let i = ecOidIndex + ecPubKeyOid.length; i < data.length - 67; i++) {
        if (data[i] === 0x03) {
          // BIT STRING tag
          // Parse length
          let lenOffset = i + 1;
          let bitStringLen = data[lenOffset]!;

          if (bitStringLen === 0x81) {
            bitStringLen = data[lenOffset + 1]!;
            lenOffset += 1;
          } else if (bitStringLen === 0x82) {
            bitStringLen = (data[lenOffset + 1]! << 8) | data[lenOffset + 2]!;
            lenOffset += 2;
          }

          // BIT STRING should have unused bits byte (0x00) + uncompressed point (04 + 64 bytes)
          if (bitStringLen === 66) {
            const contentStart = lenOffset + 1;
            const unusedBits = data[contentStart];

            if (unusedBits === 0x00 && data[contentStart + 1] === 0x04) {
              const x = data.slice(contentStart + 2, contentStart + 34);
              const y = data.slice(contentStart + 34, contentStart + 66);

              console.log('Found public key in BIT STRING at index:', i);
              console.log('X:', x.toString('hex'));
              console.log('Y:', y.toString('hex'));

              return {
                publicKeyHex: data.slice(contentStart + 1, contentStart + 66).toString('hex'),
                x: x.toString('hex'),
                y: y.toString('hex'),
              };
            }
          }
        }
      }

      console.log('BIT STRING with public key not found, trying fallback');
      return this.parsePublicKeyFallback(data);
    } catch (e) {
      console.error('Error parsing certificate:', e);
      return null;
    }
  }

  /**
   * Fallback parser: look for 04 followed by 64 bytes that look like valid EC point.
   * More careful validation to avoid false positives.
   */
  private parsePublicKeyFallback(data: Buffer): PublicKeyResult | null {
    // Look for patterns that indicate an EC public key
    // The key should be preceded by BIT STRING tag (03) with proper length
    for (let i = 0; i < data.length - 67; i++) {
      // Look for BIT STRING (03) + length (42 = 66 bytes) + unused bits (00) + uncompressed (04)
      if (
        data[i] === 0x03 &&
        data[i + 1] === 0x42 &&
        data[i + 2] === 0x00 &&
        data[i + 3] === 0x04
      ) {
        const x = data.slice(i + 4, i + 36);
        const y = data.slice(i + 36, i + 68);

        console.log('Found public key via fallback pattern at index:', i);
        console.log('X:', x.toString('hex'));
        console.log('Y:', y.toString('hex'));

        return {
          publicKeyHex: data.slice(i + 3, i + 68).toString('hex'),
          x: x.toString('hex'),
          y: y.toString('hex'),
        };
      }

      // Also check for length encoded as 0x81 0x42 (long form)
      if (
        data[i] === 0x03 &&
        data[i + 1] === 0x81 &&
        data[i + 2] === 0x42 &&
        data[i + 3] === 0x00 &&
        data[i + 4] === 0x04
      ) {
        const x = data.slice(i + 5, i + 37);
        const y = data.slice(i + 37, i + 69);

        console.log('Found public key via fallback pattern (long form) at index:', i);
        console.log('X:', x.toString('hex'));
        console.log('Y:', y.toString('hex'));

        return {
          publicKeyHex: data.slice(i + 4, i + 69).toString('hex'),
          x: x.toString('hex'),
          y: y.toString('hex'),
        };
      }
    }

    console.log('No valid public key found in certificate');
    return null;
  }

  /**
   * Authenticate with the PIV management key.
   * Uses AES192 mutual authentication with the default management key.
   */
  private async authenticateManagementKey(): Promise<YubiKeyResult> {
    console.log('Authenticating with management key (AES192)...');

    // Default YubiKey management key (24 bytes, same for 3DES and AES192)
    const mgmtKey = Buffer.from([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    ]);

    // AES192 algorithm identifier = 0x0A
    const AES192_ALG = 0x0a;

    const crypto = await import('crypto');

    // Step 1: Request witness from card
    // GENERAL AUTHENTICATE: 00 87 0A 9B 04 7C 02 80 00
    // Tag 80 with length 00 = request witness
    const witnessReqCmd = Buffer.from([
      0x00,
      0x87,
      AES192_ALG,
      0x9b, // CLA INS P1(AES192) P2(mgmt key 9B)
      0x04, // Lc = 4
      0x7c,
      0x02, // Dynamic Auth Template, len 2
      0x80,
      0x00, // Witness tag, empty (request)
    ]);

    console.log('Step 1: Requesting witness...');
    const witnessResp = await this.transmit(witnessReqCmd);
    if (!witnessResp.success) {
      return witnessResp;
    }

    let data = witnessResp.data;
    let sw = data.slice(-2);
    console.log('Witness response SW:', sw.toString('hex'));

    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return { success: false, error: `Witness request failed: SW=${sw.toString('hex')}` };
    }

    // Parse witness from response: 7C [len] 80 [len] [witness]
    const witnessData = data.slice(0, -2);
    const witness = this.parseTlvValue(witnessData, 0x80);
    // AES block size is 16 bytes
    if (!witness || witness.length !== 16) {
      return {
        success: false,
        error: `Failed to parse witness (got ${witness?.length} bytes, expected 16)`,
      };
    }
    console.log('Got witness:', witness.toString('hex'));

    // Step 2: Decrypt witness with management key (AES-192-ECB decrypt)
    const decipher = crypto.createDecipheriv('aes-192-ecb', mgmtKey, null);
    decipher.setAutoPadding(false);
    const decryptedWitness = Buffer.concat([decipher.update(witness), decipher.final()]);
    console.log('Decrypted witness:', decryptedWitness.toString('hex'));

    // Step 3: Generate our challenge (16 bytes for AES)
    const challenge = crypto.randomBytes(16);
    console.log('Our challenge:', challenge.toString('hex'));

    // Step 4: Send response with decrypted witness and our challenge
    // GENERAL AUTHENTICATE: 00 87 0A 9B [Lc] 7C [len] 80 10 [witness] 81 10 [challenge]
    const authCmd = Buffer.concat([
      Buffer.from([
        0x00,
        0x87,
        AES192_ALG,
        0x9b,
        0x26, // Lc = 38 bytes (4 + 16 + 2 + 16)
        0x7c,
        0x24, // Dynamic Auth Template, len 36
        0x80,
        0x10, // Witness tag, len 16
      ]),
      decryptedWitness,
      Buffer.from([0x81, 0x10]), // Challenge tag, len 16
      challenge,
    ]);

    console.log('Step 2: Sending auth response...');
    const authResp = await this.transmit(authCmd);
    if (!authResp.success) {
      return authResp;
    }

    data = authResp.data;
    sw = data.slice(-2);
    console.log('Auth response SW:', sw.toString('hex'));

    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return { success: false, error: `Management key auth failed: SW=${sw.toString('hex')}` };
    }

    // Parse card's response to our challenge
    const cardResponse = this.parseTlvValue(data.slice(0, -2), 0x82);
    if (!cardResponse || cardResponse.length !== 16) {
      return { success: false, error: 'Failed to parse card response' };
    }

    // Verify card's response: encrypt our challenge and compare
    const cipher = crypto.createCipheriv('aes-192-ecb', mgmtKey, null);
    cipher.setAutoPadding(false);
    const expectedResponse = Buffer.concat([cipher.update(challenge), cipher.final()]);

    if (!cardResponse.equals(expectedResponse)) {
      return { success: false, error: 'Card response verification failed' };
    }

    console.log('Management key authentication successful');
    return { success: true, data: undefined };
  }

  /**
   * Parse a TLV value by tag from data.
   */
  private parseTlvValue(data: Buffer, tag: number): Buffer | null {
    try {
      let offset = 0;

      // Skip 7C wrapper if present
      if (data[offset] === 0x7c) {
        offset += 1;
        offset += this.parseLengthBytes(data, offset);
      }

      // Find the tag we're looking for
      while (offset < data.length - 1) {
        const currentTag = data[offset]!;
        offset += 1;
        const len = this.parseLength(data, offset);
        offset += this.parseLengthBytes(data, offset);

        if (currentTag === tag) {
          return data.slice(offset, offset + len);
        }

        offset += len;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a new P256 key in the specified slot.
   */
  private async generateNewKey(slot: number): Promise<YubiKeyResult<PublicKeyResult>> {
    console.log('Generating new P256 key in slot:', slot.toString(16));

    // Authenticate with management key first
    const authResult = await this.authenticateManagementKey();
    if (!authResult.success) {
      return authResult as YubiKeyResult<PublicKeyResult>;
    }

    // GENERATE ASYMMETRIC KEY PAIR: 00 47 00 [slot] [Lc] AC 03 80 01 [alg]
    const command = Buffer.from([
      0x00,
      0x47,
      0x00,
      slot,
      0x05, // Lc = 5
      0xac,
      0x03, // Algorithm Reference Template
      0x80,
      0x01,
      PIV_ALGORITHM.ECCP256, // Algorithm: P-256 (0x11)
    ]);

    console.log('Sending GENERATE KEY command:', command.toString('hex'));
    const response = await this.transmit(command);
    if (!response.success) {
      return response as YubiKeyResult<PublicKeyResult>;
    }

    const data = response.data;
    const sw = data.slice(-2);
    console.log('Generate key response SW:', sw.toString('hex'));

    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return { success: false, error: `Key generation failed: SW=${sw.toString('hex')}` };
    }

    // Parse public key from response
    const pubKey = this.parsePublicKeyResponse(data.slice(0, -2));
    if (!pubKey) {
      return { success: false, error: 'Failed to parse generated public key' };
    }

    console.log('Key generated successfully');
    return { success: true, data: pubKey };
  }

  /**
   * Store a self-signed certificate using ykman CLI.
   * This is more reliable than raw APDU commands.
   */
  private async storeCertificateViaYkman(
    slot: number,
    publicKey: PublicKeyResult
  ): Promise<YubiKeyResult> {
    console.log('Storing certificate via ykman...');

    const { exec } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Create temp directory for files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yubikey-'));
    const pubKeyFile = path.join(tmpDir, 'public.pem');

    try {
      // Write public key in PEM format
      const pubKeyDer = this.buildSubjectPublicKeyInfo(publicKey);
      const pubKeyPem = `-----BEGIN PUBLIC KEY-----\n${pubKeyDer
        .toString('base64')
        .match(/.{1,64}/g)
        ?.join('\n')}\n-----END PUBLIC KEY-----\n`;
      fs.writeFileSync(pubKeyFile, pubKeyPem);

      // Use ykman to generate certificate
      const slotName = slot === 0x9a ? '9a' : slot.toString(16);
      const mgmtKey = '010203040506070801020304050607080102030405060708';

      return new Promise((resolve) => {
        const cmd = `ykman piv certificates generate -s "CN=YubiKey-Safe" -m ${mgmtKey} -P 123456 ${slotName} "${pubKeyFile}"`;
        console.log('Running:', cmd);

        exec(cmd, (error: Error | null, stdout: string, stderr: string) => {
          // Cleanup temp files
          try {
            fs.unlinkSync(pubKeyFile);
            fs.rmdirSync(tmpDir);
          } catch (_e) {
            // Ignore cleanup errors
          }

          if (error) {
            console.error('ykman error:', stderr || error.message);
            resolve({ success: false, error: `ykman failed: ${stderr || error.message}` });
            return;
          }

          console.log('Certificate stored via ykman');
          resolve({ success: true, data: undefined });
        });
      });
    } catch (err) {
      // Cleanup on error
      try {
        fs.unlinkSync(pubKeyFile);
        fs.rmdirSync(tmpDir);
      } catch (_cleanupError) {
        // Ignore
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to store certificate',
      };
    }
  }

  /**
   * Build SubjectPublicKeyInfo DER structure.
   */
  private buildSubjectPublicKeyInfo(publicKey: PublicKeyResult): Buffer {
    const ecPoint = Buffer.from(publicKey.publicKeyHex, 'hex');

    // AlgorithmIdentifier for EC P-256
    const algId = Buffer.from([
      0x30,
      0x13,
      0x06,
      0x07,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x02,
      0x01, // ecPublicKey
      0x06,
      0x08,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x03,
      0x01,
      0x07, // P-256
    ]);

    // BIT STRING with public key
    const pubKeyBitString = Buffer.concat([Buffer.from([0x03, ecPoint.length + 1, 0x00]), ecPoint]);

    // SEQUENCE wrapper
    const inner = Buffer.concat([algId, pubKeyBitString]);
    return Buffer.concat([Buffer.from([0x30]), this.encodeLength(inner.length), inner]);
  }

  /**
   * Build a minimal X.509 certificate containing the public key.
   * This is a very minimal certificate just to store the public key.
   */
  private buildMinimalCertificate(publicKey: PublicKeyResult): Buffer {
    // Build the smallest possible valid X.509 certificate
    const ecPoint = Buffer.from(publicKey.publicKeyHex, 'hex'); // 04 || x || y (65 bytes)

    // OID for ecPublicKey + P-256 combined
    const algId = Buffer.from([
      0x30,
      0x13, // SEQUENCE, 19 bytes
      0x06,
      0x07,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x02,
      0x01, // ecPublicKey OID
      0x06,
      0x08,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x03,
      0x01,
      0x07, // P-256 OID
    ]);

    // SubjectPublicKeyInfo
    const spki = this.wrapSequence(
      Buffer.concat([
        algId,
        Buffer.from([0x03, 0x42, 0x00]), // BIT STRING, 66 bytes, 0 unused bits
        ecPoint,
      ])
    );

    // Minimal name: CN=P
    const name = Buffer.from([
      0x30,
      0x0c, // SEQUENCE
      0x31,
      0x0a, // SET
      0x30,
      0x08, // SEQUENCE
      0x06,
      0x03,
      0x55,
      0x04,
      0x03, // CN OID
      0x0c,
      0x01,
      0x50, // UTF8String "P"
    ]);

    // Minimal validity (fixed dates to save space)
    const validity = Buffer.from([
      0x30,
      0x1e, // SEQUENCE
      0x17,
      0x0d,
      0x32,
      0x35,
      0x30,
      0x31,
      0x30,
      0x31,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x5a, // 250101000000Z
      0x17,
      0x0d,
      0x33,
      0x35,
      0x30,
      0x31,
      0x30,
      0x31,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x5a, // 350101000000Z
    ]);

    // Signature algorithm: ecdsa-with-SHA256
    const sigAlg = Buffer.from([
      0x30, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02,
    ]);

    // TBSCertificate (no version = v1, minimal)
    const tbs = this.wrapSequence(
      Buffer.concat([
        Buffer.from([0x02, 0x01, 0x01]), // serial = 1
        sigAlg,
        name, // issuer
        validity,
        name, // subject
        spki,
      ])
    );

    // Empty signature (8 bytes - minimal valid BIT STRING)
    const sig = Buffer.from([0x03, 0x03, 0x00, 0x00, 0x00]);

    // Full certificate
    return this.wrapSequence(Buffer.concat([tbs, sigAlg, sig]));
  }

  /**
   * Build PIV certificate object wrapper.
   */
  private buildCertificateObject(cert: Buffer): Buffer {
    // PIV certificate object: 53 [len] 70 [len] [cert] 71 01 00 FE 00
    // Tag 70 = certificate
    // Tag 71 = cert info (compression)
    // Tag FE = LRC
    const tag70 = Buffer.concat([Buffer.from([0x70]), this.encodeLength(cert.length), cert]);
    const tag71 = Buffer.from([0x71, 0x01, 0x00]); // Uncompressed
    const tagFE = Buffer.from([0xfe, 0x00]); // No LRC

    const inner = Buffer.concat([tag70, tag71, tagFE]);

    return Buffer.concat([Buffer.from([0x53]), this.encodeLength(inner.length), inner]);
  }

  /**
   * Wrap data in ASN.1 SEQUENCE.
   */
  private wrapSequence(data: Buffer): Buffer {
    return Buffer.concat([Buffer.from([0x30]), this.encodeLength(data.length), data]);
  }

  /**
   * Wrap data in ASN.1 SET.
   */
  private wrapSet(data: Buffer): Buffer {
    return Buffer.concat([Buffer.from([0x31]), this.encodeLength(data.length), data]);
  }

  /**
   * Encode ASN.1 length.
   */
  private encodeLength(len: number): Buffer {
    if (len < 128) {
      return Buffer.from([len]);
    } else if (len < 256) {
      return Buffer.from([0x81, len]);
    } else {
      return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
    }
  }

  /**
   * Encode date as UTCTime.
   */
  private encodeUtcTime(date: Date): Buffer {
    const yy = (date.getUTCFullYear() % 100).toString().padStart(2, '0');
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const min = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const timeStr = `${yy}${mm}${dd}${hh}${min}${ss}Z`;
    return Buffer.concat([Buffer.from([0x17, timeStr.length]), Buffer.from(timeStr, 'ascii')]);
  }

  /**
   * Read existing public key from slot 9A (without generating).
   * Returns the public key if found, or an error if not.
   */
  async readPublicKeyFromSlot(): Promise<YubiKeyResult<PublicKeyResult>> {
    console.log('Reading public key from slot 9A...');
    return this.readPublicKey(PIV_SLOT.AUTHENTICATION);
  }

  /**
   * Generate or read P256 key pair from slot 9A.
   * Reads from YubiKey certificate, generates new key if none exists.
   */
  async generateP256Key(): Promise<YubiKeyResult<PublicKeyResult>> {
    console.log('Getting P256 key from slot 9A...');

    // Try to read from certificate on YubiKey
    const readResult = await this.readPublicKey(PIV_SLOT.AUTHENTICATION);
    if (readResult.success) {
      console.log('Found existing key in slot 9A');
      return readResult;
    }

    // No key found, generate a new one
    if (readResult.error === 'NO_KEY') {
      console.log('No existing key found, generating new one...');
      const generateResult = await this.generateNewKey(PIV_SLOT.AUTHENTICATION);

      if (generateResult.success) {
        // Store certificate so key can be read back later
        console.log('Storing certificate for generated key...');

        // Disconnect from PC/SC to allow ykman to access the device
        this.disconnectForYkman();

        const storeResult = await this.storeCertificateViaYkman(
          PIV_SLOT.AUTHENTICATION,
          generateResult.data
        );

        // Reconnect after ykman
        await this.reconnectAfterYkman();

        if (!storeResult.success) {
          console.error('Failed to store certificate:', storeResult.error);
          // Key was still generated, continue anyway
        }
      }

      return generateResult;
    }

    return readResult;
  }

  /**
   * Sign a 32-byte hash with the P256 key.
   */
  async signHash(hashHex: string): Promise<YubiKeyResult<SignatureResult>> {
    const hash = Buffer.from(hashHex.replace('0x', ''), 'hex');
    if (hash.length !== 32) {
      return { success: false, error: `Hash must be 32 bytes, got ${hash.length}` };
    }

    // GENERAL AUTHENTICATE: 00 87 [alg] [slot] [Lc] 7C [len] 82 00 81 20 [hash]
    const command = Buffer.concat([
      Buffer.from([
        0x00,
        0x87,
        PIV_ALGORITHM.ECCP256,
        PIV_SLOT.AUTHENTICATION,
        0x26, // Lc = 38 bytes
        0x7c,
        0x24, // Dynamic Auth Template, length 36
        0x82,
        0x00, // Response tag (empty)
        0x81,
        0x20, // Challenge tag, 32 bytes
      ]),
      hash,
    ]);

    const response = await this.transmit(command);
    if (!response.success) {
      return response as YubiKeyResult<SignatureResult>;
    }

    const data = response.data;
    const sw = data.slice(-2);
    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return { success: false, error: `Signing failed: SW=${sw.toString('hex')}` };
    }

    // Parse response to extract DER signature
    const sig = this.parseSignatureResponse(data.slice(0, -2));
    if (!sig) {
      return { success: false, error: 'Failed to parse signature from response' };
    }

    return { success: true, data: sig };
  }

  /**
   * Transmit an APDU command and receive response.
   * Handles 61 XX (more data available) responses automatically.
   */
  private async transmit(command: Buffer): Promise<YubiKeyResult<Buffer>> {
    const result = await this.transmitRaw(command);
    if (!result.success) {
      return result;
    }

    let data = result.data;

    // Handle 61 XX response (more data available)
    while (data.length >= 2) {
      const sw1 = data[data.length - 2];
      const sw2 = data[data.length - 1];

      if (sw1 === 0x61) {
        // More data available, send GET RESPONSE
        const getResponse = Buffer.from([0x00, 0xc0, 0x00, 0x00, sw2!]);
        const moreResult = await this.transmitRaw(getResponse);
        if (!moreResult.success) {
          return moreResult;
        }

        // Append new data (excluding the previous SW)
        data = Buffer.concat([data.slice(0, -2), moreResult.data]);
      } else {
        // No more data
        break;
      }
    }

    return { success: true, data };
  }

  /**
   * Raw APDU transmission without 61 XX handling.
   */
  private transmitRaw(command: Buffer): Promise<YubiKeyResult<Buffer>> {
    return new Promise((resolve) => {
      if (!this.reader || this.protocol === null) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.reader.transmit(command, 1024, this.protocol, (err, data) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true, data });
      });
    });
  }

  /**
   * Parse public key from GENERATE KEY response.
   */
  private parsePublicKeyResponse(response: Buffer): PublicKeyResult | null {
    try {
      let offset = 0;

      // Look for 7F49 tag
      if (response[offset] !== 0x7f || response[offset + 1] !== 0x49) {
        return null;
      }
      offset += 2;

      // Skip length
      offset += this.parseLengthBytes(response, offset);

      // Look for 86 tag (public key)
      if (response[offset] !== 0x86) {
        return null;
      }
      offset += 1;

      // Get public key length
      const lenInfo = this.parseLengthBytes(response, offset);
      const pubKeyLen = this.parseLength(response, offset);
      offset += lenInfo;

      // Extract public key (should be 65 bytes: 04 || x || y)
      const pubKey = response.slice(offset, offset + pubKeyLen);
      if (pubKey.length !== 65 || pubKey[0] !== 0x04) {
        return null;
      }

      const x = pubKey.slice(1, 33);
      const y = pubKey.slice(33, 65);

      return {
        publicKeyHex: pubKey.toString('hex'),
        x: x.toString('hex'),
        y: y.toString('hex'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse signature from GENERAL AUTHENTICATE response.
   */
  private parseSignatureResponse(response: Buffer): SignatureResult | null {
    try {
      let offset = 0;

      // Look for 7C tag
      if (response[offset] !== 0x7c) {
        return null;
      }
      offset += 1;

      // Skip length
      offset += this.parseLengthBytes(response, offset);

      // Look for 82 tag (signature)
      if (response[offset] !== 0x82) {
        return null;
      }
      offset += 1;

      // Get signature length
      const lenInfo = this.parseLengthBytes(response, offset);
      const sigLen = this.parseLength(response, offset);
      offset += lenInfo;

      // Extract DER signature
      const sigDer = response.slice(offset, offset + sigLen);

      // Parse DER to get r and s
      const { r, s } = this.parseDerSignature(sigDer);

      return {
        signatureDer: sigDer.toString('hex'),
        r: r.toString('hex').padStart(64, '0'),
        s: s.toString('hex').padStart(64, '0'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse DER-encoded ECDSA signature to r and s.
   * Also normalizes s to low-S form as required by some verifiers.
   */
  private parseDerSignature(der: Buffer): { r: Buffer; s: Buffer } {
    let offset = 0;

    // SEQUENCE tag
    if (der[offset] !== 0x30) {
      throw new Error('Invalid DER: expected SEQUENCE');
    }
    offset += 1;

    // Parse SEQUENCE length (handles short and long form)
    const seqLenBytes = this.parseLengthBytes(der, offset);
    offset += seqLenBytes;

    // INTEGER r
    if (der[offset] !== 0x02) {
      throw new Error('Invalid DER: expected INTEGER for r');
    }
    offset += 1;

    const rLen = this.parseLength(der, offset);
    const rLenBytes = this.parseLengthBytes(der, offset);
    offset += rLenBytes;

    const rRaw = der.slice(offset, offset + rLen);
    offset += rLen;

    // INTEGER s
    if (der[offset] !== 0x02) {
      throw new Error('Invalid DER: expected INTEGER for s');
    }
    offset += 1;

    const sLen = this.parseLength(der, offset);
    const sLenBytes = this.parseLengthBytes(der, offset);
    offset += sLenBytes;

    const sRaw = der.slice(offset, offset + sLen);

    // Normalize to 32 bytes
    const r = this.normalizeTo32Bytes(Buffer.from(rRaw));
    let s = this.normalizeTo32Bytes(Buffer.from(sRaw));

    // Normalize s to low-S form
    // P-256 curve order n
    const n = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');
    const halfN = n / 2n;
    const sBigInt = BigInt('0x' + s.toString('hex'));

    if (sBigInt > halfN) {
      console.log('Normalizing s to low-S form');
      const lowS = n - sBigInt;
      const lowSHex = lowS.toString(16).padStart(64, '0');
      s = Buffer.from(lowSHex, 'hex');
    }

    console.log('Parsed signature:');
    console.log('  r:', r.toString('hex'));
    console.log('  s:', s.toString('hex'));

    return { r, s };
  }

  /**
   * Normalize a buffer to exactly 32 bytes.
   */
  private normalizeTo32Bytes(buf: Buffer): Buffer {
    // Remove leading zero if present (DER positive integer encoding)
    if (buf.length === 33 && buf[0] === 0x00) {
      buf = buf.slice(1);
    }

    // Pad to 32 bytes if shorter
    if (buf.length < 32) {
      const padded = Buffer.alloc(32, 0);
      buf.copy(padded, 32 - buf.length);
      return padded;
    }

    return buf.slice(0, 32);
  }

  /**
   * Parse ASN.1 length and return the value.
   */
  private parseLength(data: Buffer, offset: number): number {
    const firstByte = data[offset]!;
    if (firstByte <= 0x7f) {
      return firstByte;
    }
    if (firstByte === 0x81) {
      return data[offset + 1]!;
    }
    if (firstByte === 0x82) {
      return (data[offset + 1]! << 8) | data[offset + 2]!;
    }
    throw new Error('Unsupported length encoding');
  }

  /**
   * Return number of bytes used by length encoding.
   */
  private parseLengthBytes(data: Buffer, offset: number): number {
    const firstByte = data[offset]!;
    if (firstByte <= 0x7f) return 1;
    if (firstByte === 0x81) return 2;
    if (firstByte === 0x82) return 3;
    throw new Error('Unsupported length encoding');
  }
}
