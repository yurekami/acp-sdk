/**
 * Agent Session
 *
 * Represents an active session from the agent's perspective.
 * Provides methods for communicating with the client, accessing files,
 * executing commands, and managing tool calls.
 *
 * @module @anthropic/acp-sdk/agent/AgentSession
 */

import type {
  SessionId,
  SessionUpdate,
  ToolCall,
  ToolCallId,
  ToolCallStatus,
  ToolCallContent,
  PermissionOption,
  Plan,
  McpServer,
  SessionMode,
  TerminalExitStatus,
  TerminalSignal,
} from "../types/index.js";
import type {
  AgentSessionInterface,
  ToolCallOptions,
  ToolCallBuilderInterface,
  AgentPermissionOutcome,
  AgentTerminalOptions,
  TerminalInterface,
  SessionData,
} from "./types.js";
import { ToolCallBuilder, type ToolCallSender } from "./ToolCallBuilder.js";
import { Terminal, type TerminalRequester } from "./Terminal.js";

/**
 * Interface for making requests to the client.
 * Implemented by ACPAgent.
 */
export interface SessionRequestHandler {
  /** Send a session update notification */
  sendSessionUpdate(sessionId: SessionId, update: SessionUpdate): Promise<void>;

  /** Request permission from the client */
  requestPermission(
    sessionId: SessionId,
    operation: string,
    resource: string,
    toolCallId: ToolCallId,
    options: PermissionOption[],
    reason?: string
  ): Promise<AgentPermissionOutcome>;

  /** Read a file from the client */
  readFile(
    path: string,
    startLine?: number,
    endLine?: number
  ): Promise<string>;

  /** Write a file to the client */
  writeFile(path: string, content: string): Promise<void>;

  /** Create a terminal on the client */
  createTerminal(
    command: string,
    args?: string[],
    cwd?: string,
    env?: Record<string, string>,
    timeout?: number
  ): Promise<string>;

  /** Get terminal output */
  getTerminalOutput(terminalId: string): Promise<{
    output: string;
    truncated: boolean;
    exitStatus?: TerminalExitStatus;
  }>;

  /** Wait for terminal to exit */
  waitForTerminalExit(
    terminalId: string,
    timeout?: number
  ): Promise<TerminalExitStatus>;

  /** Kill a terminal */
  killTerminal(terminalId: string, signal?: TerminalSignal): Promise<boolean>;

  /** Release a terminal */
  releaseTerminal(terminalId: string): Promise<boolean>;

  /** Set session mode */
  setSessionMode(
    sessionId: SessionId,
    mode: SessionMode
  ): Promise<{ previousMode: SessionMode; currentMode: SessionMode }>;
}

/**
 * Agent Session class for managing a session from the agent side.
 *
 * This class provides:
 * - Methods to send updates to the client (messages, thoughts, plans, tool calls)
 * - File system access via the client
 * - Terminal/command execution via the client
 * - Permission request handling
 * - Cancellation tracking
 *
 * @example
 * ```typescript
 * // In a prompt handler
 * async handlePrompt(session: AgentSession, content: ContentBlock[]): Promise<StopReason> {
 *   // Check for cancellation
 *   session.throwIfCancelled();
 *
 *   // Send a message
 *   await session.sendAgentMessage('Processing your request...');
 *
 *   // Read a file
 *   const fileContent = await session.readFile('/src/main.ts');
 *
 *   // Execute a tool call
 *   const builder = session.startToolCall({
 *     tool: 'edit_file',
 *     input: { path: '/src/main.ts', content: '...' },
 *     kind: 'edit',
 *     requiresPermission: true
 *   });
 *
 *   await builder.inProgress().send();
 *   // ... do the work
 *   await builder.complete().addText('Done!').send();
 *
 *   return 'end_turn';
 * }
 * ```
 */
export class AgentSession
  implements AgentSessionInterface, ToolCallSender, TerminalRequester
{
  /** Unique session identifier */
  readonly id: SessionId;

  /** Working directory for this session */
  readonly workingDirectory: string;

  /** MCP servers configured for this session */
  readonly mcpServers: McpServer[];

  private requestHandler: SessionRequestHandler;
  private data: SessionData;
  private toolCallCounter = 0;
  private messageIndex = 0;
  private thoughtIndex = 0;

  /**
   * Create a new AgentSession.
   *
   * @param requestHandler - Handler for making requests to the client
   * @param data - Session data
   */
  constructor(requestHandler: SessionRequestHandler, data: SessionData) {
    this.requestHandler = requestHandler;
    this.data = data;
    this.id = data.id;
    this.workingDirectory = data.workingDirectory;
    this.mcpServers = data.mcpServers;
  }

  /**
   * Get the current operating mode.
   */
  get currentMode(): SessionMode | undefined {
    return this.data.currentMode;
  }

  /**
   * Check if this session has been cancelled.
   */
  get isCancelled(): boolean {
    return this.data.cancelled;
  }

  /**
   * Mark this session as cancelled.
   * Called internally by ACPAgent when receiving a cancel notification.
   */
  markCancelled(): void {
    this.data.cancelled = true;
  }

  /**
   * Throw an error if the session has been cancelled.
   * Use in processing loops to check for early termination.
   *
   * @throws Error if the session is cancelled
   */
  throwIfCancelled(): void {
    if (this.data.cancelled) {
      throw new Error("Session cancelled");
    }
  }

  // ===========================================================================
  // Session Updates
  // ===========================================================================

  /**
   * Send a raw session update to the client.
   *
   * @param update - The session update to send
   */
  async sendUpdate(update: SessionUpdate): Promise<void> {
    await this.requestHandler.sendSessionUpdate(this.id, update);
  }

  /**
   * Send an agent message chunk to the client.
   *
   * @param text - The message text
   * @param index - Optional chunk index (auto-incremented if not provided)
   * @param final - Whether this is the final chunk
   */
  async sendAgentMessage(
    text: string,
    index?: number,
    final?: boolean
  ): Promise<void> {
    const chunkIndex = index ?? this.messageIndex++;

    const data: { content: string; index: number; final?: boolean } = {
      content: text,
      index: chunkIndex,
    };

    if (final !== undefined) {
      data.final = final;
    }

    await this.sendUpdate({
      sessionId: this.id,
      type: "agent_message_chunk",
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send a thought/reasoning chunk to the client.
   *
   * @param text - The thought text
   * @param index - Optional chunk index (auto-incremented if not provided)
   * @param visible - Whether the thought should be visible to the user
   */
  async sendThought(
    text: string,
    index?: number,
    visible?: boolean
  ): Promise<void> {
    const chunkIndex = index ?? this.thoughtIndex++;

    const data: { content: string; index: number; visible?: boolean } = {
      content: text,
      index: chunkIndex,
    };

    if (visible !== undefined) {
      data.visible = visible;
    }

    await this.sendUpdate({
      sessionId: this.id,
      type: "thought_message_chunk",
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send a plan update to the client.
   *
   * @param plan - The plan to send
   */
  async sendPlan(plan: Plan): Promise<void> {
    await this.sendUpdate({
      sessionId: this.id,
      type: "plan",
      data: plan,
      timestamp: new Date().toISOString(),
    });
  }

  // ===========================================================================
  // Tool Calls
  // ===========================================================================

  /**
   * Start a new tool call and return a builder for it.
   *
   * @param options - Tool call configuration
   * @returns A builder for constructing and sending the tool call
   */
  startToolCall(options: ToolCallOptions): ToolCallBuilderInterface {
    const id = `tc_${this.id}_${++this.toolCallCounter}`;
    return new ToolCallBuilder(this, id, options);
  }

  /**
   * Send an initial tool call notification.
   * Called by ToolCallBuilder.
   */
  async sendToolCall(toolCall: ToolCall): Promise<void> {
    await this.sendUpdate({
      sessionId: this.id,
      type: "tool_call",
      data: toolCall,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send a tool call update notification.
   * Called by ToolCallBuilder.
   */
  async sendToolCallUpdate(
    id: ToolCallId,
    status: ToolCallStatus,
    output?: ToolCallContent,
    error?: string,
    duration?: number
  ): Promise<void> {
    const data: {
      id: ToolCallId;
      status: ToolCallStatus;
      output?: ToolCallContent;
      error?: string;
      duration?: number;
    } = { id, status };

    if (output !== undefined) {
      data.output = output;
    }
    if (error !== undefined) {
      data.error = error;
    }
    if (duration !== undefined) {
      data.duration = duration;
    }

    await this.sendUpdate({
      sessionId: this.id,
      type: "tool_call_update",
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // ===========================================================================
  // Permissions
  // ===========================================================================

  /**
   * Request permission from the user for an operation.
   *
   * @param toolCall - The tool call requiring permission
   * @param options - Permission options to present to the user
   * @returns Promise resolving to the permission outcome
   */
  async requestPermission(
    toolCall: ToolCall,
    options: PermissionOption[]
  ): Promise<AgentPermissionOutcome> {
    // Determine operation and resource from tool call
    const operation = this.inferOperation(toolCall);
    const resource = this.inferResource(toolCall);

    return this.requestHandler.requestPermission(
      this.id,
      operation,
      resource,
      toolCall.id,
      options,
      toolCall.reason
    );
  }

  /**
   * Infer the operation type from a tool call.
   */
  private inferOperation(toolCall: ToolCall): string {
    // Map tool names/kinds to operations
    if (toolCall.kind) {
      switch (toolCall.kind) {
        case "read":
          return "file_read";
        case "edit":
          return "file_write";
        case "delete":
          return "file_delete";
        case "execute":
          return "terminal_execute";
        case "fetch":
          return "network_access";
        default:
          return toolCall.kind;
      }
    }

    // Infer from tool name
    const tool = toolCall.tool.toLowerCase();
    if (tool.includes("read")) return "file_read";
    if (tool.includes("write") || tool.includes("edit")) return "file_write";
    if (tool.includes("delete")) return "file_delete";
    if (tool.includes("terminal") || tool.includes("exec")) return "terminal_execute";
    if (tool.includes("fetch") || tool.includes("http")) return "network_access";
    if (tool.includes("mcp")) return "mcp_tool";

    return "other";
  }

  /**
   * Infer the resource from a tool call.
   */
  private inferResource(toolCall: ToolCall): string {
    // Try to get path from input
    const input = toolCall.input;
    if (typeof input["path"] === "string") return input["path"];
    if (typeof input["file"] === "string") return input["file"];
    if (typeof input["url"] === "string") return input["url"];
    if (typeof input["command"] === "string") return input["command"];
    if (toolCall.location?.path) return toolCall.location.path;

    return toolCall.tool;
  }

  // ===========================================================================
  // File System
  // ===========================================================================

  /**
   * Read a file from the client's filesystem.
   *
   * @param path - Absolute path to the file
   * @param startLine - First line to read (1-indexed)
   * @param endLine - Last line to read (1-indexed)
   * @returns Promise resolving to the file content
   */
  async readFile(
    path: string,
    startLine?: number,
    endLine?: number
  ): Promise<string> {
    return this.requestHandler.readFile(path, startLine, endLine);
  }

  /**
   * Write a file to the client's filesystem.
   *
   * @param path - Absolute path to the file
   * @param content - Content to write
   */
  async writeFile(path: string, content: string): Promise<void> {
    await this.requestHandler.writeFile(path, content);
  }

  // ===========================================================================
  // Terminal
  // ===========================================================================

  /**
   * Create a terminal to execute a command.
   *
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Terminal options
   * @returns Promise resolving to a Terminal instance
   */
  async createTerminal(
    command: string,
    args?: string[],
    options?: AgentTerminalOptions
  ): Promise<TerminalInterface> {
    const terminalId = await this.requestHandler.createTerminal(
      command,
      args,
      options?.cwd,
      options?.env,
      options?.timeout
    );

    return new Terminal(this, terminalId);
  }

  /**
   * Request terminal output.
   * Implements TerminalRequester interface.
   */
  async requestTerminalOutput(terminalId: string): Promise<{
    output: string;
    truncated: boolean;
    exitStatus?: TerminalExitStatus;
  }> {
    return this.requestHandler.getTerminalOutput(terminalId);
  }

  /**
   * Request wait for terminal exit.
   * Implements TerminalRequester interface.
   */
  async requestTerminalWaitForExit(
    terminalId: string,
    timeout?: number
  ): Promise<TerminalExitStatus> {
    return this.requestHandler.waitForTerminalExit(terminalId, timeout);
  }

  /**
   * Request terminal kill.
   * Implements TerminalRequester interface.
   */
  async requestTerminalKill(
    terminalId: string,
    signal?: TerminalSignal
  ): Promise<boolean> {
    return this.requestHandler.killTerminal(terminalId, signal);
  }

  /**
   * Request terminal release.
   * Implements TerminalRequester interface.
   */
  async requestTerminalRelease(terminalId: string): Promise<boolean> {
    return this.requestHandler.releaseTerminal(terminalId);
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  /**
   * Set the operating mode for this session.
   *
   * @param modeId - The mode identifier to switch to
   */
  async setMode(modeId: SessionMode): Promise<void> {
    const result = await this.requestHandler.setSessionMode(this.id, modeId);
    this.data.currentMode = result.currentMode;

    // Also send an update notification
    await this.sendUpdate({
      sessionId: this.id,
      type: "current_mode_update",
      data: {
        previousMode: result.previousMode,
        currentMode: result.currentMode,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Get the session data.
   * Used internally by ACPAgent.
   */
  getData(): SessionData {
    return this.data;
  }

  /**
   * Update the session data.
   * Used internally by ACPAgent.
   */
  updateData(updates: Partial<SessionData>): void {
    Object.assign(this.data, updates);
  }
}
