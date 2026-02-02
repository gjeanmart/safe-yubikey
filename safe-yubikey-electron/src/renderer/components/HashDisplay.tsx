/**
 * HashDisplay Component
 *
 * Displays a hex hash with copy-to-clipboard functionality.
 */

import React, { useState } from 'react';

type Props = {
  hash: string;
  /** Show full hash or truncated */
  full?: boolean;
  /** Label to show before the hash */
  label?: string;
};

export function HashDisplay({ hash, full = false, label }: Props) {
  const [copied, setCopied] = useState(false);

  const displayHash = full ? hash : `${hash.slice(0, 18)}...${hash.slice(-16)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      onClick={handleCopy}
      className="inline-flex items-center gap-2 cursor-pointer group"
      title={copied ? 'Copied!' : 'Click to copy'}
    >
      {label && <span className="text-gray-600">{label}</span>}
      <span className="font-mono text-xs text-gray-900 break-all group-hover:text-blue-600 transition-colors">
        {displayHash}
      </span>
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-green-500 flex-shrink-0"
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
          className="h-4 w-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
        </svg>
      )}
    </div>
  );
}
