/**
 * Type definitions for pcsclite library.
 * Based on the pcsclite npm package API.
 */

declare module 'pcsclite' {
  import { EventEmitter } from 'events';

  interface CardStatus {
    state: number;
    atr?: Buffer;
  }

  interface _ConnectOptions {
    share_mode?: number;
    protocol?: number;
  }

  interface CardReader extends EventEmitter {
    name: string;
    connected: boolean;

    // Share modes
    SCARD_SHARE_SHARED: number;
    SCARD_SHARE_EXCLUSIVE: number;
    SCARD_SHARE_DIRECT: number;

    // States
    SCARD_STATE_UNAWARE: number;
    SCARD_STATE_IGNORE: number;
    SCARD_STATE_CHANGED: number;
    SCARD_STATE_UNKNOWN: number;
    SCARD_STATE_UNAVAILABLE: number;
    SCARD_STATE_EMPTY: number;
    SCARD_STATE_PRESENT: number;
    SCARD_STATE_ATRMATCH: number;
    SCARD_STATE_EXCLUSIVE: number;
    SCARD_STATE_INUSE: number;
    SCARD_STATE_MUTE: number;

    // Protocols
    SCARD_PROTOCOL_T0: number;
    SCARD_PROTOCOL_T1: number;
    SCARD_PROTOCOL_RAW: number;

    connect(
      options: { share_mode?: number; protocol?: number },
      callback: (err: Error | null, protocol: number) => void
    ): void;

    disconnect(disposition: number, callback: (err: Error | null) => void): void;

    transmit(
      data: Buffer,
      res_len: number,
      protocol: number,
      callback: (err: Error | null, response: Buffer) => void
    ): void;

    close(): void;

    on(event: 'status', listener: (status: CardStatus) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
  }

  interface PCSCLite extends EventEmitter {
    on(event: 'reader', listener: (reader: CardReader) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    close(): void;
  }

  function pcsclite(): PCSCLite;

  export = pcsclite;
}
