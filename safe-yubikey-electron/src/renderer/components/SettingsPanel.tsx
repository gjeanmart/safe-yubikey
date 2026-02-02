/**
 * Settings Panel Component
 *
 * Allows configuring RPC endpoint and relayer private key.
 * Settings are stored in memory only (not persisted to disk).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AddressDisplay } from './AddressDisplay';

const DEFAULT_RPC = 'https://sepolia.drpc.org';

type RelayerStatus = {
  configured: boolean;
  address: string | null;
  balance: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onRelayerConfigured: (status: RelayerStatus) => void;
  relayerStatus: RelayerStatus;
};

export function SettingsPanel({ isOpen, onClose, onRelayerConfigured, relayerStatus }: Props) {
  // RPC settings
  const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC);
  const [rpcSaved, setRpcSaved] = useState(true);
  const [savingRpc, setSavingRpc] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);

  // Relayer settings
  const [privateKey, setPrivateKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current RPC on mount
  useEffect(() => {
    const loadRpc = async () => {
      try {
        const result = await window.relayer.getRpcUrl();
        if (result.success) {
          setRpcUrl(result.data.rpcUrl);
        }
      } catch (e) {
        console.error('Failed to load RPC URL:', e);
      }
    };
    if (isOpen) {
      loadRpc();
    }
  }, [isOpen]);

  // Refresh balance function
  const refreshBalance = useCallback(async () => {
    if (!relayerStatus.configured) return;

    setRefreshingBalance(true);
    try {
      const result = await window.relayer.getBalance();
      if (result.success) {
        onRelayerConfigured({
          ...relayerStatus,
          balance: result.data.balance,
        });
      }
    } catch (e) {
      console.error('Failed to refresh balance:', e);
    } finally {
      setRefreshingBalance(false);
    }
  }, [relayerStatus, onRelayerConfigured]);

  // Refresh balance periodically when configured
  useEffect(() => {
    if (!relayerStatus.configured) return;

    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, [relayerStatus.configured, refreshBalance]);

  const handleSaveRpc = async () => {
    setSavingRpc(true);
    setRpcError(null);

    try {
      const result = await window.relayer.setRpcUrl(rpcUrl);
      if (result.success) {
        setRpcSaved(true);
      } else {
        setRpcError(result.error);
      }
    } catch (e) {
      setRpcError(e instanceof Error ? e.message : 'Failed to set RPC');
    } finally {
      setSavingRpc(false);
    }
  };

  const handleResetRpc = () => {
    setRpcUrl(DEFAULT_RPC);
    setRpcSaved(false);
  };

  const handleConfigureRelayer = async () => {
    if (!privateKey.trim()) {
      setError('Please enter a private key');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.relayer.setPrivateKey(privateKey);

      if (result.success) {
        const balanceResult = await window.relayer.getBalance();

        onRelayerConfigured({
          configured: true,
          address: result.data.address,
          balance: balanceResult.success ? balanceResult.data.balance : null,
        });

        setPrivateKey('');
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to configure relayer');
    } finally {
      setLoading(false);
    }
  };

  const handleClearRelayer = () => {
    onRelayerConfigured({
      configured: false,
      address: null,
      balance: null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* RPC Configuration */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              RPC Endpoint
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Configure the Sepolia RPC endpoint for blockchain queries.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RPC URL</label>
                <input
                  type="text"
                  value={rpcUrl}
                  onChange={(e) => {
                    setRpcUrl(e.target.value);
                    setRpcSaved(false);
                  }}
                  placeholder="https://sepolia.drpc.org"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={savingRpc}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Default:{' '}
                  <button onClick={handleResetRpc} className="text-blue-600 hover:underline">
                    https://sepolia.drpc.org
                  </button>
                </p>
              </div>

              {rpcError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{rpcError}</p>
                </div>
              )}

              <button
                onClick={handleSaveRpc}
                disabled={savingRpc || rpcSaved}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  rpcSaved
                    ? 'bg-green-100 text-green-700 cursor-default'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                }`}
              >
                {savingRpc ? 'Saving...' : rpcSaved ? '✓ Saved' : 'Save RPC'}
              </button>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Relayer Configuration */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Relayer (Gas Payment)
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              The relayer pays gas fees for Safe deployment and transaction execution. Enter a
              Sepolia-funded private key.
            </p>

            {relayerStatus.configured ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm font-medium text-green-700">Relayer Active</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Address:</span>
                      <AddressDisplay address={relayerStatus.address || ''} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Balance:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-green-900">
                          {relayerStatus.balance || '...'} ETH
                        </span>
                        <button
                          onClick={refreshBalance}
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
                </div>
                <button
                  onClick={handleClearRelayer}
                  className="w-full py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Clear Relayer Key
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Private Key
                  </label>
                  <input
                    type="password"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get Sepolia ETH from{' '}
                    <a
                      href="https://sepolia-faucet.pk910.de"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      sepolia-faucet.pk910.de
                    </a>
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleConfigureRelayer}
                  disabled={loading || !privateKey.trim()}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Configuring...' : 'Save Relayer Key'}
                </button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Security Note</h4>
            <p className="text-xs text-gray-600">
              Settings are stored in memory only and will be cleared when you close the app. Nothing
              is written to disk. The relayer key is separate from your Safe ownership - it only
              pays for gas.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-700 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
