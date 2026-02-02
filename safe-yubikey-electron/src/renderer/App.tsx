/**
 * Main App Component
 *
 * Manages the wizard flow for YubiKey-secured Safe transactions.
 */

import React, { useState, useCallback } from 'react';
import { StepConnect } from './components/StepConnect';
import { StepGenerateKey } from './components/StepGenerateKey';
import { StepDeploySafe } from './components/StepDeploySafe';
import { StepCreateTx } from './components/StepCreateTx';
import { StepSign } from './components/StepSign';
import { StepExecute } from './components/StepExecute';
import { SettingsPanel } from './components/SettingsPanel';

type Step = 'connect' | 'generateKey' | 'deploySafe' | 'createTx' | 'sign' | 'execute';

type RelayerStatus = {
  configured: boolean;
  address: string | null;
  balance: string | null;
};

type AppState = {
  currentStep: Step;
  readerName: string | null;
  publicKey: { x: string; y: string } | null;
  ownerAddress: string | null;
  safeAddress: string | null;
  transaction: { to: string; value: string; nonce: string } | null;
  safeTxHash: string | null;
  signature: string | null;
  txHash: string | null;
};

const initialState: AppState = {
  currentStep: 'connect',
  readerName: null,
  publicKey: null,
  ownerAddress: null,
  safeAddress: null,
  transaction: null,
  safeTxHash: null,
  signature: null,
  txHash: null,
};

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [relayerStatus, setRelayerStatus] = useState<RelayerStatus>({
    configured: false,
    address: null,
    balance: null,
  });

  const updateState = (updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const handleReset = async () => {
    // Disconnect from YubiKey before resetting state
    try {
      await window.yubiKey.disconnect();
    } catch (e) {
      console.error('Failed to disconnect YubiKey:', e);
    }
    setState(initialState);
  };

  // Refresh relayer balance
  const handleRefreshRelayer = useCallback(async () => {
    if (!relayerStatus.configured) return;

    try {
      const result = await window.relayer.getBalance();
      if (result.success) {
        setRelayerStatus((prev) => ({
          ...prev,
          balance: result.data.balance,
        }));
      }
    } catch (e) {
      console.error('Failed to refresh relayer balance:', e);
    }
  }, [relayerStatus.configured]);

  const renderStep = () => {
    switch (state.currentStep) {
      case 'connect':
        return (
          <StepConnect
            onConnected={(readerName) => {
              updateState({ readerName, currentStep: 'generateKey' });
            }}
          />
        );

      case 'generateKey':
        return (
          <StepGenerateKey
            onKeyGenerated={(publicKey, ownerAddress) => {
              updateState({
                publicKey,
                ownerAddress,
                currentStep: 'deploySafe',
              });
            }}
            onBack={() => updateState({ currentStep: 'connect' })}
          />
        );

      case 'deploySafe':
        return (
          <StepDeploySafe
            ownerAddress={state.ownerAddress!}
            relayerStatus={relayerStatus}
            onOpenSettings={() => setSettingsOpen(true)}
            onRefreshRelayer={handleRefreshRelayer}
            onDeployed={(safeAddress) => {
              updateState({ safeAddress, currentStep: 'createTx' });
            }}
            onBack={() => updateState({ currentStep: 'generateKey' })}
          />
        );

      case 'createTx':
        return (
          <StepCreateTx
            safeAddress={state.safeAddress!}
            ownerAddress={state.ownerAddress!}
            onTransactionCreated={(transaction, safeTxHash) => {
              updateState({ transaction, safeTxHash, currentStep: 'sign' });
            }}
            onBack={() => updateState({ currentStep: 'deploySafe' })}
          />
        );

      case 'sign':
        return (
          <StepSign
            safeTxHash={state.safeTxHash!}
            publicKey={state.publicKey!}
            ownerAddress={state.ownerAddress!}
            onSigned={(signature) => {
              updateState({ signature, currentStep: 'execute' });
            }}
            onBack={() => updateState({ currentStep: 'createTx' })}
          />
        );

      case 'execute':
        return (
          <StepExecute
            safeAddress={state.safeAddress!}
            transaction={state.transaction!}
            signature={state.signature!}
            relayerStatus={relayerStatus}
            onOpenSettings={() => setSettingsOpen(true)}
            onRefreshRelayer={handleRefreshRelayer}
            onExecuted={(txHash) => {
              updateState({ txHash });
            }}
            onReset={handleReset}
          />
        );

      default:
        return null;
    }
  };

  // Step indicator
  const steps: { key: Step; label: string }[] = [
    { key: 'connect', label: '1. Connect' },
    { key: 'generateKey', label: '2. Key' },
    { key: 'deploySafe', label: '3. Safe' },
    { key: 'createTx', label: '4. Create' },
    { key: 'sign', label: '5. Sign' },
    { key: 'execute', label: '6. Execute' },
  ];

  const currentIndex = steps.findIndex((s) => s.key === state.currentStep);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Safe YubiKey</h1>
            <p className="text-gray-600 text-sm">Hardware-secured Safe with P256 signatures</p>
          </div>

          {/* Settings Button with Relayer Status */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {relayerStatus.configured ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-gray-700">Relayer Active</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                <span className="text-sm text-gray-500">No Relayer</span>
              </>
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-between mb-8">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={`flex-1 text-center text-xs ${
                index <= currentIndex ? 'text-blue-600 font-medium' : 'text-gray-400'
              }`}
            >
              <div
                className={`w-8 h-8 mx-auto mb-1 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < currentIndex
                    ? 'bg-blue-600 text-white'
                    : index === currentIndex
                      ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentIndex ? '✓' : index + 1}
              </div>
              {step.label.split('. ')[1]}
            </div>
          ))}
        </div>

        {/* Current Step */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p>Using Safe v1.6.0 with EIP-7951 P256 support</p>
          <p className="mt-1">Sepolia Testnet</p>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRelayerConfigured={setRelayerStatus}
        relayerStatus={relayerStatus}
      />
    </div>
  );
}
