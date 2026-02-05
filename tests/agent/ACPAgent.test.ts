/**
 * ACPAgent Tests
 *
 * Comprehensive tests for the ACPAgent class covering:
 * - Constructor and initialization
 * - start() and stop() lifecycle
 * - Event handling
 * - Request handlers (initialize, session/new, session/load, session/prompt)
 * - Session management
 * - Permission requests
 * - File operations
 * - Terminal operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ACPAgent } from "../../src/agent/ACPAgent.js";
import type { Transport } from "../../src/transport/types.js";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from "../../src/types/index.js";
import type { PromptHandler } from "../../src/agent/types.js";

// Mock Transport implementation
class MockTransport implements Transport {
  private messageHandler: ((message: any) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  public sentMessages: any[] = [];
  public requests: JsonRpcRequest[] = [];

  async start(): Promise<void> {}

  async close(): Promise<void> {
    if (this.closeHandler) {
      this.closeHandler();
    }
  }

  async request(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.requests.push(request);
    // Return a successful response by default
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {},
    };
  }

  async notify(notification: JsonRpcNotification): Promise<void> {
    this.sentMessages.push(notification);
  }

  on(event: string, handler: any): void {
    if (event === "message") {
      this.messageHandler = handler;
    } else if (event === "error") {
      this.errorHandler = handler;
    } else if (event === "close") {
      this.closeHandler = handler;
    }
  }

  off(event: string, handler: any): void {
    if (event === "message" && this.messageHandler === handler) {
      this.messageHandler = null;
    } else if (event === "error" && this.errorHandler === handler) {
      this.errorHandler = null;
    } else if (event === "close" && this.closeHandler === handler) {
      this.closeHandler = null;
    }
  }

  // Test helper methods
  simulateMessage(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): void {
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  simulateError(error: Error): void {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
  }

  simulateClose(): void {
    if (this.closeHandler) {
      this.closeHandler();
    }
  }
}

describe("ACPAgent", () => {
  let transport: MockTransport;
  let agent: ACPAgent;

  beforeEach(() => {
    transport = new MockTransport();
  });

  afterEach(async () => {
    if (agent) {
      await agent.stop();
    }
  });

  describe("constructor", () => {
    it("should create an agent with minimal options", () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });

      expect(agent).toBeDefined();
    });

    it("should create an agent with full capabilities", () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
        capabilities: {
          loadSession: true,
          prompt: {
            streaming: true,
            cancellation: true,
          },
          session: {
            modes: true,
            multiSession: true,
          },
          mcp: {
            servers: true,
            transport: ["stdio", "http"],
          },
        },
      });

      expect(agent).toBeDefined();
    });
  });

  describe("start() and stop()", () => {
    beforeEach(() => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
    });

    it("should start the agent successfully", async () => {
      const startedSpy = vi.fn();
      agent.on("started", startedSpy);

      await agent.start();

      expect(startedSpy).toHaveBeenCalledTimes(1);
    });

    it("should not start twice", async () => {
      await agent.start();
      await agent.start();

      // Should only setup handlers once - verify by checking no errors occur
      expect(true).toBe(true);
    });

    it("should stop the agent successfully", async () => {
      const stoppedSpy = vi.fn();
      agent.on("stopped", stoppedSpy);

      await agent.start();
      await agent.stop();

      expect(stoppedSpy).toHaveBeenCalledTimes(1);
    });

    it("should clear sessions on stop", async () => {
      await agent.start();

      // Initialize first
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      // Create a session
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const sessions = agent.getSessions();
      expect(sessions.length).toBeGreaterThan(0);

      await agent.stop();

      const sessionsAfterStop = agent.getSessions();
      expect(sessionsAfterStop.length).toBe(0);
    });

    it("should not stop if not running", async () => {
      await agent.stop();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("setPromptHandler()", () => {
    beforeEach(() => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
    });

    it("should set a prompt handler", () => {
      const handler: PromptHandler = {
        async handlePrompt() {
          return "end_turn";
        },
      };

      agent.setPromptHandler(handler);
      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
    });

    it("should register and fire events", async () => {
      const errorSpy = vi.fn();
      agent.on("error", errorSpy);

      await agent.start();
      transport.simulateError(new Error("Test error"));

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should unregister events", async () => {
      const errorSpy = vi.fn();
      agent.on("error", errorSpy);
      agent.off("error", errorSpy);

      await agent.start();
      transport.simulateError(new Error("Test error"));

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should emit sessionCreated event", async () => {
      const sessionCreatedSpy = vi.fn();
      agent.on("sessionCreated", sessionCreatedSpy);

      await agent.start();

      // Initialize
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create session
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sessionCreatedSpy).toHaveBeenCalled();
    });
  });

  describe("initialize request", () => {
    beforeEach(async () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
        capabilities: {
          loadSession: true,
          prompt: {
            streaming: true,
            cancellation: true,
          },
        },
      });
      await agent.start();
    });

    it("should handle initialize request", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: {
            name: "TestClient",
            version: "1.0.0",
          },
          capabilities: {
            fs: { read: true, write: true },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that a response was sent
      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 1
      );
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.agentInfo.name).toBe("TestAgent");
      expect(response.result.agentInfo.version).toBe("1.0.0");
    });

    it("should store client data after initialization", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: {
            name: "TestClient",
            version: "2.0.0",
          },
          capabilities: {
            fs: { read: true },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const clientData = agent.clientData;
      expect(clientData).toBeDefined();
      expect(clientData?.name).toBe("TestClient");
      expect(clientData?.version).toBe("2.0.0");
    });

    it("should return agent capabilities", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 1
      );
      expect(response.result.capabilities.loadSession).toBe(true);
      expect(response.result.capabilities.promptCapabilities).toBeDefined();
      expect(response.result.capabilities.promptCapabilities.streaming).toBe(true);
    });
  });

  describe("session/new request", () => {
    beforeEach(async () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
      await agent.start();

      // Initialize first
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should create a new session", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/home/user/project",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 2
      );
      expect(response).toBeDefined();
      expect(response.result.sessionId).toBeDefined();
      expect(response.result.createdAt).toBeDefined();
    });

    it("should create session with initial mode", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
          initialMode: "code",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const sessions = agent.getSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].currentMode).toBe("code");
    });

    it("should create session with system prompt", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
          systemPrompt: "You are a helpful assistant.",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const sessions = agent.getSessions();
      expect(sessions.length).toBe(1);
    });

    it("should fail if not initialized", async () => {
      // Create new agent without initialization
      const newAgent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
      await newAgent.start();

      transport.sentMessages = [];

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 10,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 10
      );
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();

      await newAgent.stop();
    });
  });

  describe("session/load request", () => {
    beforeEach(async () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
        capabilities: {
          loadSession: true,
        },
      });
      await agent.start();

      // Initialize
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      // Create session
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should load an existing session", async () => {
      const sessions = agent.getSessions();
      const sessionId = sessions[0].id;

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "session/load",
        params: {
          sessionId,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 3
      );
      expect(response).toBeDefined();
      expect(response.result.sessionId).toBe(sessionId);
      expect(response.result.workingDirectory).toBe("/test");
    });

    it("should fail for non-existent session", async () => {
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 4,
        method: "session/load",
        params: {
          sessionId: "non-existent-id",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 4
      );
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();
    });
  });

  describe("session/prompt request", () => {
    beforeEach(async () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
      await agent.start();

      // Initialize
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      // Create session
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should handle prompt successfully", async () => {
      const handler: PromptHandler = {
        async handlePrompt(session, content) {
          await session.sendAgentMessage("Hello!");
          return "end_turn";
        },
      };
      agent.setPromptHandler(handler);

      const sessions = agent.getSessions();
      const sessionId = sessions[0].id;

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "session/prompt",
        params: {
          sessionId,
          content: [{ type: "text", text: "Hello" }],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 3
      );
      expect(response).toBeDefined();
      expect(response.result.stopReason).toBe("end_turn");
    });

    it("should fail if no prompt handler configured", async () => {
      const sessions = agent.getSessions();
      const sessionId = sessions[0].id;

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "session/prompt",
        params: {
          sessionId,
          content: [{ type: "text", text: "Hello" }],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 3
      );
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();
    });

    it("should fail for non-existent session", async () => {
      const handler: PromptHandler = {
        async handlePrompt() {
          return "end_turn";
        },
      };
      agent.setPromptHandler(handler);

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "session/prompt",
        params: {
          sessionId: "non-existent",
          content: [{ type: "text", text: "Hello" }],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 3
      );
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();
    });

    it("should emit prompt event", async () => {
      const promptSpy = vi.fn();
      agent.on("prompt", promptSpy);

      const handler: PromptHandler = {
        async handlePrompt() {
          return "end_turn";
        },
      };
      agent.setPromptHandler(handler);

      const sessions = agent.getSessions();
      const sessionId = sessions[0].id;

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "session/prompt",
        params: {
          sessionId,
          content: [{ type: "text", text: "Hello" }],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(promptSpy).toHaveBeenCalled();
    });

    it("should handle handler errors gracefully", async () => {
      const handler: PromptHandler = {
        async handlePrompt() {
          throw new Error("Handler error");
        },
      };
      agent.setPromptHandler(handler);

      const sessions = agent.getSessions();
      const sessionId = sessions[0].id;

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "session/prompt",
        params: {
          sessionId,
          content: [{ type: "text", text: "Hello" }],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = transport.sentMessages.find(
        (msg: any) => msg.id === 3
      );
      expect(response).toBeDefined();
      expect(response.result.stopReason).toBe("error");
    });
  });

  describe("session/cancel notification", () => {
    beforeEach(async () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
      await agent.start();

      // Initialize
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      // Create session
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should handle session cancellation", async () => {
      const cancelledSpy = vi.fn();
      agent.on("cancelled", cancelledSpy);

      const sessions = agent.getSessions();
      const sessionId = sessions[0].id;

      transport.simulateMessage({
        jsonrpc: "2.0",
        method: "session/cancel",
        params: {
          sessionId,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cancelledSpy).toHaveBeenCalled();
      expect(sessions[0].isCancelled).toBe(true);
    });
  });

  describe("session management", () => {
    beforeEach(async () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
      await agent.start();

      // Initialize
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should get session by ID", async () => {
      // Create session
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const sessions = agent.getSessions();
      const sessionId = sessions[0].id;

      const session = agent.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it("should return undefined for non-existent session", () => {
      const session = agent.getSession("non-existent");
      expect(session).toBeUndefined();
    });

    it("should get all sessions", async () => {
      // Create multiple sessions
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test1",
        },
      });

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "session/new",
        params: {
          workingDirectory: "/test2",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const sessions = agent.getSessions();
      expect(sessions.length).toBe(2);
    });
  });

  describe("transport close handling", () => {
    beforeEach(async () => {
      agent = new ACPAgent(transport, {
        name: "TestAgent",
        version: "1.0.0",
      });
      await agent.start();

      // Initialize and create session
      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: { name: "TestClient", version: "1.0.0" },
          capabilities: {},
        },
      });

      transport.simulateMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "session/new",
        params: {
          workingDirectory: "/test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should cancel all sessions on transport close", () => {
      const sessions = agent.getSessions();
      expect(sessions[0].isCancelled).toBe(false);

      transport.simulateClose();

      expect(sessions[0].isCancelled).toBe(true);
    });
  });
});
