/**
 * Tool Call Builder
 *
 * Provides a fluent API for building and sending tool call updates.
 * Used by agents to report tool execution progress and results.
 *
 * @module @anthropic/acp-sdk/agent/ToolCallBuilder
 */

import type {
  ToolCall,
  ToolCallId,
  ToolCallStatus,
  ToolCallContent,
  ToolCallLocation,
  ToolKind,
  DiffHunk,
} from "../types/index.js";
import type {
  ToolCallBuilderInterface,
  ToolCallOptions,
  DiffHunkData,
} from "./types.js";

/**
 * Interface for sending tool call updates.
 * Implemented by AgentSession.
 */
export interface ToolCallSender {
  sendToolCall(toolCall: ToolCall): Promise<void>;
  sendToolCallUpdate(
    id: ToolCallId,
    status: ToolCallStatus,
    output?: ToolCallContent,
    error?: string,
    duration?: number
  ): Promise<void>;
}

/**
 * Builder for constructing and sending tool call updates.
 *
 * @example
 * ```typescript
 * const builder = session.startToolCall({
 *   tool: 'fs/write_text_file',
 *   input: { path: '/src/file.ts', content: '...' },
 *   kind: 'edit',
 *   requiresPermission: true
 * });
 *
 * // Request permission first
 * await builder.awaitingPermission().send();
 *
 * // After permission granted, execute
 * await builder.inProgress().send();
 *
 * // Report completion
 * await builder.complete()
 *   .addText('File written successfully')
 *   .setDuration(45)
 *   .send();
 * ```
 */
export class ToolCallBuilder implements ToolCallBuilderInterface {
  /** The tool call ID */
  readonly id: ToolCallId;

  private sender: ToolCallSender;
  private tool: string;
  private input: Record<string, unknown>;
  private kind?: ToolKind;
  private requiresPermission?: boolean;
  private reason?: string;
  private location?: ToolCallLocation;
  private status: ToolCallStatus = "pending";
  private output?: ToolCallContent;
  private error?: string;
  private duration?: number;
  private hasSentInitial = false;

  /**
   * Create a new ToolCallBuilder.
   *
   * @param sender - Object that can send tool call updates
   * @param id - Unique identifier for this tool call
   * @param options - Tool call configuration options
   */
  constructor(sender: ToolCallSender, id: ToolCallId, options: ToolCallOptions) {
    this.sender = sender;
    this.id = id;
    this.tool = options.tool;
    this.input = options.input;

    if (options.kind !== undefined) {
      this.kind = options.kind;
    }
    if (options.requiresPermission !== undefined) {
      this.requiresPermission = options.requiresPermission;
    }
    if (options.reason !== undefined) {
      this.reason = options.reason;
    }
    if (options.location !== undefined) {
      this.location = options.location;
    }
  }

  /**
   * Set status to pending.
   * Initial state for a tool call.
   */
  pending(): this {
    this.status = "pending";
    return this;
  }

  /**
   * Set status to awaiting permission.
   * Use when waiting for user approval.
   */
  awaitingPermission(): this {
    this.status = "awaiting_permission";
    return this;
  }

  /**
   * Set status to in progress.
   * Use when actively executing the tool.
   */
  inProgress(): this {
    this.status = "in_progress";
    return this;
  }

  /**
   * Set status to completed.
   * Use when the tool executed successfully.
   */
  complete(): this {
    this.status = "completed";
    return this;
  }

  /**
   * Set status to failed with an optional error message.
   *
   * @param error - Error message describing the failure
   */
  failed(error?: string): this {
    this.status = "failed";
    if (error !== undefined) {
      this.error = error;
    }
    return this;
  }

  /**
   * Set status to cancelled.
   * Use when the operation was cancelled by the user.
   */
  cancelled(): this {
    this.status = "cancelled";
    return this;
  }

  /**
   * Set status to denied.
   * Use when permission was denied by the user.
   */
  denied(): this {
    this.status = "denied";
    return this;
  }

  /**
   * Add output content to the tool call.
   *
   * @param content - The tool call content to add
   */
  addContent(content: ToolCallContent): this {
    this.output = content;
    return this;
  }

  /**
   * Add text output to the tool call.
   *
   * @param text - The text content
   */
  addText(text: string): this {
    this.output = { type: "text", text };
    return this;
  }

  /**
   * Add diff output to the tool call.
   *
   * @param path - Path to the modified file
   * @param hunks - Array of diff hunks
   */
  addDiff(path: string, hunks: DiffHunkData[]): this {
    const diffHunks: DiffHunk[] = hunks.map((h) => ({
      oldStart: h.oldStart,
      oldLines: h.oldLines,
      newStart: h.newStart,
      newLines: h.newLines,
      content: h.content,
    }));
    this.output = { type: "diff", path, hunks: diffHunks };
    return this;
  }

  /**
   * Add terminal output reference to the tool call.
   *
   * @param terminalId - The terminal identifier
   * @param command - The command that was executed
   * @param exitCode - Optional exit code
   * @param stdout - Optional standard output
   * @param stderr - Optional standard error
   */
  addTerminal(
    terminalId: string,
    command: string,
    exitCode?: number,
    stdout?: string,
    stderr?: string
  ): this {
    const terminalContent: {
      type: "terminal";
      terminalId: string;
      command: string;
      exitCode?: number;
      stdout?: string;
      stderr?: string;
    } = {
      type: "terminal",
      terminalId,
      command,
    };

    if (exitCode !== undefined) {
      terminalContent.exitCode = exitCode;
    }
    if (stdout !== undefined) {
      terminalContent.stdout = stdout;
    }
    if (stderr !== undefined) {
      terminalContent.stderr = stderr;
    }

    this.output = terminalContent;
    return this;
  }

  /**
   * Set the code location for this tool call.
   *
   * @param path - Absolute file path
   * @param line - Starting line number (1-indexed)
   * @param column - Starting column number (1-indexed)
   * @param endLine - Ending line number (1-indexed)
   * @param endColumn - Ending column number (1-indexed)
   */
  setLocation(
    path: string,
    line?: number,
    column?: number,
    endLine?: number,
    endColumn?: number
  ): this {
    this.location = { path };
    if (line !== undefined) this.location.line = line;
    if (column !== undefined) this.location.column = column;
    if (endLine !== undefined) this.location.endLine = endLine;
    if (endColumn !== undefined) this.location.endColumn = endColumn;
    return this;
  }

  /**
   * Set the duration of the tool call in milliseconds.
   *
   * @param ms - Duration in milliseconds
   */
  setDuration(ms: number): this {
    this.duration = ms;
    return this;
  }

  /**
   * Set the error message for a failed tool call.
   *
   * @param error - Error message
   */
  setError(error: string): this {
    this.error = error;
    return this;
  }

  /**
   * Send the tool call update to the client.
   *
   * On the first call, sends the full ToolCall.
   * On subsequent calls, sends a ToolCallUpdate.
   *
   * @returns Promise resolving to the current ToolCall state
   */
  async send(): Promise<ToolCall> {
    const toolCall: ToolCall = {
      id: this.id,
      tool: this.tool,
      input: this.input,
      status: this.status,
    };

    if (this.kind !== undefined) {
      toolCall.kind = this.kind;
    }
    if (this.requiresPermission !== undefined) {
      toolCall.requiresPermission = this.requiresPermission;
    }
    if (this.location !== undefined) {
      toolCall.location = this.location;
    }
    if (this.reason !== undefined) {
      toolCall.reason = this.reason;
    }

    if (!this.hasSentInitial) {
      // Send the initial tool call
      await this.sender.sendToolCall(toolCall);
      this.hasSentInitial = true;
    } else {
      // Send an update
      await this.sender.sendToolCallUpdate(
        this.id,
        this.status,
        this.output,
        this.error,
        this.duration
      );
    }

    return toolCall;
  }
}
