/**
 * Step 6: Execute Transaction
 *
 * Executes the signed Safe transaction on-chain using the relayer.
 * Uses the relayer configured in settings to pay for gas.
 */

import React, { useState } from 'react';
import { SEPOLIA_EXPLORER } from '../lib/safe';
import { formatEther } from 'viem';
import { AddressInline } from './AddressDisplay';
import { HashDisplay } from './HashDisplay';

type RelayerStatus = {
  configured: boolean;
  address: string | null;
  balance: string | null;
};

type Props = {
  safeAddress: string;
  transaction: { to: string; value: string; nonce: string };
  signature: string;
  relayerStatus: RelayerStatus;
  onOpenSettings: () => void;
  onRefreshRelayer: () => Promise<void>;
  onExecuted: (txHash: string) => void;
  onReset: () => void;
};

export function StepExecute({
  safeAddress,
  transaction,
  signature,
  relayerStatus,
  onOpenSettings,
  onRefreshRelayer,
  onExecuted,
  onReset,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleRefreshBalance = async () => {
    setRefreshingBalance(true);
    try {
      await onRefreshRelayer();
    } finally {
      setRefreshingBalance(false);
    }
  };

  const handleExecute = async () => {
    if (!relayerStatus.configured) {
      onOpenSettings();
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('Executing transaction...');

    try {
      const result = await window.relayer.executeTransaction(safeAddress, {
        to: transaction.to,
        value: transaction.value,
        data: '0x',
        operation: 0,
        safeTxGas: '0',
        baseGas: '0',
        gasPrice: '0',
        gasToken: '0x0000000000000000000000000000000000000000',
        refundReceiver: '0x0000000000000000000000000000000000000000',
        signature,
      });

      if (result.success) {
        setTxHash(result.data.txHash);
        setStatus('Transaction executed successfully!');
        onExecuted(result.data.txHash);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to execute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Step 6: Execute Transaction</h2>
        <p className="text-gray-600 mt-2">
          Execute the signed transaction on Sepolia using the relayer.
        </p>
      </div>

      {/* Transaction Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Safe:</span>
          <AddressInline address={safeAddress} />
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">To:</span>
          <AddressInline address={transaction.to} />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Value:</span>
          <span className="font-mono text-gray-900">
            {formatEther(BigInt(transaction.value))} ETH
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Nonce:</span>
          <span className="font-mono text-gray-900">{transaction.nonce}</span>
        </div>
      </div>

      {/* Signature */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <span className="text-sm text-gray-600">Signature:</span>
        <div className="mt-1">
          <HashDisplay hash={signature} />
        </div>
      </div>

      {/* Relayer Status */}
      {!txHash &&
        (relayerStatus.configured ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-green-700">Relayer Ready</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-600">Address:</span>
              <AddressInline address={relayerStatus.address || ''} />
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-600">Balance:</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-green-900">{relayerStatus.balance} ETH</span>
                <button
                  onClick={handleRefreshBalance}
                  disabled={refreshingBalance}
                  className="p-1 hover:bg-green-100 rounded transition-colors"
                  title="Refresh balance"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3.5 w-3.5 text-green-600 ${refreshingBalance ? 'animate-spin' : ''}`}
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
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-2">
              Configure a relayer to execute your transaction.
            </p>
            <button
              onClick={onOpenSettings}
              className="text-sm text-yellow-800 font-medium hover:underline"
            >
              Open Settings →
            </button>
          </div>
        ))}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Status / Success */}
      {status && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 text-sm">{status}</p>
          {txHash && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600">Tx Hash:</span>
                <HashDisplay hash={txHash} />
              </div>
              <a
                href={`${SEPOLIA_EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-800 text-sm underline inline-block"
              >
                View on Etherscan
              </a>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        {txHash ? (
          <button onClick={onReset} className="btn btn-primary w-full">
            Start New Transaction
          </button>
        ) : (
          <button
            onClick={handleExecute}
            disabled={loading || !relayerStatus.configured}
            className="btn btn-primary w-full"
          >
            {loading ? 'Executing...' : 'Execute Transaction'}
          </button>
        )}
      </div>
    </div>
  );
}
