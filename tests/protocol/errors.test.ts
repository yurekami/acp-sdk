/**
 * Tests for error classes
 */

import { describe, it, expect } from "vitest";
import {
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
} from "../../src/protocol/errors.js";
import { ErrorCodes } from "../../src/types/jsonrpc.js";

describe("error classes", () => {
  describe("ACPError", () => {
    it("should create error with code and message", () => {
      const error = new ACPError(-32000, "Test error");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ACPError);
      expect(error.code).toBe(-32000);
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("ACPError");
      expect(error.data).toBeUndefined();
    });

    it("should create error with data", () => {
      const error = new ACPError(-32000, "Test error", { field: "name" });

      expect(error.code).toBe(-32000);
      expect(error.message).toBe("Test error");
      expect(error.data).toEqual({ field: "name" });
    });

    it("should convert to JSON-RPC error without data", () => {
      const error = new ACPError(-32000, "Test error");
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32000,
        message: "Test error",
      });
    });

    it("should convert to JSON-RPC error with data", () => {
      const error = new ACPError(-32000, "Test error", {
        field: "name",
        details: "value",
      });
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32000,
        message: "Test error",
        data: {
          field: "name",
          details: "value",
        },
      });
    });

    it("should have correct prototype chain", () => {
      const error = new ACPError(-32000, "Test error");

      expect(Object.getPrototypeOf(error)).toBe(ACPError.prototype);
      expect(error instanceof ACPError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it("should capture stack trace", () => {
      const error = new ACPError(-32000, "Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ACPError");
    });
  });

  describe("ParseError", () => {
    it("should have correct error code", () => {
      const error = new ParseError();

      expect(error.code).toBe(ErrorCodes.ParseError);
      expect(error.code).toBe(-32700);
    });

    it("should use default message", () => {
      const error = new ParseError();

      expect(error.message).toBe("Parse error: Invalid JSON received");
    });

    it("should use custom message", () => {
      const error = new ParseError("Custom parse error message");

      expect(error.message).toBe("Custom parse error message");
    });

    it("should have correct name", () => {
      const error = new ParseError();

      expect(error.name).toBe("ParseError");
    });

    it("should convert to JSON-RPC error", () => {
      const error = new ParseError();
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32700,
        message: "Parse error: Invalid JSON received",
      });
    });

    it("should maintain prototype chain", () => {
      const error = new ParseError();

      expect(error instanceof ParseError).toBe(true);
      expect(error instanceof ACPError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("InvalidRequestError", () => {
    it("should have correct error code", () => {
      const error = new InvalidRequestError();

      expect(error.code).toBe(ErrorCodes.InvalidRequest);
      expect(error.code).toBe(-32600);
    });

    it("should use default message", () => {
      const error = new InvalidRequestError();

      expect(error.message).toBe(
        "Invalid request: The JSON sent is not a valid Request object"
      );
    });

    it("should use custom message", () => {
      const error = new InvalidRequestError("Custom invalid request");

      expect(error.message).toBe("Custom invalid request");
    });

    it("should have correct name", () => {
      const error = new InvalidRequestError();

      expect(error.name).toBe("InvalidRequestError");
    });

    it("should convert to JSON-RPC error", () => {
      const error = new InvalidRequestError();
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32600,
        message: "Invalid request: The JSON sent is not a valid Request object",
      });
    });
  });

  describe("MethodNotFoundError", () => {
    it("should have correct error code", () => {
      const error = new MethodNotFoundError("test/method");

      expect(error.code).toBe(ErrorCodes.MethodNotFound);
      expect(error.code).toBe(-32601);
    });

    it("should include method in message", () => {
      const error = new MethodNotFoundError("test/method");

      expect(error.message).toBe("Method not found: test/method");
    });

    it("should include method in data", () => {
      const error = new MethodNotFoundError("test/method");

      expect(error.data).toEqual({ method: "test/method" });
    });

    it("should have correct name", () => {
      const error = new MethodNotFoundError("test/method");

      expect(error.name).toBe("MethodNotFoundError");
    });

    it("should convert to JSON-RPC error with data", () => {
      const error = new MethodNotFoundError("session/prompt");
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32601,
        message: "Method not found: session/prompt",
        data: { method: "session/prompt" },
      });
    });
  });

  describe("InvalidParamsError", () => {
    it("should have correct error code", () => {
      const error = new InvalidParamsError();

      expect(error.code).toBe(ErrorCodes.InvalidParams);
      expect(error.code).toBe(-32602);
    });

    it("should use default message", () => {
      const error = new InvalidParamsError();

      expect(error.message).toBe("Invalid params: Invalid method parameter(s)");
    });

    it("should use custom message", () => {
      const error = new InvalidParamsError("Missing required field");

      expect(error.message).toBe("Missing required field");
    });

    it("should include data when provided", () => {
      const error = new InvalidParamsError("Missing field", { field: "name" });

      expect(error.data).toEqual({ field: "name" });
    });

    it("should have correct name", () => {
      const error = new InvalidParamsError();

      expect(error.name).toBe("InvalidParamsError");
    });

    it("should convert to JSON-RPC error with data", () => {
      const error = new InvalidParamsError("Missing field", {
        field: "name",
        expected: "string",
      });
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32602,
        message: "Missing field",
        data: { field: "name", expected: "string" },
      });
    });
  });

  describe("InternalError", () => {
    it("should have correct error code", () => {
      const error = new InternalError();

      expect(error.code).toBe(ErrorCodes.InternalError);
      expect(error.code).toBe(-32603);
    });

    it("should use default message", () => {
      const error = new InternalError();

      expect(error.message).toBe("Internal error");
    });

    it("should use custom message", () => {
      const error = new InternalError("Database connection failed");

      expect(error.message).toBe("Database connection failed");
    });

    it("should include data when provided", () => {
      const error = new InternalError("Error occurred", { stack: "..." });

      expect(error.data).toEqual({ stack: "..." });
    });

    it("should have correct name", () => {
      const error = new InternalError();

      expect(error.name).toBe("InternalError");
    });

    it("should convert to JSON-RPC error", () => {
      const error = new InternalError("Unexpected error");
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32603,
        message: "Unexpected error",
      });
    });
  });

  describe("SessionNotFoundError", () => {
    it("should have correct error code", () => {
      const error = new SessionNotFoundError("sess_123");

      expect(error.code).toBe(ErrorCodes.SessionNotFound);
      expect(error.code).toBe(-32000);
    });

    it("should include session ID in message", () => {
      const error = new SessionNotFoundError("sess_123");

      expect(error.message).toBe("Session not found: sess_123");
    });

    it("should include session ID in data", () => {
      const error = new SessionNotFoundError("sess_abc");

      expect(error.data).toEqual({ sessionId: "sess_abc" });
    });

    it("should have correct name", () => {
      const error = new SessionNotFoundError("sess_123");

      expect(error.name).toBe("SessionNotFoundError");
    });

    it("should convert to JSON-RPC error with data", () => {
      const error = new SessionNotFoundError("sess_xyz");
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32000,
        message: "Session not found: sess_xyz",
        data: { sessionId: "sess_xyz" },
      });
    });
  });

  describe("AuthRequiredError", () => {
    it("should have correct error code", () => {
      const error = new AuthRequiredError();

      expect(error.code).toBe(ErrorCodes.AuthRequired);
      expect(error.code).toBe(-32001);
    });

    it("should use default message", () => {
      const error = new AuthRequiredError();

      expect(error.message).toBe("Authentication required");
    });

    it("should use custom message", () => {
      const error = new AuthRequiredError("Token expired");

      expect(error.message).toBe("Token expired");
    });

    it("should have correct name", () => {
      const error = new AuthRequiredError();

      expect(error.name).toBe("AuthRequiredError");
    });

    it("should convert to JSON-RPC error", () => {
      const error = new AuthRequiredError();
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32001,
        message: "Authentication required",
      });
    });
  });

  describe("PermissionDeniedError", () => {
    it("should have correct error code", () => {
      const error = new PermissionDeniedError();

      expect(error.code).toBe(ErrorCodes.PermissionDenied);
      expect(error.code).toBe(-32002);
    });

    it("should use default message when no operation provided", () => {
      const error = new PermissionDeniedError();

      expect(error.message).toBe("Permission denied");
      expect(error.data).toBeUndefined();
    });

    it("should include operation in message when provided", () => {
      const error = new PermissionDeniedError("read_file");

      expect(error.message).toBe("Permission denied: read_file");
    });

    it("should include operation in data when provided", () => {
      const error = new PermissionDeniedError("write_file");

      expect(error.data).toEqual({ operation: "write_file" });
    });

    it("should have correct name", () => {
      const error = new PermissionDeniedError();

      expect(error.name).toBe("PermissionDeniedError");
    });

    it("should convert to JSON-RPC error with data", () => {
      const error = new PermissionDeniedError("delete_resource");
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32002,
        message: "Permission denied: delete_resource",
        data: { operation: "delete_resource" },
      });
    });
  });

  describe("OperationCancelledError", () => {
    it("should have correct error code", () => {
      const error = new OperationCancelledError();

      expect(error.code).toBe(ErrorCodes.OperationCancelled);
      expect(error.code).toBe(-32003);
    });

    it("should use default message", () => {
      const error = new OperationCancelledError();

      expect(error.message).toBe("Operation was cancelled");
    });

    it("should use custom message", () => {
      const error = new OperationCancelledError("User cancelled operation");

      expect(error.message).toBe("User cancelled operation");
    });

    it("should have correct name", () => {
      const error = new OperationCancelledError();

      expect(error.name).toBe("OperationCancelledError");
    });
  });

  describe("ResourceNotFoundError", () => {
    it("should have correct error code", () => {
      const error = new ResourceNotFoundError("File");

      expect(error.code).toBe(ErrorCodes.ResourceNotFound);
      expect(error.code).toBe(-32004);
    });

    it("should create message without resource ID", () => {
      const error = new ResourceNotFoundError("File");

      expect(error.message).toBe("File not found");
    });

    it("should create message with resource ID", () => {
      const error = new ResourceNotFoundError("File", "/path/to/file.txt");

      expect(error.message).toBe("File not found: /path/to/file.txt");
    });

    it("should include resource info in data", () => {
      const error = new ResourceNotFoundError("Document", "doc_123");

      expect(error.data).toEqual({
        resourceType: "Document",
        resourceId: "doc_123",
      });
    });

    it("should have correct name", () => {
      const error = new ResourceNotFoundError("File");

      expect(error.name).toBe("ResourceNotFoundError");
    });

    it("should convert to JSON-RPC error with data", () => {
      const error = new ResourceNotFoundError("Image", "img_456");
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32004,
        message: "Image not found: img_456",
        data: {
          resourceType: "Image",
          resourceId: "img_456",
        },
      });
    });
  });

  describe("ResourceAccessDeniedError", () => {
    it("should have correct error code", () => {
      const error = new ResourceAccessDeniedError("File");

      expect(error.code).toBe(ErrorCodes.ResourceAccessDenied);
      expect(error.code).toBe(-32005);
    });

    it("should create message without resource ID", () => {
      const error = new ResourceAccessDeniedError("File");

      expect(error.message).toBe("Access denied to File");
    });

    it("should create message with resource ID", () => {
      const error = new ResourceAccessDeniedError("File", "/private/data.txt");

      expect(error.message).toBe("Access denied to File: /private/data.txt");
    });

    it("should include resource info in data", () => {
      const error = new ResourceAccessDeniedError("Database", "db_prod");

      expect(error.data).toEqual({
        resourceType: "Database",
        resourceId: "db_prod",
      });
    });

    it("should have correct name", () => {
      const error = new ResourceAccessDeniedError("File");

      expect(error.name).toBe("ResourceAccessDeniedError");
    });
  });

  describe("InvalidSessionStateError", () => {
    it("should have correct error code", () => {
      const error = new InvalidSessionStateError("sess_123", "closed");

      expect(error.code).toBe(ErrorCodes.InvalidSessionState);
      expect(error.code).toBe(-32006);
    });

    it("should create message without expected state", () => {
      const error = new InvalidSessionStateError("sess_123", "closed");

      expect(error.message).toBe("Invalid session state: closed");
    });

    it("should create message with expected state", () => {
      const error = new InvalidSessionStateError("sess_123", "closed", "active");

      expect(error.message).toBe("Invalid session state: expected active, got closed");
    });

    it("should include state info in data", () => {
      const error = new InvalidSessionStateError("sess_123", "pending", "active");

      expect(error.data).toEqual({
        sessionId: "sess_123",
        currentState: "pending",
        expectedState: "active",
      });
    });

    it("should have correct name", () => {
      const error = new InvalidSessionStateError("sess_123", "closed");

      expect(error.name).toBe("InvalidSessionStateError");
    });
  });

  describe("CapabilityNotSupportedError", () => {
    it("should have correct error code", () => {
      const error = new CapabilityNotSupportedError("streaming");

      expect(error.code).toBe(ErrorCodes.CapabilityNotSupported);
      expect(error.code).toBe(-32007);
    });

    it("should include capability in message", () => {
      const error = new CapabilityNotSupportedError("streaming");

      expect(error.message).toBe("Capability not supported: streaming");
    });

    it("should include capability in data", () => {
      const error = new CapabilityNotSupportedError("file_upload");

      expect(error.data).toEqual({ capability: "file_upload" });
    });

    it("should have correct name", () => {
      const error = new CapabilityNotSupportedError("streaming");

      expect(error.name).toBe("CapabilityNotSupportedError");
    });
  });

  describe("RateLimitedError", () => {
    it("should have correct error code", () => {
      const error = new RateLimitedError();

      expect(error.code).toBe(ErrorCodes.RateLimited);
      expect(error.code).toBe(-32008);
    });

    it("should use standard message", () => {
      const error = new RateLimitedError();

      expect(error.message).toBe("Rate limited: Too many requests");
    });

    it("should include retryAfter in data when provided", () => {
      const error = new RateLimitedError(60000);

      expect(error.data).toEqual({ retryAfter: 60000 });
    });

    it("should not include data when retryAfter not provided", () => {
      const error = new RateLimitedError();

      expect(error.data).toBeUndefined();
    });

    it("should have correct name", () => {
      const error = new RateLimitedError();

      expect(error.name).toBe("RateLimitedError");
    });

    it("should convert to JSON-RPC error with retryAfter", () => {
      const error = new RateLimitedError(30000);
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32008,
        message: "Rate limited: Too many requests",
        data: { retryAfter: 30000 },
      });
    });
  });

  describe("TimeoutError", () => {
    it("should have correct error code", () => {
      const error = new TimeoutError();

      expect(error.code).toBe(ErrorCodes.Timeout);
      expect(error.code).toBe(-32009);
    });

    it("should use default message", () => {
      const error = new TimeoutError();

      expect(error.message).toBe("Operation timed out");
    });

    it("should include operation in message when provided", () => {
      const error = new TimeoutError("database_query");

      expect(error.message).toBe("Operation timed out: database_query");
    });

    it("should include timeout info in data", () => {
      const error = new TimeoutError("api_request", 5000);

      expect(error.data).toEqual({
        operation: "api_request",
        timeoutMs: 5000,
      });
    });

    it("should have correct name", () => {
      const error = new TimeoutError();

      expect(error.name).toBe("TimeoutError");
    });

    it("should convert to JSON-RPC error with data", () => {
      const error = new TimeoutError("file_read", 3000);
      const jsonRpcError = error.toJsonRpcError();

      expect(jsonRpcError).toEqual({
        code: -32009,
        message: "Operation timed out: file_read",
        data: {
          operation: "file_read",
          timeoutMs: 3000,
        },
      });
    });
  });

  describe("error inheritance and type checking", () => {
    it("should maintain instanceof checks for all errors", () => {
      const errors = [
        new ParseError(),
        new InvalidRequestError(),
        new MethodNotFoundError("test"),
        new InvalidParamsError(),
        new InternalError(),
        new SessionNotFoundError("sess_1"),
        new AuthRequiredError(),
        new PermissionDeniedError(),
      ];

      errors.forEach((error) => {
        expect(error instanceof ACPError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });
    });

    it("should allow catching by base class", () => {
      const throwError = () => {
        throw new MethodNotFoundError("test/method");
      };

      expect(() => {
        try {
          throwError();
        } catch (error) {
          if (error instanceof ACPError) {
            expect(error.code).toBe(-32601);
            throw error;
          }
        }
      }).toThrow(ACPError);
    });

    it("should allow catching specific error types", () => {
      const throwError = () => {
        throw new SessionNotFoundError("sess_123");
      };

      expect(() => {
        try {
          throwError();
        } catch (error) {
          if (error instanceof SessionNotFoundError) {
            expect(error.data).toEqual({ sessionId: "sess_123" });
            throw error;
          }
        }
      }).toThrow(SessionNotFoundError);
    });
  });
});
