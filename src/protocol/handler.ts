/**
 * JSON-RPC protocol handler
 *
 * Provides a handler for routing JSON-RPC requests and notifications to registered handlers.
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  ErrorCodes,
} from "../types/jsonrpc.js";
import {
  ACPError,
  MethodNotFoundError,
} from "./errors.js";
import { generateId } from "./message.js";

/**
 * Handler function for JSON-RPC requests.
 * Returns a promise that resolves to the result or rejects with an error.
 */
export type RequestHandler = (params: unknown) => Promise<unknown>;

/**
 * Handler function for JSON-RPC notifications.
 * Notifications don't return a value.
 */
export type NotificationHandler = (params: unknown) => void | Promise<void>;

/**
 * Protocol handler for routing JSON-RPC messages to registered handlers.
 *
 * @example
 * ```typescript
 * const handler = new ProtocolHandler();
 *
 * // Register request handler
 * handler.onRequest('session/prompt', async (params) => {
 *   const { sessionId, content } = params as PromptParams;
 *   return await processPrompt(sessionId, content);
 * });
 *
 * // Register notification handler
 * handler.onNotification('session/update', (params) => {
 *   console.log('Session updated:', params);
 * });
 *
 * // Handle incoming message
 * const response = await handler.handleMessage(message);
 * if (response) {
 *   // Send response back to client
 *   send(response);
 * }
 * ```
 */
export class ProtocolHandler {
  private requestHandlers = new Map<string, RequestHandler>();
  private notificationHandlers = new Map<string, NotificationHandler>();

  /**
   * Register a handler for a JSON-RPC request method.
   *
   * @param method - The method name to handle
   * @param handler - The handler function that processes the request
   */
  onRequest(method: string, handler: RequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  /**
   * Register a handler for a JSON-RPC notification method.
   *
   * @param method - The method name to handle
   * @param handler - The handler function that processes the notification
   */
  onNotification(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  /**
   * Remove a registered request handler.
   *
   * @param method - The method name to unregister
   * @returns True if a handler was removed
   */
  removeRequestHandler(method: string): boolean {
    return this.requestHandlers.delete(method);
  }

  /**
   * Remove a registered notification handler.
   *
   * @param method - The method name to unregister
   * @returns True if a handler was removed
   */
  removeNotificationHandler(method: string): boolean {
    return this.notificationHandlers.delete(method);
  }

  /**
   * Check if a request handler is registered for a method.
   *
   * @param method - The method name to check
   * @returns True if a handler is registered
   */
  hasRequestHandler(method: string): boolean {
    return this.requestHandlers.has(method);
  }

  /**
   * Check if a notification handler is registered for a method.
   *
   * @param method - The method name to check
   * @returns True if a handler is registered
   */
  hasNotificationHandler(method: string): boolean {
    return this.notificationHandlers.has(method);
  }

  /**
   * Handle an incoming JSON-RPC message.
   * Routes requests to registered handlers and returns a response.
   * Routes notifications to registered handlers (no response).
   *
   * @param message - The JSON-RPC request or notification
   * @returns A response (for requests) or null (for notifications)
   */
  async handleMessage(
    message: JsonRpcRequest | JsonRpcNotification
  ): Promise<JsonRpcResponse | null> {
    // Check if it's a notification (no id field)
    if (!("id" in message)) {
      await this.handleNotification(message as JsonRpcNotification);
      return null;
    }

    // Handle as request
    return await this.handleRequest(message as JsonRpcRequest);
  }

  /**
   * Handle a JSON-RPC request.
   *
   * @param request - The JSON-RPC request
   * @returns A JSON-RPC response
   */
  private async handleRequest(
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    const { id, method, params } = request;

    try {
      // Check if handler exists
      const handler = this.requestHandlers.get(method);
      if (!handler) {
        throw new MethodNotFoundError(method);
      }

      // Execute handler
      const result = await handler(params);

      // Return success response
      return ProtocolHandler.createResponse(id, result);
    } catch (error) {
      // Handle errors
      if (error instanceof ACPError) {
        return ProtocolHandler.createError(
          id,
          error.code,
          error.message,
          error.data
        );
      }

      // Unexpected error - wrap as internal error
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return ProtocolHandler.createError(
        id,
        ErrorCodes.InternalError,
        message,
        error instanceof Error ? { stack: error.stack } : undefined
      );
    }
  }

  /**
   * Handle a JSON-RPC notification.
   *
   * @param notification - The JSON-RPC notification
   */
  private async handleNotification(
    notification: JsonRpcNotification
  ): Promise<void> {
    const { method, params } = notification;

    try {
      // Check if handler exists
      const handler = this.notificationHandlers.get(method);
      if (!handler) {
        // Notifications without handlers are silently ignored per JSON-RPC spec
        return;
      }

      // Execute handler (no response)
      await handler(params);
    } catch (error) {
      // Notification errors are logged but not sent back to client
      console.error(`Error handling notification ${method}:`, error);
    }
  }

  // =============================================================================
  // Static Factory Methods
  // =============================================================================

  /**
   * Create a success JSON-RPC response.
   *
   * @param id - The request ID
   * @param result - The result value
   * @returns A JSON-RPC success response
   */
  static createResponse(
    id: number | string,
    result: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  /**
   * Create an error JSON-RPC response.
   *
   * @param id - The request ID (or null for parse errors)
   * @param code - The error code
   * @param message - The error message
   * @param data - Optional additional error data
   * @returns A JSON-RPC error response
   */
  static createError(
    id: number | string | null,
    code: number,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    const error: JsonRpcError = {
      code,
      message,
    };

    if (data !== undefined) {
      error.data = data;
    }

    return {
      jsonrpc: "2.0",
      id,
      error,
    };
  }

  /**
   * Create a JSON-RPC notification.
   *
   * @param method - The notification method name
   * @param params - Optional notification parameters
   * @returns A JSON-RPC notification
   */
  static createNotification(
    method: string,
    params?: unknown
  ): JsonRpcNotification {
    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
    };

    if (params !== undefined) {
      notification.params = params;
    }

    return notification;
  }

  /**
   * Create a JSON-RPC request.
   *
   * @param id - The request ID (use generateId() if you don't have one)
   * @param method - The request method name
   * @param params - Optional request parameters
   * @returns A JSON-RPC request
   */
  static createRequest(
    id: number | string,
    method: string,
    params?: unknown
  ): JsonRpcRequest {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
    };

    if (params !== undefined) {
      request.params = params;
    }

    return request;
  }

  /**
   * Create a JSON-RPC request with an auto-generated ID.
   *
   * @param method - The request method name
   * @param params - Optional request parameters
   * @returns A JSON-RPC request with a generated ID
   */
  static createRequestWithId(method: string, params?: unknown): JsonRpcRequest {
    return ProtocolHandler.createRequest(generateId(), method, params);
  }
}
