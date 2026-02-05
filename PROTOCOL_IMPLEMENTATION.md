# JSON-RPC Protocol Handler Implementation

This document describes the JSON-RPC protocol handler implementation for the ACP SDK.

## Implemented Files

### 1. `src/protocol/handler.ts` - Protocol Handler

The main protocol handler class that routes JSON-RPC messages to registered handlers.

**Key Features:**
- `ProtocolHandler` class for message routing
- Request handler registration with `onRequest(method, handler)`
- Notification handler registration with `onNotification(method, handler)`
- Automatic error handling and response generation
- Static factory methods for creating requests, responses, notifications, and errors

**API:**
```typescript
class ProtocolHandler {
  // Register handlers
  onRequest(method: string, handler: RequestHandler): void
  onNotification(method: string, handler: NotificationHandler): void

  // Remove handlers
  removeRequestHandler(method: string): boolean
  removeNotificationHandler(method: string): boolean

  // Check handlers
  hasRequestHandler(method: string): boolean
  hasNotificationHandler(method: string): boolean

  // Handle incoming messages
  async handleMessage(message: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | null>

  // Static factory methods
  static createResponse(id: number | string, result: unknown): JsonRpcResponse
  static createError(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcResponse
  static createNotification(method: string, params?: unknown): JsonRpcNotification
  static createRequest(id: number | string, method: string, params?: unknown): JsonRpcRequest
  static createRequestWithId(method: string, params?: unknown): JsonRpcRequest
}
```

### 2. `src/protocol/message.ts` - Message Utilities

Utility functions for message handling, parsing, and validation.

**Key Features:**
- Unique ID generation with `generateId()`
- Type guards: `isRequest()`, `isResponse()`, `isNotification()`, `isError()`
- Message parsing and validation with `parseMessage()`
- Message serialization with `serializeMessage()`
- Additional validation helpers: `isValidMessage()`, `isValidRequest()`, `isValidResponse()`, `isValidNotification()`

**API:**
```typescript
// ID generation
function generateId(): string
function resetIdCounter(): void

// Type guards
function isRequest(message: unknown): message is JsonRpcRequest
function isResponse(message: unknown): message is JsonRpcResponse
function isNotification(message: unknown): message is JsonRpcNotification
function isError(response: JsonRpcResponse): boolean

// Parse and serialize
function parseMessage(data: string): JsonRpcRequest | JsonRpcResponse | JsonRpcNotification
function serializeMessage(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): string

// Validation
function isValidMessage(message: unknown): message is JsonRpcMessage
function isValidRequest(message: unknown): message is JsonRpcRequest
function isValidResponse(message: unknown): message is JsonRpcResponse
function isValidNotification(message: unknown): message is JsonRpcNotification
```

### 3. `src/protocol/errors.ts` - Error Helpers

Strongly-typed error classes for all JSON-RPC and ACP-specific error codes.

**Key Features:**
- `ACPError` base class with `toJsonRpcError()` method
- Standard JSON-RPC error classes:
  - `ParseError`
  - `InvalidRequestError`
  - `MethodNotFoundError`
  - `InvalidParamsError`
  - `InternalError`
- ACP-specific error classes:
  - `SessionNotFoundError`
  - `AuthRequiredError`
  - `PermissionDeniedError`
  - `OperationCancelledError`
  - `ResourceNotFoundError`
  - `ResourceAccessDeniedError`
  - `InvalidSessionStateError`
  - `CapabilityNotSupportedError`
  - `RateLimitedError`
  - `TimeoutError`

**API:**
```typescript
class ACPError extends Error {
  constructor(code: number, message: string, data?: unknown)
  toJsonRpcError(): JsonRpcError
}

// Standard JSON-RPC errors
class ParseError extends ACPError
class InvalidRequestError extends ACPError
class MethodNotFoundError extends ACPError
class InvalidParamsError extends ACPError
class InternalError extends ACPError

// ACP-specific errors
class SessionNotFoundError extends ACPError
class AuthRequiredError extends ACPError
class PermissionDeniedError extends ACPError
class OperationCancelledError extends ACPError
class ResourceNotFoundError extends ACPError
class ResourceAccessDeniedError extends ACPError
class InvalidSessionStateError extends ACPError
class CapabilityNotSupportedError extends ACPError
class RateLimitedError extends ACPError
class TimeoutError extends ACPError
```

### 4. `src/protocol/index.ts` - Barrel Exports

Central export point for all protocol utilities.

## Usage Example

See `examples/protocol-handler-demo.ts` for a complete working example.

```typescript
import {
  ProtocolHandler,
  parseMessage,
  serializeMessage,
  SessionNotFoundError,
} from "@anthropic/acp-sdk/protocol";

// Create handler
const handler = new ProtocolHandler();

// Register request handler
handler.onRequest("session/prompt", async (params) => {
  const { sessionId, content } = params as PromptParams;

  if (!sessionExists(sessionId)) {
    throw new SessionNotFoundError(sessionId);
  }

  return await processPrompt(sessionId, content);
});

// Register notification handler
handler.onNotification("session/update", (params) => {
  console.log("Session updated:", params);
});

// Handle incoming message
const request = parseMessage(jsonString);
const response = await handler.handleMessage(request);

if (response) {
  send(serializeMessage(response));
}
```

## Features

✅ Full JSON-RPC 2.0 compliance
✅ Type-safe message handling
✅ Automatic error conversion
✅ Request and notification routing
✅ Strongly-typed error classes
✅ Message parsing and validation
✅ Factory methods for message creation
✅ Comprehensive TypeScript types
✅ Zero external dependencies (except Zod for validation)

## Build Status

All files compile successfully with TypeScript strict mode enabled:
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `strict: true`
- `exactOptionalPropertyTypes: true`

## Testing

Run the demo:
```bash
npx tsx examples/protocol-handler-demo.ts
```

Expected output shows:
- Successful request/response handling
- Error responses for invalid sessions
- Notification handling (no response)
- Method not found errors
