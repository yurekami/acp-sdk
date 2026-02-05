/**
 * Tests for ProtocolHandler
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProtocolHandler } from "../../src/protocol/handler.js";
import {
  MethodNotFoundError,
  ACPError,
  InvalidParamsError,
  InternalError,
} from "../../src/protocol/errors.js";
import { ErrorCodes } from "../../src/types/jsonrpc.js";

describe("ProtocolHandler", () => {
  let handler: ProtocolHandler;

  beforeEach(() => {
    handler = new ProtocolHandler();
  });

  describe("registerRequestHandler", () => {
    it("should register request handler", () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true });

      handler.onRequest("test/method", mockHandler);

      expect(handler.hasRequestHandler("test/method")).toBe(true);
    });

    it("should allow registering multiple handlers", () => {
      handler.onRequest("method1", vi.fn());
      handler.onRequest("method2", vi.fn());

      expect(handler.hasRequestHandler("method1")).toBe(true);
      expect(handler.hasRequestHandler("method2")).toBe(true);
    });

    it("should overwrite handler if registered twice", async () => {
      const handler1 = vi.fn().mockResolvedValue("result1");
      const handler2 = vi.fn().mockResolvedValue("result2");

      handler.onRequest("test/method", handler1);
      handler.onRequest("test/method", handler2);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
      });

      expect(handler2).toHaveBeenCalled();
      expect(handler1).not.toHaveBeenCalled();
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: "result2",
      });
    });
  });

  describe("registerNotificationHandler", () => {
    it("should register notification handler", () => {
      const mockHandler = vi.fn();

      handler.onNotification("test/notification", mockHandler);

      expect(handler.hasNotificationHandler("test/notification")).toBe(true);
    });

    it("should allow registering multiple notification handlers", () => {
      handler.onNotification("notification1", vi.fn());
      handler.onNotification("notification2", vi.fn());

      expect(handler.hasNotificationHandler("notification1")).toBe(true);
      expect(handler.hasNotificationHandler("notification2")).toBe(true);
    });
  });

  describe("removeRequestHandler", () => {
    it("should remove registered handler", () => {
      handler.onRequest("test/method", vi.fn());
      expect(handler.hasRequestHandler("test/method")).toBe(true);

      const removed = handler.removeRequestHandler("test/method");

      expect(removed).toBe(true);
      expect(handler.hasRequestHandler("test/method")).toBe(false);
    });

    it("should return false if handler doesn't exist", () => {
      const removed = handler.removeRequestHandler("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("removeNotificationHandler", () => {
    it("should remove registered notification handler", () => {
      handler.onNotification("test/notification", vi.fn());
      expect(handler.hasNotificationHandler("test/notification")).toBe(true);

      const removed = handler.removeNotificationHandler("test/notification");

      expect(removed).toBe(true);
      expect(handler.hasNotificationHandler("test/notification")).toBe(false);
    });

    it("should return false if notification handler doesn't exist", () => {
      const removed = handler.removeNotificationHandler("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("handleMessage - requests", () => {
    it("should route request to correct handler", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ data: "test-result" });
      handler.onRequest("test/method", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
        params: { input: "test" },
      });

      expect(mockHandler).toHaveBeenCalledWith({ input: "test" });
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: { data: "test-result" },
      });
    });

    it("should handle request without params", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      handler.onRequest("test/method", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "test/method",
      });

      expect(mockHandler).toHaveBeenCalledWith(undefined);
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 2,
        result: { success: true },
      });
    });

    it("should handle string request IDs", async () => {
      const mockHandler = vi.fn().mockResolvedValue("ok");
      handler.onRequest("test/method", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: "req_123",
        method: "test/method",
      });

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "req_123",
        result: "ok",
      });
    });

    it("should return error for unknown method", async () => {
      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "unknown/method",
      });

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: ErrorCodes.MethodNotFound,
          message: "Method not found: unknown/method",
          data: { method: "unknown/method" },
        },
      });
    });

    it("should handle ACPError thrown by handler", async () => {
      const mockHandler = vi.fn().mockRejectedValue(
        new InvalidParamsError("Missing required field", { field: "name" })
      );
      handler.onRequest("test/method", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
      });

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: ErrorCodes.InvalidParams,
          message: "Missing required field",
          data: { field: "name" },
        },
      });
    });

    it("should wrap non-ACPError as internal error", async () => {
      const mockHandler = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected error"));
      handler.onRequest("test/method", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
      });

      expect(response).toMatchObject({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: ErrorCodes.InternalError,
          message: "Unexpected error",
          data: expect.objectContaining({
            stack: expect.any(String),
          }),
        },
      });
    });

    it("should handle non-Error thrown values", async () => {
      const mockHandler = vi.fn().mockRejectedValue("string error");
      handler.onRequest("test/method", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "test/method",
      });

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: ErrorCodes.InternalError,
          message: "Unknown error occurred",
        },
      });
    });
  });

  describe("handleMessage - notifications", () => {
    it("should route notification to correct handler", async () => {
      const mockHandler = vi.fn();
      handler.onNotification("test/notification", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        method: "test/notification",
        params: { message: "hello" },
      });

      expect(mockHandler).toHaveBeenCalledWith({ message: "hello" });
      expect(response).toBeNull();
    });

    it("should handle notification without params", async () => {
      const mockHandler = vi.fn();
      handler.onNotification("test/notification", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        method: "test/notification",
      });

      expect(mockHandler).toHaveBeenCalledWith(undefined);
      expect(response).toBeNull();
    });

    it("should silently ignore unknown notification", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        method: "unknown/notification",
      });

      expect(response).toBeNull();
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log errors from notification handlers", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockHandler = vi.fn().mockRejectedValue(new Error("Handler error"));
      handler.onNotification("test/notification", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        method: "test/notification",
      });

      expect(response).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error handling notification test/notification:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle async notification handlers", async () => {
      const mockHandler = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10))
      );
      handler.onNotification("test/notification", mockHandler);

      const response = await handler.handleMessage({
        jsonrpc: "2.0",
        method: "test/notification",
      });

      expect(mockHandler).toHaveBeenCalled();
      expect(response).toBeNull();
    });
  });

  describe("static factory methods", () => {
    describe("createResponse", () => {
      it("should create success response", () => {
        const response = ProtocolHandler.createResponse(1, { data: "test" });

        expect(response).toEqual({
          jsonrpc: "2.0",
          id: 1,
          result: { data: "test" },
        });
      });

      it("should handle string ID", () => {
        const response = ProtocolHandler.createResponse("req_1", null);

        expect(response).toEqual({
          jsonrpc: "2.0",
          id: "req_1",
          result: null,
        });
      });
    });

    describe("createError", () => {
      it("should create error response", () => {
        const response = ProtocolHandler.createError(
          1,
          ErrorCodes.InvalidParams,
          "Invalid parameters"
        );

        expect(response).toEqual({
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: ErrorCodes.InvalidParams,
            message: "Invalid parameters",
          },
        });
      });

      it("should include error data when provided", () => {
        const response = ProtocolHandler.createError(
          2,
          ErrorCodes.InvalidParams,
          "Missing field",
          { field: "name" }
        );

        expect(response).toEqual({
          jsonrpc: "2.0",
          id: 2,
          error: {
            code: ErrorCodes.InvalidParams,
            message: "Missing field",
            data: { field: "name" },
          },
        });
      });

      it("should handle null ID for parse errors", () => {
        const response = ProtocolHandler.createError(
          null,
          ErrorCodes.ParseError,
          "Invalid JSON"
        );

        expect(response).toEqual({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: ErrorCodes.ParseError,
            message: "Invalid JSON",
          },
        });
      });

      it("should not include data field when undefined", () => {
        const response = ProtocolHandler.createError(
          1,
          ErrorCodes.InternalError,
          "Internal error",
          undefined
        );

        expect(response).toEqual({
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: ErrorCodes.InternalError,
            message: "Internal error",
          },
        });
        expect("data" in response.error!).toBe(false);
      });
    });

    describe("createNotification", () => {
      it("should create notification without params", () => {
        const notification = ProtocolHandler.createNotification("test/event");

        expect(notification).toEqual({
          jsonrpc: "2.0",
          method: "test/event",
        });
        expect("params" in notification).toBe(false);
      });

      it("should create notification with params", () => {
        const notification = ProtocolHandler.createNotification("test/event", {
          data: "value",
        });

        expect(notification).toEqual({
          jsonrpc: "2.0",
          method: "test/event",
          params: { data: "value" },
        });
      });
    });

    describe("createRequest", () => {
      it("should create request without params", () => {
        const request = ProtocolHandler.createRequest(1, "test/method");

        expect(request).toEqual({
          jsonrpc: "2.0",
          id: 1,
          method: "test/method",
        });
        expect("params" in request).toBe(false);
      });

      it("should create request with params", () => {
        const request = ProtocolHandler.createRequest(2, "test/method", {
          input: "test",
        });

        expect(request).toEqual({
          jsonrpc: "2.0",
          id: 2,
          method: "test/method",
          params: { input: "test" },
        });
      });

      it("should handle string ID", () => {
        const request = ProtocolHandler.createRequest("req_1", "test/method");

        expect(request).toEqual({
          jsonrpc: "2.0",
          id: "req_1",
          method: "test/method",
        });
      });
    });

    describe("createRequestWithId", () => {
      it("should create request with auto-generated ID", () => {
        const request1 = ProtocolHandler.createRequestWithId("test/method");
        const request2 = ProtocolHandler.createRequestWithId("test/method");

        expect(request1.id).toBeTruthy();
        expect(request2.id).toBeTruthy();
        expect(request1.id).not.toBe(request2.id);
      });

      it("should create request with params and auto-generated ID", () => {
        const request = ProtocolHandler.createRequestWithId("test/method", {
          data: "test",
        });

        expect(request).toMatchObject({
          jsonrpc: "2.0",
          method: "test/method",
          params: { data: "test" },
        });
        expect(request.id).toBeTruthy();
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle multiple concurrent requests", async () => {
      const handler1 = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve("result1"), 20))
        );
      const handler2 = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve("result2"), 10))
        );

      handler.onRequest("method1", handler1);
      handler.onRequest("method2", handler2);

      const [response1, response2] = await Promise.all([
        handler.handleMessage({
          jsonrpc: "2.0",
          id: 1,
          method: "method1",
        }),
        handler.handleMessage({
          jsonrpc: "2.0",
          id: 2,
          method: "method2",
        }),
      ]);

      expect(response1).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: "result1",
      });
      expect(response2).toEqual({
        jsonrpc: "2.0",
        id: 2,
        result: "result2",
      });
    });

    it("should handle mixed requests and notifications", async () => {
      const requestHandler = vi.fn().mockResolvedValue("request-result");
      const notificationHandler = vi.fn();

      handler.onRequest("test/request", requestHandler);
      handler.onNotification("test/notification", notificationHandler);

      const [requestResponse, notificationResponse] = await Promise.all([
        handler.handleMessage({
          jsonrpc: "2.0",
          id: 1,
          method: "test/request",
        }),
        handler.handleMessage({
          jsonrpc: "2.0",
          method: "test/notification",
        }),
      ]);

      expect(requestHandler).toHaveBeenCalled();
      expect(notificationHandler).toHaveBeenCalled();
      expect(requestResponse).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: "request-result",
      });
      expect(notificationResponse).toBeNull();
    });
  });
});
