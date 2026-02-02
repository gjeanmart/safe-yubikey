/**
 * Address Utilities
 *
 * Functions for working with Ethereum addresses.
 */

import { getAddress } from 'viem';

/**
 * Convert an address to its checksummed format.
 * EIP-55: Mixed-case checksum address encoding.
 *
 * @param address - The Ethereum address (any case)
 * @returns The checksummed address
 */
export function toChecksumAddress(address: string): string {
  try {
    return getAddress(address);
  } catch {
    // If invalid, return as-is
    return address;
  }
}

/**
 * Check if an address is valid.
 *
 * @param address - The address to check
 * @returns True if valid
 */
export function isValidAddress(address: string): boolean {
  try {
    getAddress(address);
    return true;
  } catch {
    return false;
  }
}
