/**
 * Terminal Wrapper
 *
 * Provides a high-level interface for managing terminals from the agent side.
 * Wraps the low-level JSON-RPC calls to the client's terminal methods.
 *
 * @module @anthropic/acp-sdk/agent/Terminal
 */

import type {
  TerminalId,
  TerminalExitStatus,
  TerminalSignal,
} from "../types/index.js";
import type { TerminalInterface, TerminalOutputResult } from "./types.js";

/**
 * Interface for making terminal-related requests to the client.
 * Implemented by AgentSession.
 */
export interface TerminalRequester {
  /** Get terminal output */
  requestTerminalOutput(terminalId: TerminalId): Promise<{
    output: string;
    truncated: boolean;
    exitStatus?: TerminalExitStatus;
  }>;

  /** Wait for terminal to exit */
  requestTerminalWaitForExit(
    terminalId: TerminalId,
    timeout?: number
  ): Promise<TerminalExitStatus>;

  /** Kill terminal process */
  requestTerminalKill(
    terminalId: TerminalId,
    signal?: TerminalSignal
  ): Promise<boolean>;

  /** Release terminal resources */
  requestTerminalRelease(terminalId: TerminalId): Promise<boolean>;
}

/**
 * Terminal class for managing terminal processes from the agent.
 *
 * Provides methods to read output, wait for completion, and control
 * the terminal process lifecycle.
 *
 * @example
 * ```typescript
 * const terminal = await session.createTerminal('npm', ['test'], {
 *   cwd: '/home/user/project',
 *   timeout: 60000
 * });
 *
 * // Wait for completion
 * const status = await terminal.waitForExit();
 *
 * if (status.exitCode === 0) {
 *   console.log('Tests passed!');
 * } else {
 *   const result = await terminal.output();
 *   console.error('Tests failed:', result.output);
 * }
 *
 * // Always release when done
 * await terminal.release();
 * ```
 */
export class Terminal implements TerminalInterface {
  /** Unique terminal identifier */
  readonly id: TerminalId;

  private requester: TerminalRequester;
  private released = false;

  /**
   * Create a new Terminal wrapper.
   *
   * @param requester - Object that can make terminal requests
   * @param id - The terminal identifier from createTerminal
   */
  constructor(requester: TerminalRequester, id: TerminalId) {
    this.requester = requester;
    this.id = id;
  }

  /**
   * Get the current terminal output.
   *
   * Returns both stdout and stderr combined, along with any
   * available exit status if the process has completed.
   *
   * @returns Promise resolving to the output result
   * @throws Error if the terminal has been released
   */
  async output(): Promise<TerminalOutputResult> {
    this.ensureNotReleased();

    const result = await this.requester.requestTerminalOutput(this.id);

    const outputResult: TerminalOutputResult = {
      output: result.output,
      truncated: result.truncated,
    };

    if (result.exitStatus !== undefined) {
      outputResult.exitStatus = result.exitStatus;
    }

    return outputResult;
  }

  /**
   * Wait for the terminal process to exit.
   *
   * Blocks until the process exits or the timeout is reached.
   *
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise resolving to the exit status
   * @throws Error if the terminal has been released or timeout occurs
   */
  async waitForExit(timeout?: number): Promise<TerminalExitStatus> {
    this.ensureNotReleased();

    return this.requester.requestTerminalWaitForExit(this.id, timeout);
  }

  /**
   * Kill the terminal process.
   *
   * Sends a signal to terminate the process. By default sends SIGTERM.
   *
   * @param signal - Signal to send (default: SIGTERM)
   * @throws Error if the terminal has been released
   */
  async kill(signal?: string): Promise<void> {
    this.ensureNotReleased();

    await this.requester.requestTerminalKill(
      this.id,
      (signal as TerminalSignal) ?? "SIGTERM"
    );
  }

  /**
   * Release terminal resources.
   *
   * Should be called when the terminal is no longer needed.
   * After releasing, the terminal cannot be used.
   */
  async release(): Promise<void> {
    if (this.released) {
      return; // Already released
    }

    await this.requester.requestTerminalRelease(this.id);
    this.released = true;
  }

  /**
   * Check if the terminal has been released.
   */
  get isReleased(): boolean {
    return this.released;
  }

  /**
   * Ensure the terminal has not been released.
   * @throws Error if the terminal has been released
   */
  private ensureNotReleased(): void {
    if (this.released) {
      throw new Error(`Terminal ${this.id} has been released`);
    }
  }
}
