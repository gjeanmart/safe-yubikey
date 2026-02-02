/**
 * Step 2: Generate/Read P256 Key
 *
 * Handles PIN verification and P256 key generation/reading from YubiKey.
 */

import React, { useState } from 'react';
import { AddressDisplay } from './AddressDisplay';
import { deriveAddress } from '../lib/crypto';

type Props = {
  onKeyGenerated: (publicKey: { x: string; y: string }, ownerAddress: string) => void;
  onBack: () => void;
};

type KeyState = 'pin' | 'checking' | 'found' | 'generating' | 'done';

export function StepGenerateKey({ onKeyGenerated, onBack }: Props) {
  const [keyState, setKeyState] = useState<KeyState>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Key info
  const [publicKey, setPublicKey] = useState<{ x: string; y: string } | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);

  const handleVerifyPin = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setKeyState('checking');
    setError(null);
    setStatus('Verifying PIN...');

    try {
      const result = await window.yubiKey.verifyPin(pin);

      if (!result.success) {
        setError(result.error);
        setKeyState('pin');
        return;
      }

      // Try to read existing key
      setStatus('Checking for existing key...');
      const readResult = await window.yubiKey.readPublicKey();

      if (readResult.success && readResult.data) {
        const { x, y } = readResult.data;
        const address = deriveAddress(x, y);

        setPublicKey({ x, y });
        setOwnerAddress(address);
        setKeyState('found');
        setStatus('Existing key found!');
      } else {
        // No key found, offer to generate
        setKeyState('done');
        setStatus('No existing key found. Generate a new one.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to verify PIN');
      setKeyState('pin');
    }
  };

  const handleGenerateKey = async () => {
    setKeyState('generating');
    setError(null);
    setStatus('Generating P256 key on YubiKey...');

    try {
      const result = await window.yubiKey.generateKey();

      if (!result.success) {
        setError(result.error);
        setKeyState('done');
        return;
      }

      const { x, y } = result.data;
      const address = deriveAddress(x, y);

      setPublicKey({ x, y });
      setOwnerAddress(address);
      setKeyState('found');
      setStatus('Key generated successfully!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate key');
      setKeyState('done');
    }
  };

  const handleContinue = () => {
    if (publicKey && ownerAddress) {
      onKeyGenerated(publicKey, ownerAddress);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Step 2: P256 Key</h2>
        <p className="text-gray-600 mt-2">
          Verify your PIN and use or generate a P256 key on your YubiKey.
        </p>
      </div>

      {/* PIN Entry */}
      {keyState === 'pin' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIV PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your PIV PIN"
              className="input"
              maxLength={8}
            />
            <p className="mt-1 text-xs text-gray-500">Default PIN is 123456 for new YubiKeys</p>
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
              onClick={handleVerifyPin}
              disabled={pin.length < 4}
              className="btn btn-primary flex-1"
            >
              Verify PIN
            </button>
          </div>
        </>
      )}

      {/* Checking / Generating */}
      {(keyState === 'checking' || keyState === 'generating') && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">{status}</p>
        </div>
      )}

      {/* Key Found */}
      {keyState === 'found' && publicKey && ownerAddress && (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 font-medium">{status}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <span className="text-sm text-gray-600">Public Key X:</span>
              <p className="font-mono text-xs break-all mt-1">0x{publicKey.x}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Public Key Y:</span>
              <p className="font-mono text-xs break-all mt-1">0x{publicKey.y}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <span className="text-sm text-blue-600 block mb-2">Owner Address (derived):</span>
            <AddressDisplay address={ownerAddress} full />
          </div>

          <div className="flex gap-4">
            <button onClick={onBack} className="btn btn-secondary flex-1">
              Back
            </button>
            <button onClick={handleContinue} className="btn btn-primary flex-1">
              Continue
            </button>
          </div>
        </>
      )}

      {/* No Key - Offer to Generate */}
      {keyState === 'done' && !publicKey && (
        <>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 text-sm">
              No P256 key found in slot 9A. Would you like to generate one?
            </p>
            <p className="text-yellow-600 text-xs mt-2">
              Warning: This will overwrite any existing key in slot 9A.
            </p>
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
            <button onClick={handleGenerateKey} className="btn btn-primary flex-1">
              Generate New Key
            </button>
          </div>
        </>
      )}
    </div>
  );
}
