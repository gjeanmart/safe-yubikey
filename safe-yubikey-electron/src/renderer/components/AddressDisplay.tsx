/**
 * AddressDisplay Component
 *
 * Displays an Ethereum address with copy-to-clipboard and Etherscan link.
 * Always uses checksummed addresses for display and copying.
 */

import React, { useState, useMemo } from 'react';
import { toChecksumAddress } from '../lib/address';
import { SEPOLIA_EXPLORER } from '../lib/safe';

type Props = {
  address: string;
  /** Show full address or truncated */
  full?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label to show before the address */
  label?: string;
};

export function AddressDisplay({ address, full = false, className = '', label }: Props) {
  const [copied, setCopied] = useState(false);

  // Always use checksummed address
  const checksumAddress = useMemo(() => toChecksumAddress(address), [address]);

  const displayAddress = full
    ? checksumAddress
    : `${checksumAddress.slice(0, 10)}...${checksumAddress.slice(-8)}`;

  const etherscanUrl = `${SEPOLIA_EXPLORER}/address/${checksumAddress}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checksumAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && <span className="text-gray-600">{label}</span>}
      <span className="font-mono text-gray-900">{displayAddress}</span>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="p-1 hover:bg-gray-100 rounded transition-colors"
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-gray-400 hover:text-gray-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
        )}
      </button>

      {/* Etherscan link */}
      <a
        href={etherscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 hover:bg-gray-100 rounded transition-colors"
        title="View on Etherscan"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-400 hover:text-blue-600"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
      </a>
    </div>
  );
}

/**
 * Inline version for use in text flow
 */
export function AddressInline({ address, full = false }: { address: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);

  // Always use checksummed address
  const checksumAddress = useMemo(() => toChecksumAddress(address), [address]);

  const displayAddress = full
    ? checksumAddress
    : `${checksumAddress.slice(0, 10)}...${checksumAddress.slice(-8)}`;

  const etherscanUrl = `${SEPOLIA_EXPLORER}/address/${checksumAddress}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(checksumAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 font-mono text-gray-900">
      <span className="hover:text-blue-600 transition-colors">{displayAddress}</span>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="p-0.5 hover:bg-gray-100 rounded transition-colors"
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
        )}
      </button>

      {/* Etherscan link */}
      <a
        href={etherscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="p-0.5 hover:bg-gray-100 rounded transition-colors"
        title="View on Etherscan"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5 text-gray-400 hover:text-blue-600"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
      </a>
    </span>
  );
}
