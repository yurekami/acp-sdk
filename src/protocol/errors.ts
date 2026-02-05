/**
 * JSON-RPC and ACP error classes
 *
 * Provides strongly-typed error classes for all JSON-RPC and ACP-specific error codes.
 */

import { JsonRpcError, ErrorCodes } from "../types/jsonrpc.js";

/**
 * Base class for all ACP errors.
 * Extends Error and can be converted to a JSON-RPC error object.
 */
export class ACPError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ACPError";
    Object.setPrototypeOf(this, ACPError.prototype);
  }

  /**
   * Convert this error to a JSON-RPC error object.
   */
  toJsonRpcError(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    };
  }
}

// =============================================================================
// Standard JSON-RPC Errors
// =============================================================================

/**
 * Parse error - Invalid JSON was received by the server.
 */
export class ParseError extends ACPError {
  constructor(message?: string) {
    super(
      ErrorCodes.ParseError,
      message || "Parse error: Invalid JSON received"
    );
    this.name = "ParseError";
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

/**
 * Invalid request - The JSON sent is not a valid Request object.
 */
export class InvalidRequestError extends ACPError {
  constructor(message?: string) {
    super(
      ErrorCodes.InvalidRequest,
      message || "Invalid request: The JSON sent is not a valid Request object"
    );
    this.name = "InvalidRequestError";
    Object.setPrototypeOf(this, InvalidRequestError.prototype);
  }
}

/**
 * Method not found - The method does not exist or is not available.
 */
export class MethodNotFoundError extends ACPError {
  constructor(method: string) {
    super(
      ErrorCodes.MethodNotFound,
      `Method not found: ${method}`,
      { method }
    );
    this.name = "MethodNotFoundError";
    Object.setPrototypeOf(this, MethodNotFoundError.prototype);
  }
}

/**
 * Invalid params - Invalid method parameter(s).
 */
export class InvalidParamsError extends ACPError {
  constructor(message?: string, data?: unknown) {
    super(
      ErrorCodes.InvalidParams,
      message || "Invalid params: Invalid method parameter(s)",
      data
    );
    this.name = "InvalidParamsError";
    Object.setPrototypeOf(this, InvalidParamsError.prototype);
  }
}

/**
 * Internal error - Internal JSON-RPC error.
 */
export class InternalError extends ACPError {
  constructor(message?: string, data?: unknown) {
    super(
      ErrorCodes.InternalError,
      message || "Internal error",
      data
    );
    this.name = "InternalError";
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

// =============================================================================
// ACP-Specific Errors
// =============================================================================

/**
 * Session not found - Referenced session doesn't exist.
 */
export class SessionNotFoundError extends ACPError {
  constructor(sessionId: string) {
    super(
      ErrorCodes.SessionNotFound,
      `Session not found: ${sessionId}`,
      { sessionId }
    );
    this.name = "SessionNotFoundError";
    Object.setPrototypeOf(this, SessionNotFoundError.prototype);
  }
}

/**
 * Auth required - Operation requires authentication.
 */
export class AuthRequiredError extends ACPError {
  constructor(message?: string) {
    super(
      ErrorCodes.AuthRequired,
      message || "Authentication required"
    );
    this.name = "AuthRequiredError";
    Object.setPrototypeOf(this, AuthRequiredError.prototype);
  }
}

/**
 * Permission denied - User denied permission or lacks authorization.
 */
export class PermissionDeniedError extends ACPError {
  constructor(operation?: string) {
    super(
      ErrorCodes.PermissionDenied,
      operation
        ? `Permission denied: ${operation}`
        : "Permission denied",
      operation ? { operation } : undefined
    );
    this.name = "PermissionDeniedError";
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}

/**
 * Operation cancelled - The operation was cancelled.
 */
export class OperationCancelledError extends ACPError {
  constructor(message?: string) {
    super(
      ErrorCodes.OperationCancelled,
      message || "Operation was cancelled"
    );
    this.name = "OperationCancelledError";
    Object.setPrototypeOf(this, OperationCancelledError.prototype);
  }
}

/**
 * Resource not found - Requested resource doesn't exist.
 */
export class ResourceNotFoundError extends ACPError {
  constructor(resourceType: string, resourceId?: string) {
    const message = resourceId
      ? `${resourceType} not found: ${resourceId}`
      : `${resourceType} not found`;
    super(
      ErrorCodes.ResourceNotFound,
      message,
      { resourceType, resourceId }
    );
    this.name = "ResourceNotFoundError";
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

/**
 * Resource access denied - Cannot access the requested resource.
 */
export class ResourceAccessDeniedError extends ACPError {
  constructor(resourceType: string, resourceId?: string) {
    const message = resourceId
      ? `Access denied to ${resourceType}: ${resourceId}`
      : `Access denied to ${resourceType}`;
    super(
      ErrorCodes.ResourceAccessDenied,
      message,
      { resourceType, resourceId }
    );
    this.name = "ResourceAccessDeniedError";
    Object.setPrototypeOf(this, ResourceAccessDeniedError.prototype);
  }
}

/**
 * Invalid session state - Session in wrong state for the requested operation.
 */
export class InvalidSessionStateError extends ACPError {
  constructor(sessionId: string, currentState: string, expectedState?: string) {
    const message = expectedState
      ? `Invalid session state: expected ${expectedState}, got ${currentState}`
      : `Invalid session state: ${currentState}`;
    super(
      ErrorCodes.InvalidSessionState,
      message,
      { sessionId, currentState, expectedState }
    );
    this.name = "InvalidSessionStateError";
    Object.setPrototypeOf(this, InvalidSessionStateError.prototype);
  }
}

/**
 * Capability not supported - Required capability not available.
 */
export class CapabilityNotSupportedError extends ACPError {
  constructor(capability: string) {
    super(
      ErrorCodes.CapabilityNotSupported,
      `Capability not supported: ${capability}`,
      { capability }
    );
    this.name = "CapabilityNotSupportedError";
    Object.setPrototypeOf(this, CapabilityNotSupportedError.prototype);
  }
}

/**
 * Rate limited - Too many requests.
 */
export class RateLimitedError extends ACPError {
  constructor(retryAfter?: number) {
    super(
      ErrorCodes.RateLimited,
      "Rate limited: Too many requests",
      retryAfter !== undefined ? { retryAfter } : undefined
    );
    this.name = "RateLimitedError";
    Object.setPrototypeOf(this, RateLimitedError.prototype);
  }
}

/**
 * Timeout - Operation timed out.
 */
export class TimeoutError extends ACPError {
  constructor(operation?: string, timeoutMs?: number) {
    const message = operation
      ? `Operation timed out: ${operation}`
      : "Operation timed out";
    super(
      ErrorCodes.Timeout,
      message,
      { operation, timeoutMs }
    );
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
