/**
 * Step 1: Connect to YubiKey
 *
 * Uses the PC/SC API via Electron IPC to connect to a YubiKey.
 */

import React, { useState } from 'react';

type Props = {
  onConnected: (readerName: string) => void;
};

export function StepConnect({ onConnected }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const result = await window.yubiKey.connect();

      if (result.success) {
        onConnected(result.data.readerName);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Step 1: Connect YubiKey</h2>
        <p className="text-gray-600 mt-2">
          Insert your YubiKey 5 NFC and click connect. The app will use the PIV applet for P256 key
          operations.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800">Requirements</h3>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
          <li>YubiKey 5 series with PIV support</li>
          <li>Default PIV PIN is 123456</li>
          <li>Key will be generated in slot 9A (Authentication)</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <button onClick={handleConnect} disabled={connecting} className="btn btn-primary w-full">
        {connecting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Connecting...
          </span>
        ) : (
          'Connect YubiKey'
        )}
      </button>
    </div>
  );
}
