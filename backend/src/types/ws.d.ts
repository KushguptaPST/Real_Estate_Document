declare module 'ws' {
  import type { EventEmitter } from 'node:events';
  import type { IncomingMessage } from 'node:http';

  export class WebSocket extends EventEmitter {
    static readonly OPEN: number;
    static readonly CLOSED: number;
    readonly readyState: number;
    constructor(address?: string | URL, options?: unknown);
    send(data: string | Buffer, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
  }

  export interface ServerOptions {
    noServer?: boolean;
    server?: unknown;
    path?: string;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: ServerOptions);
    handleUpgrade(
      request: IncomingMessage,
      socket: any,
      head: Buffer,
      callback: (ws: WebSocket, request: IncomingMessage) => void,
    ): void;
    on(event: 'connection', listener: (ws: WebSocket, request: IncomingMessage) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    close(cb?: (err?: Error) => void): void;
  }
}
