/**
 * AgentSession Tests
 *
 * Comprehensive tests for the AgentSession class covering:
 * - Constructor and properties
 * - Session updates (messages, thoughts, plans)
 * - Tool call creation and management
 * - Permission requests
 * - File operations
 * - Terminal creation and management
 * - Mode management
 * - Cancellation handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentSession, type SessionRequestHandler } from "../../src/agent/AgentSession.js";
import type {
  SessionUpdate,
  ToolCall,
  ToolCallId,
  ToolCallStatus,
  ToolCallContent,
  PermissionOption,
  SessionMode,
  TerminalExitStatus,
  TerminalSignal,
  SessionId,
} from "../../src/types/index.js";
import type {
  SessionData,
  AgentPermissionOutcome,
} from "../../src/agent/types.js";

// Mock SessionRequestHandler
class MockRequestHandler implements SessionRequestHandler {
  public updates: SessionUpdate[] = [];
  public permissionRequests: any[] = [];
  public fileReads: any[] = [];
  public fileWrites: any[] = [];
  public terminals: Map<string, any> = new Map();
  private terminalCounter = 0;

  async sendSessionUpdate(sessionId: SessionId, update: SessionUpdate): Promise<void> {
    this.updates.push(update);
  }

  async requestPermission(
    sessionId: SessionId,
    operation: string,
    resource: string,
    toolCallId: ToolCallId,
    options: PermissionOption[],
    reason?: string
  ): Promise<AgentPermissionOutcome> {
    this.permissionRequests.push({
      sessionId,
      operation,
      resource,
      toolCallId,
      options,
      reason,
    });

    return {
      outcome: "granted",
      granted: true,
      remember: false,
    };
  }

  async readFile(
    path: string,
    startLine?: number,
    endLine?: number
  ): Promise<string> {
    this.fileReads.push({ path, startLine, endLine });
    return "file content";
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.fileWrites.push({ path, content });
  }

  async createTerminal(
    command: string,
    args?: string[],
    cwd?: string,
    env?: Record<string, string>,
    timeout?: number
  ): Promise<string> {
    const terminalId = `term_${++this.terminalCounter}`;
    this.terminals.set(terminalId, {
      command,
      args,
      cwd,
      env,
      timeout,
    });
    return terminalId;
  }

  async getTerminalOutput(terminalId: string): Promise<{
    output: string;
    truncated: boolean;
    exitStatus?: TerminalExitStatus;
  }> {
    return {
      output: "terminal output",
      truncated: false,
    };
  }

  async waitForTerminalExit(
    terminalId: string,
    timeout?: number
  ): Promise<TerminalExitStatus> {
    return {
      exitCode: 0,
    };
  }

  async killTerminal(terminalId: string, signal?: TerminalSignal): Promise<boolean> {
    return true;
  }

  async releaseTerminal(terminalId: string): Promise<boolean> {
    this.terminals.delete(terminalId);
    return true;
  }

  async setSessionMode(
    sessionId: SessionId,
    mode: SessionMode
  ): Promise<{ previousMode: SessionMode; currentMode: SessionMode }> {
    return {
      previousMode: "default",
      currentMode: mode,
    };
  }
}

describe("AgentSession", () => {
  let requestHandler: MockRequestHandler;
  let sessionData: SessionData;
  let session: AgentSession;

  beforeEach(() => {
    requestHandler = new MockRequestHandler();
    sessionData = {
      id: "sess_123",
      workingDirectory: "/home/user/project",
      mcpServers: [
        {
          name: "test-server",
          command: "node",
          args: ["server.js"],
        },
      ],
      configOptions: { theme: "dark" },
      createdAt: "2024-01-01T00:00:00Z",
      cancelled: false,
      messageCount: 0,
    };
    session = new AgentSession(requestHandler, sessionData);
  });

  describe("constructor and properties", () => {
    it("should initialize with correct properties", () => {
      expect(session.id).toBe("sess_123");
      expect(session.workingDirectory).toBe("/home/user/project");
      expect(session.mcpServers).toHaveLength(1);
      expect(session.mcpServers[0].name).toBe("test-server");
    });

    it("should have correct initial cancelled state", () => {
      expect(session.isCancelled).toBe(false);
    });

    it("should have undefined currentMode initially", () => {
      expect(session.currentMode).toBeUndefined();
    });

    it("should set currentMode if provided in data", () => {
      const dataWithMode: SessionData = {
        ...sessionData,
        currentMode: "code",
      };
      const sessionWithMode = new AgentSession(requestHandler, dataWithMode);
      expect(sessionWithMode.currentMode).toBe("code");
    });
  });

  describe("cancellation", () => {
    it("should mark session as cancelled", () => {
      expect(session.isCancelled).toBe(false);
      session.markCancelled();
      expect(session.isCancelled).toBe(true);
    });

    it("should throw if cancelled when calling throwIfCancelled", () => {
      session.markCancelled();
      expect(() => session.throwIfCancelled()).toThrow("Session cancelled");
    });

    it("should not throw if not cancelled", () => {
      expect(() => session.throwIfCancelled()).not.toThrow();
    });
  });

  describe("sendUpdate()", () => {
    it("should send a raw session update", async () => {
      const update: SessionUpdate = {
        sessionId: session.id,
        type: "agent_message_chunk",
        data: { content: "Hello", index: 0 },
        timestamp: new Date().toISOString(),
      };

      await session.sendUpdate(update);

      expect(requestHandler.updates).toHaveLength(1);
      expect(requestHandler.updates[0]).toEqual(update);
    });
  });

  describe("sendAgentMessage()", () => {
    it("should send agent message with auto-incremented index", async () => {
      await session.sendAgentMessage("Hello");

      expect(requestHandler.updates).toHaveLength(1);
      const update = requestHandler.updates[0];
      expect(update.type).toBe("agent_message_chunk");
      expect(update.data.content).toBe("Hello");
      expect(update.data.index).toBe(0);
    });

    it("should increment index for multiple messages", async () => {
      await session.sendAgentMessage("First");
      await session.sendAgentMessage("Second");

      expect(requestHandler.updates).toHaveLength(2);
      expect(requestHandler.updates[0].data.index).toBe(0);
      expect(requestHandler.updates[1].data.index).toBe(1);
    });

    it("should use provided index", async () => {
      await session.sendAgentMessage("Hello", 5);

      expect(requestHandler.updates[0].data.index).toBe(5);
    });

    it("should include final flag when provided", async () => {
      await session.sendAgentMessage("Done", undefined, true);

      expect(requestHandler.updates[0].data.final).toBe(true);
    });

    it("should not include final flag when not provided", async () => {
      await session.sendAgentMessage("Hello");

      expect(requestHandler.updates[0].data.final).toBeUndefined();
    });
  });

  describe("sendThought()", () => {
    it("should send thought with auto-incremented index", async () => {
      await session.sendThought("Thinking...");

      expect(requestHandler.updates).toHaveLength(1);
      const update = requestHandler.updates[0];
      expect(update.type).toBe("thought_message_chunk");
      expect(update.data.content).toBe("Thinking...");
      expect(update.data.index).toBe(0);
    });

    it("should increment index for multiple thoughts", async () => {
      await session.sendThought("First thought");
      await session.sendThought("Second thought");

      expect(requestHandler.updates).toHaveLength(2);
      expect(requestHandler.updates[0].data.index).toBe(0);
      expect(requestHandler.updates[1].data.index).toBe(1);
    });

    it("should use provided index", async () => {
      await session.sendThought("Hello", 3);

      expect(requestHandler.updates[0].data.index).toBe(3);
    });

    it("should include visible flag when provided", async () => {
      await session.sendThought("Visible thought", undefined, true);

      expect(requestHandler.updates[0].data.visible).toBe(true);
    });

    it("should not include visible flag when not provided", async () => {
      await session.sendThought("Hidden thought");

      expect(requestHandler.updates[0].data.visible).toBeUndefined();
    });
  });

  describe("sendPlan()", () => {
    it("should send a plan", async () => {
      const plan = {
        steps: [
          {
            id: "step_1",
            description: "Read file",
            status: "pending" as const,
          },
        ],
      };

      await session.sendPlan(plan);

      expect(requestHandler.updates).toHaveLength(1);
      const update = requestHandler.updates[0];
      expect(update.type).toBe("plan");
      expect(update.data).toEqual(plan);
    });
  });

  describe("startToolCall()", () => {
    it("should create a tool call builder", () => {
      const builder = session.startToolCall({
        tool: "read_file",
        input: { path: "/test.txt" },
      });

      expect(builder).toBeDefined();
      expect(builder.id).toContain("tc_");
    });

    it("should create unique tool call IDs", () => {
      const builder1 = session.startToolCall({
        tool: "tool1",
        input: {},
      });
      const builder2 = session.startToolCall({
        tool: "tool2",
        input: {},
      });

      expect(builder1.id).not.toBe(builder2.id);
    });

    it("should create builder with all options", () => {
      const builder = session.startToolCall({
        tool: "edit_file",
        input: { path: "/test.txt", content: "new content" },
        kind: "edit",
        requiresPermission: true,
        reason: "Update configuration",
        location: {
          path: "/test.txt",
          line: 10,
        },
      });

      expect(builder).toBeDefined();
    });
  });

  describe("requestPermission()", () => {
    it("should request permission from handler", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "write_file",
        input: { path: "/test.txt" },
        status: "pending",
        kind: "edit",
      };

      const options: PermissionOption[] = [
        { id: "allow", label: "Allow" },
        { id: "deny", label: "Deny" },
      ];

      const outcome = await session.requestPermission(toolCall, options);

      expect(outcome.granted).toBe(true);
      expect(requestHandler.permissionRequests).toHaveLength(1);
      expect(requestHandler.permissionRequests[0].operation).toBe("file_write");
      expect(requestHandler.permissionRequests[0].resource).toBe("/test.txt");
    });

    it("should infer operation from kind", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "custom_tool",
        input: {},
        status: "pending",
        kind: "read",
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].operation).toBe("file_read");
    });

    it("should infer operation from tool name", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "delete_file",
        input: { path: "/test.txt" },
        status: "pending",
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].operation).toBe("file_delete");
    });

    it("should infer resource from input path", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "read_file",
        input: { path: "/custom/path.txt" },
        status: "pending",
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].resource).toBe("/custom/path.txt");
    });

    it("should infer resource from location", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "edit",
        input: {},
        status: "pending",
        location: { path: "/location/file.txt" },
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].resource).toBe("/location/file.txt");
    });
  });

  describe("readFile()", () => {
    it("should read a file", async () => {
      const content = await session.readFile("/test.txt");

      expect(content).toBe("file content");
      expect(requestHandler.fileReads).toHaveLength(1);
      expect(requestHandler.fileReads[0].path).toBe("/test.txt");
    });

    it("should read file with line range", async () => {
      await session.readFile("/test.txt", 10, 20);

      expect(requestHandler.fileReads[0].startLine).toBe(10);
      expect(requestHandler.fileReads[0].endLine).toBe(20);
    });
  });

  describe("writeFile()", () => {
    it("should write a file", async () => {
      await session.writeFile("/test.txt", "new content");

      expect(requestHandler.fileWrites).toHaveLength(1);
      expect(requestHandler.fileWrites[0].path).toBe("/test.txt");
      expect(requestHandler.fileWrites[0].content).toBe("new content");
    });
  });

  describe("createTerminal()", () => {
    it("should create a terminal", async () => {
      const terminal = await session.createTerminal("npm", ["test"]);

      expect(terminal).toBeDefined();
      expect(terminal.id).toContain("term_");
      expect(requestHandler.terminals.size).toBe(1);
    });

    it("should create terminal with options", async () => {
      const terminal = await session.createTerminal("npm", ["test"], {
        cwd: "/project",
        env: { NODE_ENV: "test" },
        timeout: 5000,
      });

      expect(terminal).toBeDefined();
      const termData = requestHandler.terminals.get(terminal.id);
      expect(termData.cwd).toBe("/project");
      expect(termData.env).toEqual({ NODE_ENV: "test" });
      expect(termData.timeout).toBe(5000);
    });

    it("should create multiple terminals with unique IDs", async () => {
      const terminal1 = await session.createTerminal("ls");
      const terminal2 = await session.createTerminal("pwd");

      expect(terminal1.id).not.toBe(terminal2.id);
      expect(requestHandler.terminals.size).toBe(2);
    });
  });

  describe("setMode()", () => {
    it("should set session mode", async () => {
      await session.setMode("code");

      expect(session.currentMode).toBe("code");
    });

    it("should send mode update notification", async () => {
      await session.setMode("chat");

      const update = requestHandler.updates.find(
        (u) => u.type === "current_mode_update"
      );
      expect(update).toBeDefined();
      expect(update?.data.currentMode).toBe("chat");
      expect(update?.data.previousMode).toBe("default");
    });
  });

  describe("getData() and updateData()", () => {
    it("should get session data", () => {
      const data = session.getData();

      expect(data.id).toBe("sess_123");
      expect(data.workingDirectory).toBe("/home/user/project");
    });

    it("should update session data", () => {
      session.updateData({ messageCount: 5 });

      const data = session.getData();
      expect(data.messageCount).toBe(5);
    });

    it("should partially update data", () => {
      const originalWorkingDir = session.workingDirectory;
      session.updateData({ messageCount: 3 });

      const data = session.getData();
      expect(data.messageCount).toBe(3);
      expect(data.workingDirectory).toBe(originalWorkingDir);
    });
  });

  describe("streaming message behavior", () => {
    it("should maintain separate counters for messages and thoughts", async () => {
      await session.sendAgentMessage("Message 1");
      await session.sendThought("Thought 1");
      await session.sendAgentMessage("Message 2");
      await session.sendThought("Thought 2");

      const messages = requestHandler.updates.filter(
        (u) => u.type === "agent_message_chunk"
      );
      const thoughts = requestHandler.updates.filter(
        (u) => u.type === "thought_message_chunk"
      );

      expect(messages[0].data.index).toBe(0);
      expect(messages[1].data.index).toBe(1);
      expect(thoughts[0].data.index).toBe(0);
      expect(thoughts[1].data.index).toBe(1);
    });
  });

  describe("operation inference", () => {
    it("should infer terminal_execute from execute kind", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "run",
        input: { command: "npm test" },
        status: "pending",
        kind: "execute",
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].operation).toBe("terminal_execute");
    });

    it("should infer network_access from fetch kind", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "http_get",
        input: { url: "https://api.example.com" },
        status: "pending",
        kind: "fetch",
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].operation).toBe("network_access");
    });

    it("should infer operation from tool name containing mcp", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "mcp_server_call",
        input: {},
        status: "pending",
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].operation).toBe("mcp_tool");
    });

    it("should default to other for unknown operations", async () => {
      const toolCall: ToolCall = {
        id: "tc_1",
        tool: "unknown_tool",
        input: {},
        status: "pending",
      };

      await session.requestPermission(toolCall, []);

      expect(requestHandler.permissionRequests[0].operation).toBe("other");
    });
  });
});
