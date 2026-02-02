/**
 * Safe Utilities
 *
 * Functions for interacting with Safe contracts on Sepolia.
 * Note: Deployment and execution are handled by the relayer in the main process.
 */

import {
  createPublicClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { sepolia } from 'viem/chains';

// Import centralized constants
import {
  DEFAULT_SEPOLIA_RPC,
  SEPOLIA_EXPLORER as _SEPOLIA_EXPLORER,
  SAFE_ABI,
} from '../../shared/constants';

// Re-export for use by components
export const SEPOLIA_EXPLORER = _SEPOLIA_EXPLORER;

// ============================================================================
// Client
// ============================================================================

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(DEFAULT_SEPOLIA_RPC),
});

// ============================================================================
// Safe Transaction Hash
// ============================================================================

// EIP-712 types for Safe transactions
const SAFE_TX_TYPEHASH = keccak256(
  stringToHex(
    'SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)'
  )
);

type SafeTransaction = {
  to: Address;
  value: bigint;
  data: Hex;
  operation: number;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  nonce: bigint;
};

/**
 * Calculate Safe transaction hash (EIP-712).
 */
export async function calculateSafeTxHash(
  safeAddress: string,
  tx: SafeTransaction
): Promise<string> {
  // Get domain separator from Safe contract
  const domainSeparator = await publicClient.readContract({
    address: safeAddress as Address,
    abi: SAFE_ABI,
    functionName: 'domainSeparator',
  });

  // Encode transaction data
  const dataHash = keccak256(tx.data);

  const safeTxData = encodeAbiParameters(
    parseAbiParameters(
      'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256'
    ),
    [
      SAFE_TX_TYPEHASH,
      tx.to,
      tx.value,
      dataHash,
      tx.operation,
      tx.safeTxGas,
      tx.baseGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      tx.nonce,
    ]
  );

  const safeTxHash = keccak256(safeTxData);

  // EIP-712: \x19\x01 || domainSeparator || safeTxHash
  const messageHash = keccak256(`0x1901${domainSeparator.slice(2)}${safeTxHash.slice(2)}` as Hex);

  return messageHash;
}

// ============================================================================
// Safe Read Operations
// ============================================================================

/**
 * Get Safe nonce.
 */
export async function getSafeNonce(safeAddress: string): Promise<bigint> {
  return publicClient.readContract({
    address: safeAddress as Address,
    abi: SAFE_ABI,
    functionName: 'nonce',
  });
}

/**
 * Get Safe owners.
 */
export async function getSafeOwners(safeAddress: string): Promise<string[]> {
  const owners = await publicClient.readContract({
    address: safeAddress as Address,
    abi: SAFE_ABI,
    functionName: 'getOwners',
  });
  return owners as string[];
}

/**
 * Get Safe balance.
 */
export async function getSafeBalance(safeAddress: string): Promise<bigint> {
  return publicClient.getBalance({
    address: safeAddress as Address,
  });
}
