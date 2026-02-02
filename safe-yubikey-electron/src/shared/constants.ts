/**
 * Shared Constants
 *
 * Centralized configuration for network and contract addresses.
 * Used by both main process and renderer.
 */

// ============================================================================
// Network Configuration
// ============================================================================

/** Sepolia testnet chain ID */
export const SEPOLIA_CHAIN_ID = 11155111;

/** Sepolia block explorer */
export const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

/** Default Sepolia RPC URL (reliable public endpoint from dRPC) */
export const DEFAULT_SEPOLIA_RPC = 'https://sepolia.drpc.org';

// ============================================================================
// Safe Contract Addresses on Sepolia
// ============================================================================

/**
 * Safe v1.5.0 Singleton (master copy) with EIP-7951 support.
 * Deployed from safe-smart-account main branch with P256 signature support.
 */
export const SAFE_SINGLETON = '0x35F315F38234e8358B3907C8F26b5f440CEbb53F';

/**
 * Safe Proxy Factory address.
 * Used to deploy new Safe proxies with CREATE2 for deterministic addresses.
 */
export const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';

/**
 * Compatibility Fallback Handler address.
 * Handles fallback calls, token callbacks (ERC721, ERC1155), and signature validation.
 */
export const FALLBACK_HANDLER = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99';

// ============================================================================
// Contract ABIs
// ============================================================================

export const SAFE_ABI = [
  {
    inputs: [
      { name: '_owners', type: 'address[]' },
      { name: '_threshold', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'fallbackHandler', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint256' },
      { name: 'paymentReceiver', type: 'address' },
    ],
    name: 'setup',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    name: 'execTransaction',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nonce',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getThreshold',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getOwners',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'isOwner',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'domainSeparator',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const SAFE_PROXY_FACTORY_ABI = [
  {
    inputs: [
      { name: '_singleton', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' },
    ],
    name: 'createProxyWithNonce',
    outputs: [{ name: 'proxy', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'proxyCreationCode',
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const;
