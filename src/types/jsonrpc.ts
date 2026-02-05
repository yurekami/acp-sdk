/**
 * JSON-RPC 2.0 Base Types
 *
 * ACP uses JSON-RPC 2.0 as its communication foundation.
 * All messages are JSON objects conforming to the JSON-RPC 2.0 specification.
 *
 * @see https://www.jsonrpc.org/specification
 */

import { z } from "zod";

// =============================================================================
// Request/Response ID
// =============================================================================

/**
 * JSON-RPC request/response identifier.
 * Can be a number, string, or null (for notifications without response).
 */
export type JsonRpcId = number | string | null;

export const JsonRpcIdSchema = z.union([z.number(), z.string(), z.null()]);

// =============================================================================
// JSON-RPC Request
// =============================================================================

/**
 * A JSON-RPC 2.0 request object.
 *
 * @example
 * ```json
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "method": "session/prompt",
 *   "params": {
 *     "sessionId": "sess_abc123",
 *     "content": [{ "type": "text", "text": "Hello, agent!" }]
 *   }
 * }
 * ```
 */
export interface JsonRpcRequest<TParams = unknown> {
  /** JSON-RPC version, always "2.0" */
  jsonrpc: "2.0";
  /** Unique identifier for matching request to response */
  id: number | string;
  /** Method name to invoke */
  method: string;
  /** Method parameters (optional) */
  params?: TParams;
}

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string()]),
  method: z.string(),
  params: z.unknown().optional(),
});

// =============================================================================
// JSON-RPC Response
// =============================================================================

/**
 * A JSON-RPC 2.0 response object.
 * Contains either a result or an error, but not both.
 *
 * @example Success response:
 * ```json
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "result": { "sessionId": "sess_abc123" }
 * }
 * ```
 *
 * @example Error response:
 * ```json
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "error": {
 *     "code": -32000,
 *     "message": "Session not found"
 *   }
 * }
 * ```
 */
export interface JsonRpcResponse<TResult = unknown> {
  /** JSON-RPC version, always "2.0" */
  jsonrpc: "2.0";
  /** Identifier matching the original request */
  id: number | string | null;
  /** Result of the method invocation (mutually exclusive with error) */
  result?: TResult;
  /** Error information if the request failed (mutually exclusive with result) */
  error?: JsonRpcError;
}

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number().int(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

// =============================================================================
// JSON-RPC Notification
// =============================================================================

/**
 * A JSON-RPC 2.0 notification.
 * Notifications are one-way messages that do not expect a response.
 * They do not have an `id` field.
 *
 * @example
 * ```json
 * {
 *   "jsonrpc": "2.0",
 *   "method": "session/update",
 *   "params": {
 *     "sessionId": "sess_abc123",
 *     "type": "agent_message_chunk",
 *     "data": { "content": "Hello!" }
 *   }
 * }
 * ```
 */
export interface JsonRpcNotification<TParams = unknown> {
  /** JSON-RPC version, always "2.0" */
  jsonrpc: "2.0";
  /** Method name for the notification */
  method: string;
  /** Notification parameters (optional) */
  params?: TParams;
}

export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.unknown().optional(),
});

// =============================================================================
// JSON-RPC Error
// =============================================================================

/**
 * A JSON-RPC 2.0 error object.
 */
export interface JsonRpcError<TData = unknown> {
  /** Numeric error code */
  code: number;
  /** Human-readable error message */
  message: string;
  /** Additional error data (optional) */
  data?: TData;
}

export const JsonRpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standard JSON-RPC 2.0 error codes and ACP-specific error codes.
 *
 * @see Section 15.1 of the ACP specification
 */
export const ErrorCodes = {
  // Standard JSON-RPC errors
  /** Invalid JSON was received by the server */
  ParseError: -32700,
  /** The JSON sent is not a valid Request object */
  InvalidRequest: -32600,
  /** The method does not exist or is not available */
  MethodNotFound: -32601,
  /** Invalid method parameter(s) */
  InvalidParams: -32602,
  /** Internal JSON-RPC error */
  InternalError: -32603,

  // ACP-specific errors
  /** Referenced session doesn't exist */
  SessionNotFound: -32000,
  /** Operation requires authentication */
  AuthRequired: -32001,
  /** User denied permission */
  PermissionDenied: -32002,
  /** Operation was cancelled */
  OperationCancelled: -32003,
  /** Requested resource doesn't exist */
  ResourceNotFound: -32004,
  /** Cannot access resource */
  ResourceAccessDenied: -32005,
  /** Session in wrong state for operation */
  InvalidSessionState: -32006,
  /** Required capability not available */
  CapabilityNotSupported: -32007,
  /** Too many requests */
  RateLimited: -32008,
  /** Operation timed out */
  Timeout: -32009,
} as const;

/**
 * Type representing valid error codes
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// =============================================================================
// JSON-RPC Message Union
// =============================================================================

/**
 * Union type for any JSON-RPC message.
 */
export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcResponse
  | JsonRpcNotification;

export const JsonRpcMessageSchema = z.union([
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcNotificationSchema,
]);

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a message is a JSON-RPC request.
 */
export function isJsonRpcRequest(
  message: JsonRpcMessage
): message is JsonRpcRequest {
  return "id" in message && "method" in message && message.id !== null;
}

/**
 * Type guard to check if a message is a JSON-RPC response.
 */
export function isJsonRpcResponse(
  message: JsonRpcMessage
): message is JsonRpcResponse {
  return (
    "id" in message && ("result" in message || "error" in message) && !("method" in message)
  );
}

/**
 * Type guard to check if a message is a JSON-RPC notification.
 */
export function isJsonRpcNotification(
  message: JsonRpcMessage
): message is JsonRpcNotification {
  return "method" in message && !("id" in message);
}

/**
 * Type guard to check if a response is an error response.
 */
export function isJsonRpcError(
  response: JsonRpcResponse
): response is JsonRpcResponse & { error: JsonRpcError } {
  return "error" in response && response.error !== undefined;
}
