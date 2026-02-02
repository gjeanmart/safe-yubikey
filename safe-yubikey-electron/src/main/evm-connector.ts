/**
 * EVM Connector
 *
 * Manages connection to the Ethereum network via RPC and provides
 * transaction execution capabilities using a configured private key.
 *
 * Responsibilities:
 * - RPC connection management
 * - Private key storage (in-memory, session-only)
 * - Safe deployment via CREATE2
 * - Safe transaction execution
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  getContractAddress,
  getAddress,
  formatEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

import {
  DEFAULT_SEPOLIA_RPC,
  SAFE_SINGLETON,
  SAFE_PROXY_FACTORY,
  FALLBACK_HANDLER,
  SAFE_ABI,
  SAFE_PROXY_FACTORY_ABI,
} from '../shared/constants';

// ============================================================================
// Types
// ============================================================================

type SuccessResult<T> = { success: true; data: T };
type ErrorResult = { success: false; error: string };
type Result<T> = SuccessResult<T> | ErrorResult;

export type SafeTransactionParams = {
  to: string;
  value: string;
  data: string;
  operation: number;
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  signature: string;
};

// ============================================================================
// EVM Connector Class
// ============================================================================

export class EvmConnector {
  private privateKey: Hex | null = null;
  private rpcUrl: string = DEFAULT_SEPOLIA_RPC;
  private publicClient = createPublicClient({
    chain: sepolia,
    transport: http(this.rpcUrl),
  });
  private walletClient: ReturnType<typeof createWalletClient> | null = null;

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Set the RPC URL.
   */
  setRpcUrl(rpcUrl: string): Result<{ rpcUrl: string }> {
    try {
      this.rpcUrl = rpcUrl || DEFAULT_SEPOLIA_RPC;

      // Recreate public client with new RPC
      this.publicClient = createPublicClient({
        chain: sepolia,
        transport: http(this.rpcUrl),
      });

      // Recreate wallet client if private key is set
      if (this.privateKey) {
        const account = privateKeyToAccount(this.privateKey);
        this.walletClient = createWalletClient({
          account,
          chain: sepolia,
          transport: http(this.rpcUrl),
        });
      }

      return { success: true, data: { rpcUrl: this.rpcUrl } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Invalid RPC URL' };
    }
  }

  /**
   * Get current RPC URL.
   */
  getRpcUrl(): Result<{ rpcUrl: string }> {
    return { success: true, data: { rpcUrl: this.rpcUrl } };
  }

  /**
   * Set the private key for transaction execution.
   * Key is stored in memory only (not persisted).
   */
  setPrivateKey(privateKey: string): Result<{ address: string }> {
    try {
      const key = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex;
      const account = privateKeyToAccount(key);

      this.privateKey = key;
      this.walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(this.rpcUrl),
      });

      return { success: true, data: { address: account.address } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Invalid private key' };
    }
  }

  /**
   * Get the balance of the configured account.
   */
  async getBalance(): Promise<Result<{ balance: string }>> {
    if (!this.privateKey) {
      return { success: false, error: 'Private key not configured' };
    }

    try {
      const account = privateKeyToAccount(this.privateKey);
      const balance = await this.publicClient.getBalance({ address: account.address });
      return { success: true, data: { balance: formatEther(balance) } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to get balance' };
    }
  }

  // ==========================================================================
  // Safe Operations
  // ==========================================================================

  /**
   * Predict Safe address using CREATE2.
   */
  async predictSafeAddress(ownerAddress: string): Promise<Result<{ address: string }>> {
    try {
      const checksumOwner = getAddress(ownerAddress);
      const saltNonce = BigInt(keccak256(checksumOwner as Hex));

      const initializer = encodeFunctionData({
        abi: SAFE_ABI,
        functionName: 'setup',
        args: [
          [checksumOwner],
          1n,
          '0x0000000000000000000000000000000000000000' as Address,
          '0x' as Hex,
          FALLBACK_HANDLER as Address,
          '0x0000000000000000000000000000000000000000' as Address,
          0n,
          '0x0000000000000000000000000000000000000000' as Address,
        ],
      });

      const proxyCreationCode = await this.publicClient.readContract({
        address: SAFE_PROXY_FACTORY as Address,
        abi: SAFE_PROXY_FACTORY_ABI,
        functionName: 'proxyCreationCode',
      });

      const deploymentCode = (proxyCreationCode + SAFE_SINGLETON.slice(2).padStart(64, '0')) as Hex;
      const initializerHash = keccak256(initializer);
      const salt = keccak256(
        encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [initializerHash, saltNonce])
      );

      const address = getContractAddress({
        bytecode: deploymentCode,
        from: SAFE_PROXY_FACTORY as Address,
        opcode: 'CREATE2',
        salt,
      });

      return { success: true, data: { address } };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to predict address',
      };
    }
  }

  /**
   * Check if a Safe is deployed at the given address.
   */
  async isSafeDeployed(safeAddress: string): Promise<Result<{ deployed: boolean }>> {
    try {
      const code = await this.publicClient.getBytecode({ address: safeAddress as Address });
      return { success: true, data: { deployed: code !== undefined && code !== '0x' } };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to check deployment',
      };
    }
  }

  /**
   * Deploy a Safe with the given owner address.
   */
  async deploySafe(ownerAddress: string): Promise<Result<{ address: string; txHash: string }>> {
    if (!this.walletClient || !this.privateKey) {
      return { success: false, error: 'Private key not configured' };
    }

    try {
      const account = privateKeyToAccount(this.privateKey);
      const checksumOwner = getAddress(ownerAddress);
      const saltNonce = BigInt(keccak256(checksumOwner as Hex));

      const initializer = encodeFunctionData({
        abi: SAFE_ABI,
        functionName: 'setup',
        args: [
          [checksumOwner],
          1n,
          '0x0000000000000000000000000000000000000000' as Address,
          '0x' as Hex,
          FALLBACK_HANDLER as Address,
          '0x0000000000000000000000000000000000000000' as Address,
          0n,
          '0x0000000000000000000000000000000000000000' as Address,
        ],
      });

      console.log('Deploying Safe for owner:', checksumOwner);
      console.log('Using account:', account.address);

      const txHash = await this.walletClient.writeContract({
        address: SAFE_PROXY_FACTORY as Address,
        abi: SAFE_PROXY_FACTORY_ABI,
        functionName: 'createProxyWithNonce',
        args: [SAFE_SINGLETON as Address, initializer, saltNonce],
        account,
        chain: sepolia,
      });

      console.log('Deployment tx:', txHash);

      // Wait for receipt with extended timeout (2 minutes)
      try {
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 120_000, // 2 minutes
          pollingInterval: 2_000, // Poll every 2 seconds
        });
        console.log('Deployment confirmed in block:', receipt.blockNumber);
      } catch (_receiptError) {
        console.warn('Receipt wait timed out, but transaction was submitted:', txHash);
      }

      const predictResult = await this.predictSafeAddress(checksumOwner);
      if (!predictResult.success) {
        return predictResult;
      }

      return { success: true, data: { address: predictResult.data.address, txHash } };
    } catch (e) {
      console.error('Deployment error:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Failed to deploy Safe' };
    }
  }

  /**
   * Execute a signed Safe transaction.
   */
  async executeTransaction(
    safeAddress: string,
    params: SafeTransactionParams
  ): Promise<Result<{ txHash: string }>> {
    if (!this.walletClient || !this.privateKey) {
      return { success: false, error: 'Private key not configured' };
    }

    try {
      const account = privateKeyToAccount(this.privateKey);

      console.log('Executing Safe transaction on:', safeAddress);
      console.log('Using account:', account.address);

      const txHash = await this.walletClient.writeContract({
        address: safeAddress as Address,
        abi: SAFE_ABI,
        functionName: 'execTransaction',
        args: [
          params.to as Address,
          BigInt(params.value),
          params.data as Hex,
          params.operation,
          BigInt(params.safeTxGas),
          BigInt(params.baseGas),
          BigInt(params.gasPrice),
          params.gasToken as Address,
          params.refundReceiver as Address,
          params.signature as Hex,
        ],
        account,
        chain: sepolia,
      });

      console.log('Execution tx:', txHash);

      // Wait for receipt with extended timeout (2 minutes)
      try {
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 120_000, // 2 minutes
          pollingInterval: 2_000, // Poll every 2 seconds
        });
        console.log('Execution confirmed in block:', receipt.blockNumber);
      } catch (_receiptError) {
        // Transaction was submitted but receipt wait timed out
        // Return success with the hash - user can check on Etherscan
        console.warn('Receipt wait timed out, but transaction was submitted:', txHash);
      }

      return { success: true, data: { txHash } };
    } catch (e) {
      console.error('Execution error:', e);
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to execute transaction',
      };
    }
  }
}
