/**
 * Step 4: Create Transaction
 *
 * Creates a Safe transaction to be signed by the YubiKey.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getSafeNonce, getSafeBalance, getSafeOwners, calculateSafeTxHash } from '../lib/safe';
import { formatEther, parseEther } from 'viem';
import { AddressInline } from './AddressDisplay';

type Props = {
  safeAddress: string;
  ownerAddress: string; // Added to verify ownership
  onTransactionCreated: (
    transaction: { to: string; value: string; nonce: string },
    safeTxHash: string
  ) => void;
  onBack: () => void;
};

export function StepCreateTx({ safeAddress, ownerAddress, onTransactionCreated, onBack }: Props) {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [nonce, setNonce] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [_owners, setOwners] = useState<string[]>([]);
  const [_isOwnerValid, setIsOwnerValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh balance function
  const refreshBalance = useCallback(async () => {
    setRefreshingBalance(true);
    try {
      const b = await getSafeBalance(safeAddress);
      setBalance(b);
    } catch (e) {
      console.error('Failed to refresh balance:', e);
    } finally {
      setRefreshingBalance(false);
    }
  }, [safeAddress]);

  // Fetch nonce, balance, and owners on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [n, b, o] = await Promise.all([
          getSafeNonce(safeAddress),
          getSafeBalance(safeAddress),
          getSafeOwners(safeAddress),
        ]);
        setNonce(n);
        setBalance(b);
        setOwners(o);

        // Check if our owner address is in the owners list
        const isOwner = o.some((addr) => addr.toLowerCase() === ownerAddress.toLowerCase());
        setIsOwnerValid(isOwner);

        if (!isOwner) {
          setError(
            `Owner address ${ownerAddress} is not an owner of this Safe. Safe owners: ${o.join(', ')}`
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch Safe data');
      }
    };
    fetchData();
  }, [safeAddress, ownerAddress]);

  const handleCreateTransaction = async () => {
    if (!toAddress || !amount || nonce === null) {
      setError('Please fill in all fields');
      return;
    }

    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      setError('Invalid recipient address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const valueWei = parseEther(amount);

      // Calculate Safe transaction hash
      const safeTxHash = await calculateSafeTxHash(safeAddress, {
        to: toAddress as `0x${string}`,
        value: valueWei,
        data: '0x',
        operation: 0,
        safeTxGas: 0n,
        baseGas: 0n,
        gasPrice: 0n,
        gasToken: '0x0000000000000000000000000000000000000000',
        refundReceiver: '0x0000000000000000000000000000000000000000',
        nonce,
      });

      onTransactionCreated(
        {
          to: toAddress,
          value: valueWei.toString(),
          nonce: nonce.toString(),
        },
        safeTxHash
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Step 4: Create Transaction</h2>
        <p className="text-gray-600 mt-2">Create an ETH transfer transaction from your Safe.</p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Safe Address:</span>
          <AddressInline address={safeAddress} />
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Balance:</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-gray-900">
              {balance !== null ? `${formatEther(balance)} ETH` : 'Loading...'}
            </span>
            <button
              onClick={refreshBalance}
              disabled={refreshingBalance}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Refresh balance"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-3.5 w-3.5 text-gray-500 ${refreshingBalance ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Nonce:</span>
          <span className="font-mono text-gray-900">
            {nonce !== null ? nonce.toString() : 'Loading...'}
          </span>
        </div>
      </div>

      {balance !== null && balance === 0n && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700 text-sm">
            Your Safe has no ETH. Please send some Sepolia ETH to the Safe address before creating a
            transaction.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Address</label>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            className="input"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ETH)</label>
          <input
            type="number"
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.001"
            className="input"
            disabled={loading}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button onClick={onBack} className="btn btn-secondary flex-1">
          Back
        </button>
        <button
          onClick={handleCreateTransaction}
          disabled={loading || nonce === null}
          className="btn btn-primary flex-1"
        >
          {loading ? 'Creating...' : 'Create Transaction'}
        </button>
      </div>
    </div>
  );
}
