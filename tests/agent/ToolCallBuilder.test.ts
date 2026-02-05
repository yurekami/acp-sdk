/**
 * ToolCallBuilder Tests
 *
 * Comprehensive tests for the ToolCallBuilder class covering:
 * - Fluent API for status changes
 * - Content addition (text, diff, terminal)
 * - Location setting
 * - Duration and error handling
 * - Send behavior (initial vs updates)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolCallBuilder, type ToolCallSender } from "../../src/agent/ToolCallBuilder.js";
import type {
  ToolCall,
  ToolCallId,
  ToolCallStatus,
  ToolCallContent,
} from "../../src/types/index.js";

// Mock ToolCallSender
class MockSender implements ToolCallSender {
  public sentToolCalls: ToolCall[] = [];
  public sentUpdates: Array<{
    id: ToolCallId;
    status: ToolCallStatus;
    output?: ToolCallContent;
    error?: string;
    duration?: number;
  }> = [];

  async sendToolCall(toolCall: ToolCall): Promise<void> {
    this.sentToolCalls.push(toolCall);
  }

  async sendToolCallUpdate(
    id: ToolCallId,
    status: ToolCallStatus,
    output?: ToolCallContent,
    error?: string,
    duration?: number
  ): Promise<void> {
    this.sentUpdates.push({ id, status, output, error, duration });
  }
}

describe("ToolCallBuilder", () => {
  let sender: MockSender;

  beforeEach(() => {
    sender = new MockSender();
  });

  describe("constructor", () => {
    it("should create builder with minimal options", () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "read_file",
        input: { path: "/test.txt" },
      });

      expect(builder).toBeDefined();
      expect(builder.id).toBe("tc_1");
    });

    it("should create builder with full options", () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "edit_file",
        input: { path: "/test.txt", content: "new" },
        kind: "edit",
        requiresPermission: true,
        reason: "Update config",
        location: { path: "/test.txt", line: 10 },
      });

      expect(builder).toBeDefined();
    });
  });

  describe("status methods", () => {
    let builder: ToolCallBuilder;

    beforeEach(() => {
      builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });
    });

    it("should set status to pending", async () => {
      builder.pending();
      const result = await builder.send();

      expect(result.status).toBe("pending");
    });

    it("should set status to awaiting_permission", async () => {
      builder.awaitingPermission();
      const result = await builder.send();

      expect(result.status).toBe("awaiting_permission");
    });

    it("should set status to in_progress", async () => {
      builder.inProgress();
      const result = await builder.send();

      expect(result.status).toBe("in_progress");
    });

    it("should set status to completed", async () => {
      builder.complete();
      const result = await builder.send();

      expect(result.status).toBe("completed");
    });

    it("should set status to failed", async () => {
      builder.failed();
      const result = await builder.send();

      expect(result.status).toBe("failed");
    });

    it("should set status to failed with error", async () => {
      builder.failed("Something went wrong");
      await builder.send();

      expect(sender.sentToolCalls[0].status).toBe("failed");
    });

    it("should set status to cancelled", async () => {
      builder.cancelled();
      const result = await builder.send();

      expect(result.status).toBe("cancelled");
    });

    it("should set status to denied", async () => {
      builder.denied();
      const result = await builder.send();

      expect(result.status).toBe("denied");
    });
  });

  describe("fluent API chaining", () => {
    it("should allow chaining status and content methods", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder
        .inProgress()
        .addText("Processing...")
        .setDuration(100)
        .send();

      expect(sender.sentToolCalls).toHaveLength(1);
      expect(sender.sentToolCalls[0].status).toBe("in_progress");
    });

    it("should return this for all fluent methods", () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      const result1 = builder.pending();
      const result2 = builder.addText("test");
      const result3 = builder.setDuration(50);

      expect(result1).toBe(builder);
      expect(result2).toBe(builder);
      expect(result3).toBe(builder);
    });
  });

  describe("addContent()", () => {
    it("should add text content", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      const content: ToolCallContent = {
        type: "text",
        text: "Hello",
      };

      await builder.addContent(content).send();

      // Content is only sent on updates, not initial send
      await builder.complete().send();

      expect(sender.sentUpdates[0].output).toEqual(content);
    });
  });

  describe("addText()", () => {
    it("should add text output", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder.send(); // Initial send
      await builder.complete().addText("Done!").send();

      expect(sender.sentUpdates).toHaveLength(1);
      expect(sender.sentUpdates[0].output).toEqual({
        type: "text",
        text: "Done!",
      });
    });
  });

  describe("addDiff()", () => {
    it("should add diff output", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "edit_file",
        input: {},
      });

      await builder.send(); // Initial send

      await builder
        .complete()
        .addDiff("/test.txt", [
          {
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 3,
            content: "@@ -1,2 +1,3 @@\n-old\n+new\n+added",
          },
        ])
        .send();

      expect(sender.sentUpdates).toHaveLength(1);
      expect(sender.sentUpdates[0].output).toEqual({
        type: "diff",
        path: "/test.txt",
        hunks: [
          {
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 3,
            content: "@@ -1,2 +1,3 @@\n-old\n+new\n+added",
          },
        ],
      });
    });

    it("should handle multiple diff hunks", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "edit_file",
        input: {},
      });

      await builder.send();

      await builder
        .complete()
        .addDiff("/test.txt", [
          {
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 2,
            content: "@@ -1,1 +1,2 @@\n old\n+new",
          },
          {
            oldStart: 10,
            oldLines: 2,
            newStart: 11,
            newLines: 1,
            content: "@@ -10,2 +11,1 @@\n-removed\n old",
          },
        ])
        .send();

      const output = sender.sentUpdates[0].output as any;
      expect(output.hunks).toHaveLength(2);
    });
  });

  describe("addTerminal()", () => {
    it("should add terminal output with minimal data", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "run_command",
        input: {},
      });

      await builder.send();

      await builder
        .complete()
        .addTerminal("term_1", "npm test")
        .send();

      expect(sender.sentUpdates[0].output).toEqual({
        type: "terminal",
        terminalId: "term_1",
        command: "npm test",
      });
    });

    it("should add terminal output with all data", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "run_command",
        input: {},
      });

      await builder.send();

      await builder
        .complete()
        .addTerminal(
          "term_1",
          "npm test",
          0,
          "All tests passed",
          ""
        )
        .send();

      expect(sender.sentUpdates[0].output).toEqual({
        type: "terminal",
        terminalId: "term_1",
        command: "npm test",
        exitCode: 0,
        stdout: "All tests passed",
        stderr: "",
      });
    });

    it("should handle non-zero exit codes", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "run_command",
        input: {},
      });

      await builder.send();

      await builder
        .complete()
        .addTerminal(
          "term_1",
          "npm test",
          1,
          "",
          "Test failed"
        )
        .send();

      const output = sender.sentUpdates[0].output as any;
      expect(output.exitCode).toBe(1);
      expect(output.stderr).toBe("Test failed");
    });
  });

  describe("setLocation()", () => {
    it("should set location with only path", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder.setLocation("/test.txt").send();

      expect(sender.sentToolCalls[0].location).toEqual({
        path: "/test.txt",
      });
    });

    it("should set location with line and column", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder.setLocation("/test.txt", 10, 5).send();

      expect(sender.sentToolCalls[0].location).toEqual({
        path: "/test.txt",
        line: 10,
        column: 5,
      });
    });

    it("should set location with full range", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder.setLocation("/test.txt", 10, 5, 15, 20).send();

      expect(sender.sentToolCalls[0].location).toEqual({
        path: "/test.txt",
        line: 10,
        column: 5,
        endLine: 15,
        endColumn: 20,
      });
    });
  });

  describe("setDuration()", () => {
    it("should set duration", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder.send();
      await builder.complete().setDuration(1500).send();

      expect(sender.sentUpdates[0].duration).toBe(1500);
    });
  });

  describe("setError()", () => {
    it("should set error message", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder.send();
      await builder.failed().setError("File not found").send();

      expect(sender.sentUpdates[0].error).toBe("File not found");
    });
  });

  describe("send()", () => {
    it("should send initial tool call on first send", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "read_file",
        input: { path: "/test.txt" },
      });

      await builder.pending().send();

      expect(sender.sentToolCalls).toHaveLength(1);
      expect(sender.sentUpdates).toHaveLength(0);
      expect(sender.sentToolCalls[0].id).toBe("tc_1");
      expect(sender.sentToolCalls[0].tool).toBe("read_file");
      expect(sender.sentToolCalls[0].status).toBe("pending");
    });

    it("should send updates on subsequent sends", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      await builder.pending().send();
      await builder.inProgress().send();
      await builder.complete().send();

      expect(sender.sentToolCalls).toHaveLength(1);
      expect(sender.sentUpdates).toHaveLength(2);
      expect(sender.sentUpdates[0].status).toBe("in_progress");
      expect(sender.sentUpdates[1].status).toBe("completed");
    });

    it("should return tool call state", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: { key: "value" },
        kind: "read",
      });

      const result = await builder.send();

      expect(result.id).toBe("tc_1");
      expect(result.tool).toBe("test_tool");
      expect(result.input).toEqual({ key: "value" });
      expect(result.kind).toBe("read");
    });

    it("should include all optional fields in initial send", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "edit_file",
        input: { path: "/test.txt" },
        kind: "edit",
        requiresPermission: true,
        reason: "Update config",
        location: { path: "/test.txt", line: 5 },
      });

      const result = await builder.send();

      expect(result.kind).toBe("edit");
      expect(result.requiresPermission).toBe(true);
      expect(result.reason).toBe("Update config");
      expect(result.location).toEqual({ path: "/test.txt", line: 5 });
    });
  });

  describe("complex workflows", () => {
    it("should handle typical tool call lifecycle", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "edit_file",
        input: { path: "/config.json" },
        kind: "edit",
        requiresPermission: true,
      });

      // Request permission
      await builder.awaitingPermission().send();
      expect(sender.sentToolCalls).toHaveLength(1);
      expect(sender.sentToolCalls[0].status).toBe("awaiting_permission");

      // Permission granted, start execution
      await builder.inProgress().send();
      expect(sender.sentUpdates).toHaveLength(1);
      expect(sender.sentUpdates[0].status).toBe("in_progress");

      // Complete with output
      await builder
        .complete()
        .addText("File updated successfully")
        .setDuration(250)
        .send();

      expect(sender.sentUpdates).toHaveLength(2);
      expect(sender.sentUpdates[1].status).toBe("completed");
      expect(sender.sentUpdates[1].output).toEqual({
        type: "text",
        text: "File updated successfully",
      });
      expect(sender.sentUpdates[1].duration).toBe(250);
    });

    it("should handle failure workflow", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "read_file",
        input: { path: "/missing.txt" },
      });

      await builder.pending().send();
      await builder.inProgress().send();
      await builder
        .failed("File not found: /missing.txt")
        .setDuration(50)
        .send();

      expect(sender.sentUpdates[1].status).toBe("failed");
      expect(sender.sentUpdates[1].error).toBe("File not found: /missing.txt");
    });

    it("should handle permission denial workflow", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "delete_file",
        input: { path: "/important.txt" },
        requiresPermission: true,
      });

      await builder.awaitingPermission().send();
      await builder.denied().send();

      expect(sender.sentUpdates[0].status).toBe("denied");
    });

    it("should handle cancellation workflow", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "long_running_task",
        input: {},
      });

      await builder.pending().send();
      await builder.inProgress().send();
      await builder.cancelled().send();

      expect(sender.sentUpdates[1].status).toBe("cancelled");
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      const result = await builder.send();
      expect(result.input).toEqual({});
    });

    it("should handle complex input objects", async () => {
      const complexInput = {
        path: "/test.txt",
        options: {
          encoding: "utf-8",
          flags: ["read", "write"],
        },
        metadata: {
          author: "test",
          timestamp: 123456789,
        },
      };

      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: complexInput,
      });

      const result = await builder.send();
      expect(result.input).toEqual(complexInput);
    });

    it("should allow changing status multiple times before sending", async () => {
      const builder = new ToolCallBuilder(sender, "tc_1", {
        tool: "test_tool",
        input: {},
      });

      builder.pending();
      builder.inProgress();
      builder.complete();

      const result = await builder.send();
      expect(result.status).toBe("completed");
    });
  });
});
