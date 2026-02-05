/**
 * Terminal Tests
 *
 * Comprehensive tests for the Terminal class covering:
 * - Constructor
 * - output() method
 * - waitForExit() method
 * - kill() method
 * - release() method
 * - Released state handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Terminal, type TerminalRequester } from "../../src/agent/Terminal.js";
import type {
  TerminalId,
  TerminalExitStatus,
  TerminalSignal,
} from "../../src/types/index.js";

// Mock TerminalRequester
class MockRequester implements TerminalRequester {
  public outputRequests: string[] = [];
  public waitRequests: Array<{ terminalId: string; timeout?: number }> = [];
  public killRequests: Array<{ terminalId: string; signal?: TerminalSignal }> = [];
  public releaseRequests: string[] = [];

  private mockOutput = "terminal output";
  private mockExitStatus: TerminalExitStatus = { exitCode: 0 };
  private mockTruncated = false;

  async requestTerminalOutput(terminalId: TerminalId): Promise<{
    output: string;
    truncated: boolean;
    exitStatus?: TerminalExitStatus;
  }> {
    this.outputRequests.push(terminalId);
    return {
      output: this.mockOutput,
      truncated: this.mockTruncated,
      exitStatus: this.mockExitStatus,
    };
  }

  async requestTerminalWaitForExit(
    terminalId: TerminalId,
    timeout?: number
  ): Promise<TerminalExitStatus> {
    this.waitRequests.push({ terminalId, timeout });
    return this.mockExitStatus;
  }

  async requestTerminalKill(
    terminalId: TerminalId,
    signal?: TerminalSignal
  ): Promise<boolean> {
    this.killRequests.push({ terminalId, signal });
    return true;
  }

  async requestTerminalRelease(terminalId: TerminalId): Promise<boolean> {
    this.releaseRequests.push(terminalId);
    return true;
  }

  // Test helpers
  setMockOutput(output: string, truncated = false): void {
    this.mockOutput = output;
    this.mockTruncated = truncated;
  }

  setMockExitStatus(exitStatus: TerminalExitStatus): void {
    this.mockExitStatus = exitStatus;
  }
}

describe("Terminal", () => {
  let requester: MockRequester;
  let terminal: Terminal;
  const terminalId = "term_test_123";

  beforeEach(() => {
    requester = new MockRequester();
    terminal = new Terminal(requester, terminalId);
  });

  describe("constructor", () => {
    it("should create terminal with id", () => {
      expect(terminal).toBeDefined();
      expect(terminal.id).toBe(terminalId);
    });

    it("should not be released initially", () => {
      expect(terminal.isReleased).toBe(false);
    });
  });

  describe("output()", () => {
    it("should get terminal output", async () => {
      requester.setMockOutput("Hello, world!");

      const result = await terminal.output();

      expect(result.output).toBe("Hello, world!");
      expect(result.truncated).toBe(false);
      expect(requester.outputRequests).toHaveLength(1);
      expect(requester.outputRequests[0]).toBe(terminalId);
    });

    it("should return truncated output", async () => {
      requester.setMockOutput("Very long output...", true);

      const result = await terminal.output();

      expect(result.output).toBe("Very long output...");
      expect(result.truncated).toBe(true);
    });

    it("should include exit status when available", async () => {
      requester.setMockExitStatus({ exitCode: 0 });

      const result = await terminal.output();

      expect(result.exitStatus).toBeDefined();
      expect(result.exitStatus?.exitCode).toBe(0);
    });

    it("should handle output with signal termination", async () => {
      requester.setMockExitStatus({
        exitCode: null,
        signal: "SIGTERM",
      });

      const result = await terminal.output();

      expect(result.exitStatus?.exitCode).toBe(null);
      expect(result.exitStatus?.signal).toBe("SIGTERM");
    });

    it("should throw if terminal is released", async () => {
      await terminal.release();

      await expect(terminal.output()).rejects.toThrow(
        `Terminal ${terminalId} has been released`
      );
    });

    it("should allow multiple output requests", async () => {
      await terminal.output();
      await terminal.output();
      await terminal.output();

      expect(requester.outputRequests).toHaveLength(3);
    });
  });

  describe("waitForExit()", () => {
    it("should wait for terminal exit", async () => {
      requester.setMockExitStatus({ exitCode: 0 });

      const exitStatus = await terminal.waitForExit();

      expect(exitStatus.exitCode).toBe(0);
      expect(requester.waitRequests).toHaveLength(1);
      expect(requester.waitRequests[0].terminalId).toBe(terminalId);
    });

    it("should wait with timeout", async () => {
      requester.setMockExitStatus({ exitCode: 0 });

      await terminal.waitForExit(5000);

      expect(requester.waitRequests[0].timeout).toBe(5000);
    });

    it("should return non-zero exit code", async () => {
      requester.setMockExitStatus({ exitCode: 1 });

      const exitStatus = await terminal.waitForExit();

      expect(exitStatus.exitCode).toBe(1);
    });

    it("should return signal termination", async () => {
      requester.setMockExitStatus({
        exitCode: null,
        signal: "SIGKILL",
      });

      const exitStatus = await terminal.waitForExit();

      expect(exitStatus.exitCode).toBe(null);
      expect(exitStatus.signal).toBe("SIGKILL");
    });

    it("should handle timeout", async () => {
      requester.setMockExitStatus({
        exitCode: null,
        timedOut: true,
      });

      const exitStatus = await terminal.waitForExit(1000);

      expect(exitStatus.timedOut).toBe(true);
    });

    it("should throw if terminal is released", async () => {
      await terminal.release();

      await expect(terminal.waitForExit()).rejects.toThrow(
        `Terminal ${terminalId} has been released`
      );
    });
  });

  describe("kill()", () => {
    it("should kill terminal with default signal", async () => {
      await terminal.kill();

      expect(requester.killRequests).toHaveLength(1);
      expect(requester.killRequests[0].terminalId).toBe(terminalId);
      expect(requester.killRequests[0].signal).toBe("SIGTERM");
    });

    it("should kill terminal with custom signal", async () => {
      await terminal.kill("SIGKILL");

      expect(requester.killRequests[0].signal).toBe("SIGKILL");
    });

    it("should handle SIGINT signal", async () => {
      await terminal.kill("SIGINT");

      expect(requester.killRequests[0].signal).toBe("SIGINT");
    });

    it("should handle SIGHUP signal", async () => {
      await terminal.kill("SIGHUP");

      expect(requester.killRequests[0].signal).toBe("SIGHUP");
    });

    it("should throw if terminal is released", async () => {
      await terminal.release();

      await expect(terminal.kill()).rejects.toThrow(
        `Terminal ${terminalId} has been released`
      );
    });

    it("should allow multiple kill attempts", async () => {
      await terminal.kill();
      await terminal.kill();

      expect(requester.killRequests).toHaveLength(2);
    });
  });

  describe("release()", () => {
    it("should release terminal", async () => {
      await terminal.release();

      expect(requester.releaseRequests).toHaveLength(1);
      expect(requester.releaseRequests[0]).toBe(terminalId);
      expect(terminal.isReleased).toBe(true);
    });

    it("should not double-release", async () => {
      await terminal.release();
      await terminal.release();

      expect(requester.releaseRequests).toHaveLength(1);
    });

    it("should prevent operations after release", async () => {
      await terminal.release();

      await expect(terminal.output()).rejects.toThrow();
      await expect(terminal.waitForExit()).rejects.toThrow();
      await expect(terminal.kill()).rejects.toThrow();
    });
  });

  describe("isReleased property", () => {
    it("should return false initially", () => {
      expect(terminal.isReleased).toBe(false);
    });

    it("should return true after release", async () => {
      await terminal.release();

      expect(terminal.isReleased).toBe(true);
    });

    it("should remain true after multiple release calls", async () => {
      await terminal.release();
      await terminal.release();

      expect(terminal.isReleased).toBe(true);
    });
  });

  describe("workflow scenarios", () => {
    it("should handle successful command execution", async () => {
      // Get output while running
      requester.setMockOutput("Running tests...");
      let result = await terminal.output();
      expect(result.output).toBe("Running tests...");

      // Wait for exit
      requester.setMockExitStatus({ exitCode: 0 });
      const exitStatus = await terminal.waitForExit();
      expect(exitStatus.exitCode).toBe(0);

      // Get final output
      requester.setMockOutput("All tests passed!");
      result = await terminal.output();
      expect(result.output).toBe("All tests passed!");

      // Release
      await terminal.release();
      expect(terminal.isReleased).toBe(true);
    });

    it("should handle failed command execution", async () => {
      // Get output
      requester.setMockOutput("Error occurred");
      const result = await terminal.output();
      expect(result.output).toBe("Error occurred");

      // Wait for exit with error code
      requester.setMockExitStatus({ exitCode: 1 });
      const exitStatus = await terminal.waitForExit();
      expect(exitStatus.exitCode).toBe(1);

      // Release
      await terminal.release();
    });

    it("should handle command timeout and kill", async () => {
      // Start waiting with timeout
      requester.setMockExitStatus({
        exitCode: null,
        timedOut: true,
      });

      const exitStatus = await terminal.waitForExit(1000);
      expect(exitStatus.timedOut).toBe(true);

      // Kill the process
      await terminal.kill("SIGKILL");
      expect(requester.killRequests[0].signal).toBe("SIGKILL");

      // Release
      await terminal.release();
    });

    it("should handle interrupted command", async () => {
      // Get initial output
      await terminal.output();

      // Kill with SIGINT
      await terminal.kill("SIGINT");

      // Wait for exit with signal
      requester.setMockExitStatus({
        exitCode: null,
        signal: "SIGINT",
      });
      const exitStatus = await terminal.waitForExit();
      expect(exitStatus.signal).toBe("SIGINT");

      // Release
      await terminal.release();
    });

    it("should handle immediate release without waiting", async () => {
      // Just release without any operations
      await terminal.release();

      expect(terminal.isReleased).toBe(true);
      expect(requester.releaseRequests).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty output", async () => {
      requester.setMockOutput("");

      const result = await terminal.output();

      expect(result.output).toBe("");
      expect(result.truncated).toBe(false);
    });

    it("should handle very long output", async () => {
      const longOutput = "x".repeat(100000);
      requester.setMockOutput(longOutput, true);

      const result = await terminal.output();

      expect(result.output).toBe(longOutput);
      expect(result.truncated).toBe(true);
    });

    it("should handle null exit code", async () => {
      requester.setMockExitStatus({
        exitCode: null,
      });

      const exitStatus = await terminal.waitForExit();

      expect(exitStatus.exitCode).toBe(null);
    });

    it("should handle exit with both code and signal", async () => {
      // This can happen in some scenarios
      requester.setMockExitStatus({
        exitCode: 143,
        signal: "SIGTERM",
      });

      const exitStatus = await terminal.waitForExit();

      expect(exitStatus.exitCode).toBe(143);
      expect(exitStatus.signal).toBe("SIGTERM");
    });

    it("should handle rapid sequential operations", async () => {
      // Multiple rapid output requests
      await terminal.output();
      await terminal.output();
      await terminal.output();

      expect(requester.outputRequests).toHaveLength(3);

      // Kill and release
      await terminal.kill();
      await terminal.release();

      expect(terminal.isReleased).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should throw meaningful error when accessing released terminal", async () => {
      await terminal.release();

      const error = await terminal.output().catch((e) => e);

      expect(error.message).toContain(terminalId);
      expect(error.message).toContain("released");
    });

    it("should maintain released state even after errors", async () => {
      await terminal.release();

      await terminal.output().catch(() => {});
      await terminal.waitForExit().catch(() => {});
      await terminal.kill().catch(() => {});

      expect(terminal.isReleased).toBe(true);
    });
  });

  describe("id property", () => {
    it("should have readonly id", () => {
      expect(terminal.id).toBe(terminalId);
    });

    it("should maintain id after operations", async () => {
      await terminal.output();
      expect(terminal.id).toBe(terminalId);

      await terminal.kill();
      expect(terminal.id).toBe(terminalId);

      await terminal.release();
      expect(terminal.id).toBe(terminalId);
    });
  });

  describe("multiple terminal instances", () => {
    it("should handle multiple terminals independently", async () => {
      const terminal1 = new Terminal(requester, "term_1");
      const terminal2 = new Terminal(requester, "term_2");

      await terminal1.output();
      await terminal2.output();

      expect(requester.outputRequests).toHaveLength(2);
      expect(requester.outputRequests[0]).toBe("term_1");
      expect(requester.outputRequests[1]).toBe("term_2");

      await terminal1.release();
      expect(terminal1.isReleased).toBe(true);
      expect(terminal2.isReleased).toBe(false);

      // terminal2 should still work
      await terminal2.output();
      expect(requester.outputRequests).toHaveLength(3);
    });
  });
});
