/**
 * Step 3: Deploy Safe
 *
 * Predicts Safe address and deploys a new one using the relayer.
 * Note: We use a custom Safe singleton that isn't indexed by Safe's API,
 * so we can't fetch existing Safes from the Transaction Service.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SEPOLIA_EXPLORER, getSafeBalance } from '../lib/safe';
import { formatEther } from 'viem';
import { AddressInline } from './AddressDisplay';

type RelayerStatus = {
  configured: boolean;
  address: string | null;
  balance: string | null;
};

type Props = {
  ownerAddress: string;
  relayerStatus: RelayerStatus;
  onOpenSettings: () => void;
  onRefreshRelayer: () => Promise<void>;
  onDeployed: (safeAddress: string) => void;
  onBack: () => void;
};

export function StepDeploySafe({
  ownerAddress,
  relayerStatus,
  onOpenSettings,
  onRefreshRelayer,
  onDeployed,
  onBack,
}: Props) {
  const [refreshingRelayerBalance, setRefreshingRelayerBalance] = useState(false);
  const [predictedAddress, setPredictedAddress] = useState<string | null>(null);
  const [isDeployed, setIsDeployed] = useState<boolean | null>(null);
  const [safeBalance, setSafeBalance] = useState<string | null>(null);
  const [refreshingSafeBalance, setRefreshingSafeBalance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployTxHash, setDeployTxHash] = useState<string | null>(null);

  const handleRefreshRelayerBalance = async () => {
    setRefreshingRelayerBalance(true);
    try {
      await onRefreshRelayer();
    } finally {
      setRefreshingRelayerBalance(false);
    }
  };

  // Fetch Safe balance
  const fetchSafeBalance = useCallback(async () => {
    if (!predictedAddress || !isDeployed) return;

    setRefreshingSafeBalance(true);
    try {
      const balance = await getSafeBalance(predictedAddress);
      setSafeBalance(formatEther(balance));
    } catch (e) {
      console.error('Failed to fetch Safe balance:', e);
    } finally {
      setRefreshingSafeBalance(false);
    }
  }, [predictedAddress, isDeployed]);

  // Fetch balance when Safe is deployed
  useEffect(() => {
    if (isDeployed && predictedAddress) {
      fetchSafeBalance();
    }
  }, [isDeployed, predictedAddress, fetchSafeBalance]);

  // Predict Safe address and check if already deployed
  useEffect(() => {
    const init = async () => {
      setChecking(true);
      setError(null);

      try {
        // Predict Safe address
        const result = await window.relayer.predictSafeAddress(ownerAddress);
        if (result.success) {
          setPredictedAddress(result.data.address);

          // Check if already deployed
          const deployedResult = await window.relayer.isSafeDeployed(result.data.address);
          if (deployedResult.success) {
            setIsDeployed(deployedResult.data.deployed);
          }
        } else {
          setError(result.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to predict Safe address');
      } finally {
        setChecking(false);
      }
    };

    init();
  }, [ownerAddress]);

  const handleDeploy = async () => {
    if (!relayerStatus.configured) {
      onOpenSettings();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.relayer.deploySafe(ownerAddress);
      if (result.success) {
        setDeployTxHash(result.data.txHash);
        setPredictedAddress(result.data.address);
        setIsDeployed(true);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deploy Safe');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (predictedAddress) {
      onDeployed(predictedAddress);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Safe</h2>
        <p className="text-gray-600 mt-2">Your Safe wallet secured by YubiKey P256 signature.</p>
      </div>

      {/* Owner Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Owner Address:</span>
          <AddressInline address={ownerAddress} />
        </div>
      </div>

      <div className="space-y-4">
        {/* Loading state */}
        {checking ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-600 text-sm">Checking Safe status...</p>
          </div>
        ) : (
          <>
            {/* Safe Address */}
            {predictedAddress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-600">Safe Address:</span>
                  <AddressInline address={predictedAddress} />
                </div>
                {isDeployed && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-600">Balance:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-blue-900">
                        {safeBalance !== null ? `${safeBalance} ETH` : '...'}
                      </span>
                      <button
                        onClick={fetchSafeBalance}
                        disabled={refreshingSafeBalance}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                        title="Refresh balance"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-3.5 w-3.5 text-blue-600 ${refreshingSafeBalance ? 'animate-spin' : ''}`}
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
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${isDeployed ? 'bg-green-500' : 'bg-yellow-500'}`}
                  />
                  <span className={`text-sm ${isDeployed ? 'text-green-700' : 'text-yellow-700'}`}>
                    {isDeployed ? 'Deployed' : 'Not deployed yet'}
                  </span>
                </div>
              </div>
            )}

            {/* Already Deployed */}
            {isDeployed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700 text-sm font-medium">
                  Safe is already deployed! You can continue to create transactions.
                </p>
                {deployTxHash && (
                  <a
                    href={`${SEPOLIA_EXPLORER}/tx/${deployTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 text-sm underline mt-2 inline-block"
                  >
                    View deployment transaction
                  </a>
                )}
              </div>
            )}

            {/* Deploy Section - only show if not deployed */}
            {!isDeployed && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-gray-700">Deploy New Safe</h3>

                {/* Relayer Status */}
                {relayerStatus.configured ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium text-green-700">Relayer Ready</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Address:</span>
                      <AddressInline address={relayerStatus.address || ''} />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-600">Balance:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-green-900">
                          {relayerStatus.balance} ETH
                        </span>
                        <button
                          onClick={handleRefreshRelayerBalance}
                          disabled={refreshingRelayerBalance}
                          className="p-1 hover:bg-green-100 rounded transition-colors"
                          title="Refresh balance"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-3.5 w-3.5 text-green-600 ${refreshingRelayerBalance ? 'animate-spin' : ''}`}
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
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700 mb-2">
                      Configure a relayer to deploy your Safe.
                    </p>
                    <button
                      onClick={onOpenSettings}
                      className="text-sm text-yellow-800 font-medium hover:underline"
                    >
                      Open Settings →
                    </button>
                  </div>
                )}

                <button
                  onClick={handleDeploy}
                  disabled={loading || !predictedAddress || !relayerStatus.configured}
                  className="btn btn-primary w-full"
                >
                  {loading ? 'Deploying...' : 'Deploy Safe'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4">
          <button onClick={onBack} className="btn btn-secondary flex-1">
            Back
          </button>
          {isDeployed && predictedAddress ? (
            <button onClick={handleContinue} className="btn btn-primary flex-1">
              Continue
            </button>
          ) : (
            <button disabled className="btn btn-primary flex-1 opacity-50">
              Deploy First
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
