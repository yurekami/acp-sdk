/**
 * Tests for message utilities
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
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
} from "../../src/protocol/message.js";
import { ParseError, InvalidRequestError } from "../../src/protocol/errors.js";
import { ErrorCodes } from "../../src/types/jsonrpc.js";

describe("message utilities", () => {
  describe("generateId", () => {
    beforeEach(() => {
      resetIdCounter();
    });

    it("should generate unique sequential IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).toBe("req_1");
      expect(id2).toBe("req_2");
      expect(id3).toBe("req_3");
    });

    it("should continue incrementing after multiple calls", () => {
      for (let i = 0; i < 10; i++) {
        generateId();
      }

      const id = generateId();
      expect(id).toBe("req_11");
    });
  });

  describe("resetIdCounter", () => {
    it("should reset counter to zero", () => {
      generateId(); // req_1
      generateId(); // req_2
      generateId(); // req_3

      resetIdCounter();

      const id = generateId();
      expect(id).toBe("req_1");
    });

    it("should allow counter to increment again after reset", () => {
      generateId();
      resetIdCounter();

      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBe("req_1");
      expect(id2).toBe("req_2");
    });
  });

  describe("type guards", () => {
    describe("isRequest", () => {
      it("should return true for valid request", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: 1,
          method: "test/method",
        };

        expect(isRequest(message)).toBe(true);
      });

      it("should return true for request with params", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: "req_1",
          method: "test/method",
          params: { data: "test" },
        };

        expect(isRequest(message)).toBe(true);
      });

      it("should return false for notification (no id)", () => {
        const message = {
          jsonrpc: "2.0" as const,
          method: "test/notification",
        };

        expect(isRequest(message)).toBe(false);
      });

      it("should return false for response", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: 1,
          result: "success",
        };

        expect(isRequest(message)).toBe(false);
      });

      it("should return false for null", () => {
        expect(isRequest(null)).toBe(false);
      });

      it("should return false for undefined", () => {
        expect(isRequest(undefined)).toBe(false);
      });

      it("should return false for non-object", () => {
        expect(isRequest("string")).toBe(false);
        expect(isRequest(123)).toBe(false);
        expect(isRequest(true)).toBe(false);
      });
    });

    describe("isResponse", () => {
      it("should return true for success response", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: 1,
          result: { data: "test" },
        };

        expect(isResponse(message)).toBe(true);
      });

      it("should return true for error response", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: 1,
          error: {
            code: -32600,
            message: "Invalid request",
          },
        };

        expect(isResponse(message)).toBe(true);
      });

      it("should return true for response with null ID", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: null,
          error: {
            code: ErrorCodes.ParseError,
            message: "Parse error",
          },
        };

        expect(isResponse(message)).toBe(true);
      });

      it("should return false for request", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: 1,
          method: "test/method",
        };

        expect(isResponse(message)).toBe(false);
      });

      it("should return false for notification", () => {
        const message = {
          jsonrpc: "2.0" as const,
          method: "test/notification",
        };

        expect(isResponse(message)).toBe(false);
      });

      it("should return false for null", () => {
        expect(isResponse(null)).toBe(false);
      });

      it("should return false for non-object", () => {
        expect(isResponse("string")).toBe(false);
      });
    });

    describe("isNotification", () => {
      it("should return true for notification", () => {
        const message = {
          jsonrpc: "2.0" as const,
          method: "test/notification",
        };

        expect(isNotification(message)).toBe(true);
      });

      it("should return true for notification with params", () => {
        const message = {
          jsonrpc: "2.0" as const,
          method: "test/notification",
          params: { data: "test" },
        };

        expect(isNotification(message)).toBe(true);
      });

      it("should return false for request (has id)", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: 1,
          method: "test/method",
        };

        expect(isNotification(message)).toBe(false);
      });

      it("should return false for response", () => {
        const message = {
          jsonrpc: "2.0" as const,
          id: 1,
          result: "success",
        };

        expect(isNotification(message)).toBe(false);
      });

      it("should return false for null", () => {
        expect(isNotification(null)).toBe(false);
      });

      it("should return false for non-object", () => {
        expect(isNotification(123)).toBe(false);
      });
    });

    describe("isError", () => {
      it("should return true for error response", () => {
        const response = {
          jsonrpc: "2.0" as const,
          id: 1,
          error: {
            code: -32600,
            message: "Invalid request",
          },
        };

        expect(isError(response)).toBe(true);
      });

      it("should return true for error with data", () => {
        const response = {
          jsonrpc: "2.0" as const,
          id: 1,
          error: {
            code: -32602,
            message: "Invalid params",
            data: { field: "name" },
          },
        };

        expect(isError(response)).toBe(true);
      });

      it("should return false for success response", () => {
        const response = {
          jsonrpc: "2.0" as const,
          id: 1,
          result: { success: true },
        };

        expect(isError(response)).toBe(false);
      });

      it("should return false for response with undefined error", () => {
        const response = {
          jsonrpc: "2.0" as const,
          id: 1,
          result: null,
          error: undefined,
        };

        expect(isError(response)).toBe(false);
      });
    });
  });

  describe("parseMessage", () => {
    it("should parse valid request", () => {
      const json = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
        params: { data: "test" },
      });

      const message = parseMessage(json);

      expect(message).toEqual({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
        params: { data: "test" },
      });
    });

    it("should parse valid response", () => {
      const json = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { success: true },
      });

      const message = parseMessage(json);

      expect(message).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: { success: true },
      });
    });

    it("should parse valid notification", () => {
      const json = JSON.stringify({
        jsonrpc: "2.0",
        method: "test/notification",
        params: { message: "hello" },
      });

      const message = parseMessage(json);

      expect(message).toEqual({
        jsonrpc: "2.0",
        method: "test/notification",
        params: { message: "hello" },
      });
    });

    it("should parse error response", () => {
      const json = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32600,
          message: "Invalid request",
        },
      });

      const message = parseMessage(json);

      expect(message).toEqual({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32600,
          message: "Invalid request",
        },
      });
    });

    it("should throw ParseError for invalid JSON", () => {
      expect(() => parseMessage("{invalid json")).toThrow(ParseError);
      // Just check that it throws ParseError, don't check exact message
      // since JSON.parse error messages vary
    });

    it("should throw InvalidRequestError for missing jsonrpc", () => {
      const json = JSON.stringify({
        id: 1,
        method: "test",
      });

      expect(() => parseMessage(json)).toThrow(InvalidRequestError);
    });

    it("should throw InvalidRequestError for wrong jsonrpc version", () => {
      const json = JSON.stringify({
        jsonrpc: "1.0",
        id: 1,
        method: "test",
      });

      expect(() => parseMessage(json)).toThrow(InvalidRequestError);
    });

    it("should accept response without method field", () => {
      // A message with id but no method is valid if it has result or error (response)
      const json = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: "success",
      });

      const message = parseMessage(json);
      expect(isResponse(message)).toBe(true);
    });

    it("should handle complex nested params", () => {
      const json = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
        params: {
          nested: {
            deep: {
              value: "test",
              array: [1, 2, 3],
            },
          },
        },
      });

      const message = parseMessage(json);

      expect(message).toEqual({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
        params: {
          nested: {
            deep: {
              value: "test",
              array: [1, 2, 3],
            },
          },
        },
      });
    });
  });

  describe("serializeMessage", () => {
    it("should serialize request", () => {
      const message = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "test/method",
        params: { data: "test" },
      };

      const json = serializeMessage(message);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(message);
    });

    it("should serialize response", () => {
      const message = {
        jsonrpc: "2.0" as const,
        id: 1,
        result: { success: true },
      };

      const json = serializeMessage(message);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(message);
    });

    it("should serialize notification", () => {
      const message = {
        jsonrpc: "2.0" as const,
        method: "test/notification",
      };

      const json = serializeMessage(message);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(message);
    });

    it("should serialize error response", () => {
      const message = {
        jsonrpc: "2.0" as const,
        id: 1,
        error: {
          code: -32600,
          message: "Invalid request",
          data: { details: "test" },
        },
      };

      const json = serializeMessage(message);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(message);
    });

    it("should handle complex nested structures", () => {
      const message = {
        jsonrpc: "2.0" as const,
        id: 1,
        result: {
          nested: {
            deep: {
              array: [1, 2, { value: "test" }],
            },
          },
        },
      };

      const json = serializeMessage(message);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(message);
    });
  });

  describe("validation functions", () => {
    describe("isValidMessage", () => {
      it("should return true for valid request", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          method: "test/method",
        };

        expect(isValidMessage(message)).toBe(true);
      });

      it("should return true for valid response", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          result: "success",
        };

        expect(isValidMessage(message)).toBe(true);
      });

      it("should return true for valid notification", () => {
        const message = {
          jsonrpc: "2.0",
          method: "test/notification",
        };

        expect(isValidMessage(message)).toBe(true);
      });

      it("should return false for missing jsonrpc", () => {
        const message = {
          id: 1,
          method: "test",
        };

        expect(isValidMessage(message)).toBe(false);
      });

      it("should return false for wrong jsonrpc version", () => {
        const message = {
          jsonrpc: "1.0",
          id: 1,
          method: "test",
        };

        expect(isValidMessage(message)).toBe(false);
      });

      it("should return false for null", () => {
        expect(isValidMessage(null)).toBe(false);
      });

      it("should return false for non-object", () => {
        expect(isValidMessage("string")).toBe(false);
      });
    });

    describe("isValidRequest", () => {
      it("should return true for valid request", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          method: "test/method",
        };

        expect(isValidRequest(message)).toBe(true);
      });

      it("should return true for request with params", () => {
        const message = {
          jsonrpc: "2.0",
          id: "req_1",
          method: "test/method",
          params: { data: "test" },
        };

        expect(isValidRequest(message)).toBe(true);
      });

      it("should return false for notification (no id)", () => {
        const message = {
          jsonrpc: "2.0",
          method: "test/notification",
        };

        expect(isValidRequest(message)).toBe(false);
      });

      it("should return false for response", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          result: "success",
        };

        expect(isValidRequest(message)).toBe(false);
      });

      it("should return false for invalid message", () => {
        const message = {
          id: 1,
          method: "test",
        };

        expect(isValidRequest(message)).toBe(false);
      });
    });

    describe("isValidResponse", () => {
      it("should return true for success response", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          result: { data: "test" },
        };

        expect(isValidResponse(message)).toBe(true);
      });

      it("should return true for error response", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32600,
            message: "Invalid request",
          },
        };

        expect(isValidResponse(message)).toBe(true);
      });

      it("should return true for response with null ID", () => {
        const message = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
          },
        };

        expect(isValidResponse(message)).toBe(true);
      });

      it("should return false for request", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          method: "test/method",
        };

        expect(isValidResponse(message)).toBe(false);
      });

      it("should return false for notification", () => {
        const message = {
          jsonrpc: "2.0",
          method: "test/notification",
        };

        expect(isValidResponse(message)).toBe(false);
      });

      it("should return false for invalid message", () => {
        const message = {
          id: 1,
          result: "test",
        };

        expect(isValidResponse(message)).toBe(false);
      });
    });

    describe("isValidNotification", () => {
      it("should return true for valid notification", () => {
        const message = {
          jsonrpc: "2.0",
          method: "test/notification",
        };

        expect(isValidNotification(message)).toBe(true);
      });

      it("should return true for notification with params", () => {
        const message = {
          jsonrpc: "2.0",
          method: "test/notification",
          params: { data: "test" },
        };

        expect(isValidNotification(message)).toBe(true);
      });

      it("should return false for request (has id)", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          method: "test/method",
        };

        expect(isValidNotification(message)).toBe(false);
      });

      it("should return false for response", () => {
        const message = {
          jsonrpc: "2.0",
          id: 1,
          result: "success",
        };

        expect(isValidNotification(message)).toBe(false);
      });

      it("should return false for invalid message", () => {
        const message = {
          method: "test",
        };

        expect(isValidNotification(message)).toBe(false);
      });
    });
  });

  describe("round-trip serialization", () => {
    it("should correctly round-trip request", () => {
      const original = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "test/method",
        params: { data: "test" },
      };

      const serialized = serializeMessage(original);
      const parsed = parseMessage(serialized);

      expect(parsed).toEqual(original);
    });

    it("should correctly round-trip response", () => {
      const original = {
        jsonrpc: "2.0" as const,
        id: 1,
        result: { success: true },
      };

      const serialized = serializeMessage(original);
      const parsed = parseMessage(serialized);

      expect(parsed).toEqual(original);
    });

    it("should correctly round-trip notification", () => {
      const original = {
        jsonrpc: "2.0" as const,
        method: "test/notification",
        params: { message: "hello" },
      };

      const serialized = serializeMessage(original);
      const parsed = parseMessage(serialized);

      expect(parsed).toEqual(original);
    });
  });
});
