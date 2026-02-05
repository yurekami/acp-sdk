/**
 * JSON-RPC 2.0 protocol handling
 *
 * Implements the core JSON-RPC protocol used by ACP
 */

// Handler
export {
  ProtocolHandler,
  type RequestHandler,
  type NotificationHandler,
} from "./handler.js";

// Message utilities
export {
  generateId,
  resetIdCounter,
  isRequest,
  isResponse,
  isNotification,
  isError,
  parseMessage,
  serializeMessage,
  isValidMessage,
  isValidRequest,
  isValidResponse,
  isValidNotification,
} from "./message.js";

// Error classes
export {
  ACPError,
  ParseError,
  InvalidRequestError,
  MethodNotFoundError,
  InvalidParamsError,
  InternalError,
  SessionNotFoundError,
  AuthRequiredError,
  PermissionDeniedError,
  OperationCancelledError,
  ResourceNotFoundError,
  ResourceAccessDeniedError,
  InvalidSessionStateError,
  CapabilityNotSupportedError,
  RateLimitedError,
  TimeoutError,
} from "./errors.js";
