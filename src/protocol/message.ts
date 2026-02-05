/**
 * JSON-RPC message utilities
 *
 * Provides utilities for generating, parsing, validating, and serializing JSON-RPC messages.
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessage,
  JsonRpcMessageSchema,
  isJsonRpcRequest as baseIsJsonRpcRequest,
  isJsonRpcResponse as baseIsJsonRpcResponse,
  isJsonRpcNotification as baseIsJsonRpcNotification,
  isJsonRpcError as baseIsJsonRpcError,
} from "../types/jsonrpc.js";
import { ParseError, InvalidRequestError } from "./errors.js";

/**
 * Counter for generating sequential request IDs
 */
let idCounter = 0;

/**
 * Generate a unique request ID.
 * Uses a simple counter that increments with each call.
 *
 * @returns A unique string ID in the format "req_N"
 */
export function generateId(): string {
  return `req_${++idCounter}`;
}

/**
 * Reset the ID counter (useful for testing).
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a message is a JSON-RPC request.
 * A request has both an `id` and a `method` field.
 *
 * @param message - The message to check
 * @returns True if the message is a request
 */
export function isRequest(message: unknown): message is JsonRpcRequest {
  if (!message || typeof message !== "object") {
    return false;
  }
  return baseIsJsonRpcRequest(message as JsonRpcMessage);
}

/**
 * Type guard to check if a message is a JSON-RPC response.
 * A response has an `id` and either a `result` or `error` field.
 *
 * @param message - The message to check
 * @returns True if the message is a response
 */
export function isResponse(message: unknown): message is JsonRpcResponse {
  if (!message || typeof message !== "object") {
    return false;
  }
  return baseIsJsonRpcResponse(message as JsonRpcMessage);
}

/**
 * Type guard to check if a message is a JSON-RPC notification.
 * A notification has a `method` field but no `id` field.
 *
 * @param message - The message to check
 * @returns True if the message is a notification
 */
export function isNotification(
  message: unknown
): message is JsonRpcNotification {
  if (!message || typeof message !== "object") {
    return false;
  }
  return baseIsJsonRpcNotification(message as JsonRpcMessage);
}

/**
 * Type guard to check if a response contains an error.
 *
 * @param response - The response to check
 * @returns True if the response is an error response
 */
export function isError(response: JsonRpcResponse): boolean {
  return baseIsJsonRpcError(response);
}

// =============================================================================
// Parsing and Validation
// =============================================================================

/**
 * Parse and validate a JSON-RPC message from a string.
 *
 * @param data - The JSON string to parse
 * @returns The parsed and validated message
 * @throws {ParseError} If the JSON is invalid
 * @throws {InvalidRequestError} If the message doesn't conform to JSON-RPC 2.0
 */
export function parseMessage(
  data: string
): JsonRpcRequest | JsonRpcResponse | JsonRpcNotification {
  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch (error) {
    throw new ParseError(
      error instanceof Error ? error.message : "Invalid JSON"
    );
  }

  // Validate against schema
  const result = JsonRpcMessageSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidRequestError(
      `Invalid JSON-RPC message: ${result.error.message}`
    );
  }

  // Return the validated data, which is guaranteed to match one of our union types
  return result.data as JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;
}

/**
 * Serialize a JSON-RPC message to a JSON string.
 *
 * @param message - The message to serialize
 * @returns The JSON string representation
 */
export function serializeMessage(
  message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification
): string {
  return JSON.stringify(message);
}

// =============================================================================
// Message Validation
// =============================================================================

/**
 * Validate that a message is a well-formed JSON-RPC message.
 * Does not throw, returns boolean.
 *
 * @param message - The message to validate
 * @returns True if the message is valid
 */
export function isValidMessage(message: unknown): message is JsonRpcMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const result = JsonRpcMessageSchema.safeParse(message);
  return result.success;
}

/**
 * Validate that a message is a well-formed JSON-RPC request.
 *
 * @param message - The message to validate
 * @returns True if the message is a valid request
 */
export function isValidRequest(message: unknown): message is JsonRpcRequest {
  return isValidMessage(message) && isRequest(message);
}

/**
 * Validate that a message is a well-formed JSON-RPC response.
 *
 * @param message - The message to validate
 * @returns True if the message is a valid response
 */
export function isValidResponse(message: unknown): message is JsonRpcResponse {
  return isValidMessage(message) && isResponse(message);
}

/**
 * Validate that a message is a well-formed JSON-RPC notification.
 *
 * @param message - The message to validate
 * @returns True if the message is a valid notification
 */
export function isValidNotification(
  message: unknown
): message is JsonRpcNotification {
  return isValidMessage(message) && isNotification(message);
}
