/**
 * Crypto Utilities
 *
 * Functions for P256 signature formatting for the Safe contract.
 */

import { getAddress, keccak256, type Hex } from 'viem';

/**
 * Format a P256 signature for the Safe contract.
 *
 * The Safe contract with EIP-7951 support expects P256 signatures (v=2) in this format:
 *
 * Static part (65 bytes):
 * - bytes 0-31:  Owner address (padded to 32 bytes)
 * - bytes 32-63: Offset to dynamic data (always 65 for single signature)
 * - byte 64:     v = 2 (indicates P256 signature)
 *
 * Dynamic part (128 bytes, at offset 65):
 * - bytes 0-31:  Signature r
 * - bytes 32-63: Signature s
 * - bytes 64-95: Public key x
 * - bytes 96-127: Public key y
 *
 * @param r - Signature r value (hex string, 32 bytes)
 * @param s - Signature s value (hex string, 32 bytes)
 * @param x - Public key x coordinate (hex string, 32 bytes)
 * @param y - Public key y coordinate (hex string, 32 bytes)
 * @returns Hex-encoded signature ready for Safe.execTransaction()
 */
export function formatSafeSignature(r: string, s: string, x: string, y: string): string {
  // Derive owner address from public key: address = last 20 bytes of keccak256(x || y)
  const xHex = x.replace('0x', '').padStart(64, '0');
  const yHex = y.replace('0x', '').padStart(64, '0');
  const packed = `0x${xHex}${yHex}` as Hex;
  const hash = keccak256(packed);
  const ownerAddress = getAddress(`0x${hash.slice(-40)}`);

  // Format r, s, x, y as 32-byte hex strings
  const rHex = r.replace('0x', '').padStart(64, '0');
  const sHex = s.replace('0x', '').padStart(64, '0');

  // Owner address as uint256 (padded to 32 bytes)
  const ownerHex = ownerAddress.slice(2).padStart(64, '0').toLowerCase();

  // Offset to dynamic part (65 = 0x41)
  const offsetHex = '0000000000000000000000000000000000000000000000000000000000000041';

  // v = 2
  const vHex = '02';

  // Construct the signature
  // Static part: [owner 32 bytes][offset 32 bytes][v 1 byte] = 65 bytes
  // Dynamic part: [r 32 bytes][s 32 bytes][x 32 bytes][y 32 bytes] = 128 bytes
  const signature = `0x${ownerHex}${offsetHex}${vHex}${rHex}${sHex}${xHex}${yHex}`;

  return signature;
}

/**
 * Derive address from P256 public key coordinates.
 * address = last 20 bytes of keccak256(x || y)
 */
export function deriveAddress(x: string, y: string): string {
  const xHex = x.replace('0x', '').padStart(64, '0');
  const yHex = y.replace('0x', '').padStart(64, '0');
  const packed = `0x${xHex}${yHex}` as Hex;
  const hash = keccak256(packed);

  return getAddress(`0x${hash.slice(-40)}`);
}
