/**
 * Transport Layer Types
 *
 * Defines the interface for transport implementations that handle
 * communication between ACP clients and agents.
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from "../types/jsonrpc.js";

/**
 * Events emitted by transport implementations.
 */
export interface TransportEvents {
  /** Emitted when a JSON-RPC message is received */
  message: (
    message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification
  ) => void;

  /** Emitted when a transport-level error occurs */
  error: (error: Error) => void;

  /** Emitted when the transport connection is closed */
  close: () => void;
}

/**
 * Base transport interface for ACP communication.
 *
 * All transport implementations (stdio, HTTP, WebSocket, etc.) must implement this interface.
 * The transport layer handles message serialization, delivery, and connection management.
 */
export interface Transport {
  /**
   * Send a JSON-RPC request and wait for a response.
   *
   * @param request - The JSON-RPC request to send
   * @returns Promise that resolves with the JSON-RPC response
   * @throws Error if the request times out or the connection is closed
   */
  request(request: JsonRpcRequest): Promise<JsonRpcResponse>;

  /**
   * Send a JSON-RPC notification (no response expected).
   *
   * @param notification - The JSON-RPC notification to send
   * @returns Promise that resolves when the notification is sent
   */
  notify(notification: JsonRpcNotification): Promise<void>;

  /**
   * Register an event handler.
   *
   * @param event - The event name to listen for
   * @param handler - The event handler function
   */
  on<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void;

  /**
   * Unregister an event handler.
   *
   * @param event - The event name to stop listening for
   * @param handler - The event handler function to remove
   */
  off<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void;

  /**
   * Start the transport connection.
   *
   * For client transports, this may spawn a subprocess or connect to a server.
   * For server transports, this starts listening for connections.
   *
   * @returns Promise that resolves when the transport is ready
   */
  start(): Promise<void>;

  /**
   * Close the transport connection gracefully.
   *
   * @returns Promise that resolves when the transport is fully closed
   */
  close(): Promise<void>;

  /**
   * Whether the transport is currently connected and ready to send messages.
   */
  readonly connected: boolean;
}
