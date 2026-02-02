/**
 * Step 5: Sign Transaction
 *
 * Signs the Safe transaction hash using the YubiKey's P256 key.
 */

import React, { useState } from 'react';
import { formatSafeSignature } from '../lib/crypto';
import { AddressInline } from './AddressDisplay';
import { HashDisplay } from './HashDisplay';

type Props = {
  safeTxHash: string;
  publicKey: { x: string; y: string };
  ownerAddress: string;
  onSigned: (signature: string) => void;
  onBack: () => void;
};

export function StepSign({ safeTxHash, publicKey, ownerAddress, onSigned, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleSign = async () => {
    setLoading(true);
    setError(null);
    setStatus('Signing with YubiKey...');

    try {
      // Sign the hash with YubiKey
      const result = await window.yubiKey.signHash(safeTxHash);

      if (!result.success) {
        throw new Error(result.error);
      }

      const { r, s } = result.data;

      // Format for Safe contract (v=2 indicates P256 signature)
      const signature = formatSafeSignature(r, s, publicKey.x, publicKey.y);

      setStatus('Signature created successfully!');
      onSigned(signature);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Step 5: Sign Transaction</h2>
        <p className="text-gray-600 mt-2">
          Sign the Safe transaction hash using your YubiKey's P256 key.
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <div>
          <span className="text-sm text-gray-600">Safe Transaction Hash:</span>
          <div className="mt-1">
            <HashDisplay hash={safeTxHash} />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Owner Address:</span>
          <AddressInline address={ownerAddress} />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800">Signature Format (v=2)</h3>
        <p className="mt-1 text-sm text-blue-700">
          The signature includes the P256 public key coordinates (x, y) and the signature values (r,
          s), formatted for the Safe contract's native P256 verification.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {status && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 text-sm">{status}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button onClick={onBack} className="btn btn-secondary flex-1">
          Back
        </button>
        <button onClick={handleSign} disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Signing...' : 'Sign with YubiKey'}
        </button>
      </div>
    </div>
  );
}
