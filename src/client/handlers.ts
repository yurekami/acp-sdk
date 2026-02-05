/**
 * Default Handler Implementations
 *
 * Provides default implementations of file system, terminal, and permission handlers
 * that can be used by clients or overridden with custom implementations.
 *
 * @module @anthropic/acp-sdk/client/handlers
 */

import * as fs from "fs/promises";
import * as path from "path";
import { spawn, type ChildProcess } from "child_process";
import * as readline from "readline";
import type {
  FileSystemHandler,
  TerminalHandler,
  PermissionHandler,
  ReadFileResult,
  WriteFileResult,
  ClientTerminalOptions,
  TerminalOutput,
  CreateTerminalResult,
  ClientPermissionOutcome,
} from "./types.js";
import type { ToolCall, PermissionOption, TerminalExitStatus } from "../types/index.js";

// =============================================================================
// File System Handler
// =============================================================================

/**
 * Create a Node.js file system handler.
 *
 * @param workingDirectory - Base working directory for resolving relative paths
 * @returns FileSystemHandler implementation
 *
 * @example
 * ```typescript
 * const fsHandler = createNodeFileSystemHandler('/home/user/project');
 * client.setFileSystemHandler(fsHandler);
 * ```
 */
export function createNodeFileSystemHandler(
  workingDirectory: string
): FileSystemHandler {
  /**
   * Resolve and validate a path to ensure it's within allowed boundaries.
   */
  const resolvePath = (filePath: string): string => {
    // If absolute, use as-is; otherwise resolve relative to working directory
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(workingDirectory, filePath);
    return resolved;
  };

  return {
    async readTextFile(
      filePath: string,
      startLine?: number,
      endLine?: number
    ): Promise<ReadFileResult> {
      const resolved = resolvePath(filePath);

      const content = await fs.readFile(resolved, "utf-8");
      const lines = content.split("\n");
      const totalLines = lines.length;

      let resultContent = content;
      let truncated = false;

      // Handle line range if specified
      if (startLine !== undefined || endLine !== undefined) {
        const start = (startLine ?? 1) - 1; // Convert to 0-indexed
        const end = endLine ?? lines.length;
        resultContent = lines.slice(start, end).join("\n");
        truncated = start > 0 || end < lines.length;
      }

      return {
        content: resultContent,
        encoding: "utf-8",
        totalLines,
        truncated,
      };
    },

    async writeTextFile(
      filePath: string,
      content: string
    ): Promise<WriteFileResult> {
      const resolved = resolvePath(filePath);

      // Check if file exists
      let created = false;
      try {
        await fs.access(resolved);
      } catch {
        created = true;
        // Ensure parent directory exists
        const dir = path.dirname(resolved);
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(resolved, content, "utf-8");
      const bytesWritten = Buffer.byteLength(content, "utf-8");

      return {
        bytesWritten,
        created,
      };
    },
  };
}

// =============================================================================
// Terminal Handler
// =============================================================================

/**
 * Tracked terminal instance.
 */
interface TrackedTerminal {
  id: string;
  process: ChildProcess;
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitStatus: TerminalExitStatus | null;
  startTime: number;
  exitPromise: Promise<TerminalExitStatus>;
}

/**
 * Create a Node.js terminal handler using child_process.
 *
 * @returns TerminalHandler implementation
 *
 * @example
 * ```typescript
 * const termHandler = createNodeTerminalHandler();
 * client.setTerminalHandler(termHandler);
 * ```
 */
export function createNodeTerminalHandler(): TerminalHandler {
  const terminals = new Map<string, TrackedTerminal>();
  let nextTerminalId = 1;

  return {
    async create(
      command: string,
      args?: string[],
      options?: ClientTerminalOptions
    ): Promise<CreateTerminalResult> {
      const terminalId = `term_${nextTerminalId++}`;
      const processArgs = args ?? [];

      const proc = spawn(command, processArgs, {
        cwd: options?.cwd,
        env: options?.env ? { ...process.env, ...options.env } : process.env,
        shell: true,
      });

      const terminal: TrackedTerminal = {
        id: terminalId,
        process: proc,
        command,
        args: processArgs,
        stdout: "",
        stderr: "",
        exitStatus: null,
        startTime: Date.now(),
        exitPromise: new Promise<TerminalExitStatus>((resolve) => {
          // Handle timeout if specified
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
          if (options?.timeout) {
            timeoutHandle = setTimeout(() => {
              proc.kill("SIGKILL");
            }, options.timeout);
          }

          proc.on("close", (code, signal) => {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }

            const signalStr = signal !== null ? String(signal) : undefined;
            const status: TerminalExitStatus = {
              exitCode: code,
              ...(signalStr !== undefined && { signal: signalStr }),
              signaled: signal !== null,
              timedOut: false,
              duration: Date.now() - terminal.startTime,
            };

            terminal.exitStatus = status;
            resolve(status);
          });

          proc.on("error", (_err) => {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }

            const status: TerminalExitStatus = {
              exitCode: 1,
              timedOut: false,
              duration: Date.now() - terminal.startTime,
            };

            terminal.exitStatus = status;
            resolve(status);
          });
        }),
      };

      // Capture stdout
      proc.stdout?.on("data", (data) => {
        terminal.stdout += data.toString();
      });

      // Capture stderr
      proc.stderr?.on("data", (data) => {
        terminal.stderr += data.toString();
      });

      terminals.set(terminalId, terminal);

      return {
        terminalId,
        pid: proc.pid,
      };
    },

    async output(terminalId: string): Promise<TerminalOutput> {
      const terminal = terminals.get(terminalId);
      if (!terminal) {
        throw new Error(`Terminal not found: ${terminalId}`);
      }

      return {
        stdout: terminal.stdout,
        stderr: terminal.stderr,
        complete: terminal.exitStatus !== null,
      };
    },

    async waitForExit(
      terminalId: string,
      timeout?: number
    ): Promise<TerminalExitStatus> {
      const terminal = terminals.get(terminalId);
      if (!terminal) {
        throw new Error(`Terminal not found: ${terminalId}`);
      }

      // If already exited, return immediately
      if (terminal.exitStatus) {
        return terminal.exitStatus;
      }

      // Wait with optional timeout
      if (timeout) {
        const timeoutPromise = new Promise<TerminalExitStatus>((resolve) => {
          setTimeout(() => {
            resolve({
              exitCode: null,
              timedOut: true,
              duration: Date.now() - terminal.startTime,
            });
          }, timeout);
        });

        return Promise.race([terminal.exitPromise, timeoutPromise]);
      }

      return terminal.exitPromise;
    },

    async kill(terminalId: string, signal?: string): Promise<void> {
      const terminal = terminals.get(terminalId);
      if (!terminal) {
        throw new Error(`Terminal not found: ${terminalId}`);
      }

      const sig = signal ?? "SIGTERM";
      terminal.process.kill(sig as NodeJS.Signals);
    },

    async release(terminalId: string): Promise<void> {
      const terminal = terminals.get(terminalId);
      if (!terminal) {
        return; // Already released
      }

      // Kill if still running
      if (!terminal.exitStatus) {
        terminal.process.kill("SIGKILL");
        await terminal.exitPromise;
      }

      terminals.delete(terminalId);
    },
  };
}

// =============================================================================
// Console Permission Handler
// =============================================================================

/**
 * Create a simple console-based permission handler.
 * Prompts the user via stdin/stdout for permission decisions.
 *
 * @returns PermissionHandler implementation
 *
 * @example
 * ```typescript
 * const permHandler = createConsolePermissionHandler();
 * client.setPermissionHandler(permHandler);
 * ```
 */
export function createConsolePermissionHandler(): PermissionHandler {
  return {
    async requestPermission(
      toolCall: ToolCall,
      options: PermissionOption[]
    ): Promise<ClientPermissionOutcome> {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise<ClientPermissionOutcome>((resolve) => {
        console.log("\n" + "=".repeat(60));
        console.log("PERMISSION REQUEST");
        console.log("=".repeat(60));
        console.log(`Tool: ${toolCall.tool}`);
        console.log(`Input: ${JSON.stringify(toolCall.input, null, 2)}`);
        if (toolCall.reason) {
          console.log(`Reason: ${toolCall.reason}`);
        }

        // Show options if available
        if (options.length > 0) {
          console.log("\nOptions:");
          options.forEach((opt, idx) => {
            const defaultMarker = opt.isDefault ? " (default)" : "";
            console.log(`  ${idx + 1}. ${opt.label}${defaultMarker}`);
            if (opt.description) {
              console.log(`     ${opt.description}`);
            }
          });
        }

        console.log("\nAllow this operation? [y/n/always/never]: ");

        rl.question("", (answer) => {
          rl.close();

          const normalized = answer.trim().toLowerCase();

          switch (normalized) {
            case "y":
            case "yes":
              resolve({ granted: true, remember: false, scope: "once" });
              break;
            case "always":
              resolve({ granted: true, remember: true, scope: "always" });
              break;
            case "never":
              resolve({
                granted: false,
                remember: true,
                reason: "User permanently denied",
              });
              break;
            default:
              resolve({ granted: false, reason: "User denied" });
          }
        });
      });
    },
  };
}

// =============================================================================
// Auto-Approve Handler
// =============================================================================

/**
 * Create a permission handler that auto-approves all requests.
 * WARNING: Only use this for trusted environments or testing.
 *
 * @returns PermissionHandler that grants all permissions
 *
 * @example
 * ```typescript
 * // WARNING: Only for trusted environments!
 * const permHandler = createAutoApproveHandler();
 * client.setPermissionHandler(permHandler);
 * ```
 */
export function createAutoApproveHandler(): PermissionHandler {
  return {
    async requestPermission(): Promise<ClientPermissionOutcome> {
      return { granted: true, remember: false, scope: "once" };
    },
  };
}

// =============================================================================
// Auto-Deny Handler
// =============================================================================

/**
 * Create a permission handler that denies all requests.
 * Useful for read-only or restricted environments.
 *
 * @param reason - Reason to provide for denials
 * @returns PermissionHandler that denies all permissions
 *
 * @example
 * ```typescript
 * const permHandler = createAutoDenyHandler('Read-only mode');
 * client.setPermissionHandler(permHandler);
 * ```
 */
export function createAutoDenyHandler(
  reason = "Permission denied by policy"
): PermissionHandler {
  return {
    async requestPermission(): Promise<ClientPermissionOutcome> {
      return { granted: false, reason };
    },
  };
}
