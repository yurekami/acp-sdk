/**
 * Agent-specific Types
 *
 * Types used by the ACPAgent implementation for handling prompts,
 * managing sessions, and communicating with clients.
 *
 * @module @anthropic/acp-sdk/agent/types
 */

import type {
  SessionUpdate,
  ContentBlock,
  ToolCall,
  ToolCallId,
  ToolKind,
  ToolCallLocation,
  ToolCallContent,
  PermissionOption,
  RequestPermissionOutcome,
  Plan,
  McpServer,
  McpCapabilities,
  AgentPromptCapabilities,
  AgentSessionCapabilities,
  StopReason,
  SessionMode,
  TerminalExitStatus,
} from "../types/index.js";

// =============================================================================
// Agent Options
// =============================================================================

/**
 * Configuration options for creating an ACPAgent.
 */
export interface ACPAgentOptions {
  /** Agent name for identification */
  name: string;
  /** Agent version */
  version: string;
  /** Supported capabilities */
  capabilities?: {
    /** Can load saved sessions */
    loadSession?: boolean;
    /** MCP-related capabilities */
    mcp?: McpCapabilities;
    /** Prompt-related capabilities */
    prompt?: AgentPromptCapabilities;
    /** Session-related capabilities */
    session?: AgentSessionCapabilities;
  };
}

// =============================================================================
// Agent Events
// =============================================================================

/**
 * Events emitted by ACPAgent.
 */
export interface ACPAgentEvents {
  /** New session created */
  sessionCreated: (session: AgentSessionInterface) => void;
  /** Session loaded from persistence */
  sessionLoaded: (session: AgentSessionInterface) => void;
  /** Prompt received for processing */
  prompt: (session: AgentSessionInterface, content: ContentBlock[]) => void;
  /** Session was cancelled by client */
  cancelled: (session: AgentSessionInterface) => void;
  /** Error occurred during agent operation */
  error: (error: Error) => void;
  /** Agent started successfully */
  started: () => void;
  /** Agent stopped */
  stopped: () => void;
}

// =============================================================================
// Prompt Handler
// =============================================================================

/**
 * Handler for processing incoming prompts.
 * Implement this interface to handle user messages.
 */
export interface PromptHandler {
  /**
   * Handle an incoming prompt from a client.
   *
   * This method should process the prompt and send updates via the session.
   * Return when processing is complete with the appropriate stop reason.
   *
   * @param session - The agent session context
   * @param content - The user's message content
   * @returns Promise resolving to the stop reason
   */
  handlePrompt(
    session: AgentSessionInterface,
    content: ContentBlock[]
  ): Promise<StopReason>;
}

// =============================================================================
// Agent Session Interface
// =============================================================================

/**
 * Interface for agent sessions - used by event handlers.
 */
export interface AgentSessionInterface {
  /** Unique session identifier */
  readonly id: string;
  /** Working directory for this session */
  readonly workingDirectory: string;
  /** MCP servers configured for this session */
  readonly mcpServers: McpServer[];
  /** Current operating mode */
  readonly currentMode: SessionMode | undefined;
  /** Whether this session has been cancelled */
  readonly isCancelled: boolean;

  /** Send a session update to the client */
  sendUpdate(update: SessionUpdate): Promise<void>;

  /** Send an agent message chunk */
  sendAgentMessage(text: string, index?: number, final?: boolean): Promise<void>;

  /** Send a thought/reasoning chunk */
  sendThought(text: string, index?: number, visible?: boolean): Promise<void>;

  /** Send a plan update */
  sendPlan(plan: Plan): Promise<void>;

  /** Start a new tool call and return a builder */
  startToolCall(options: ToolCallOptions): ToolCallBuilderInterface;

  /** Request permission from the user */
  requestPermission(
    toolCall: ToolCall,
    options: PermissionOption[]
  ): Promise<AgentPermissionOutcome>;

  /** Read a file from the client's filesystem */
  readFile(path: string, startLine?: number, endLine?: number): Promise<string>;

  /** Write a file to the client's filesystem */
  writeFile(path: string, content: string): Promise<void>;

  /** Create a terminal to execute a command */
  createTerminal(
    command: string,
    args?: string[],
    options?: AgentTerminalOptions
  ): Promise<TerminalInterface>;

  /** Set the operating mode */
  setMode(modeId: SessionMode): Promise<void>;

  /** Throw an error if the session has been cancelled */
  throwIfCancelled(): void;
}

// =============================================================================
// Tool Call Options
// =============================================================================

/**
 * Options for creating a new tool call.
 */
export interface ToolCallOptions {
  /** Tool/method name being invoked */
  tool: string;
  /** Input parameters for the tool */
  input: Record<string, unknown>;
  /** Category of the tool operation */
  kind?: ToolKind;
  /** Whether this tool call requires user permission */
  requiresPermission?: boolean;
  /** Human-readable reason for the tool call */
  reason?: string;
  /** Location in code relevant to this tool call */
  location?: ToolCallLocation;
}

// =============================================================================
// Tool Call Builder Interface
// =============================================================================

/**
 * Fluent interface for building tool call updates.
 */
export interface ToolCallBuilderInterface {
  /** The tool call ID */
  readonly id: ToolCallId;

  /** Set status to pending */
  pending(): this;

  /** Set status to awaiting permission */
  awaitingPermission(): this;

  /** Set status to in progress */
  inProgress(): this;

  /** Set status to completed */
  complete(): this;

  /** Set status to failed with optional error message */
  failed(error?: string): this;

  /** Set status to cancelled */
  cancelled(): this;

  /** Set status to denied (permission denied) */
  denied(): this;

  /** Add text content to the output */
  addContent(content: ToolCallContent): this;

  /** Add a text output */
  addText(text: string): this;

  /** Add a diff output */
  addDiff(path: string, hunks: DiffHunkData[]): this;

  /** Add a terminal output reference */
  addTerminal(
    terminalId: string,
    command: string,
    exitCode?: number,
    stdout?: string,
    stderr?: string
  ): this;

  /** Set the location for this tool call */
  setLocation(
    path: string,
    line?: number,
    column?: number,
    endLine?: number,
    endColumn?: number
  ): this;

  /** Set the duration in milliseconds */
  setDuration(ms: number): this;

  /** Set the error message */
  setError(error: string): this;

  /** Send the tool call update to the client */
  send(): Promise<ToolCall>;
}

/**
 * Data for a diff hunk.
 */
export interface DiffHunkData {
  /** Starting line in the old file */
  oldStart: number;
  /** Number of lines from the old file */
  oldLines: number;
  /** Starting line in the new file */
  newStart: number;
  /** Number of lines in the new file */
  newLines: number;
  /** Unified diff content for this hunk */
  content: string;
}

// =============================================================================
// Permission Outcome
// =============================================================================

/**
 * Outcome of a permission request from the agent's perspective.
 */
export interface AgentPermissionOutcome {
  /** The outcome type */
  outcome: RequestPermissionOutcome;
  /** Whether the permission was granted */
  granted: boolean;
  /** Whether to remember this decision */
  remember: boolean;
  /** Scope of the permission (if granted) */
  scope?: "once" | "session" | "workspace" | "always";
  /** ID of the selected option */
  selectedOptionId?: string;
  /** Reason for denial (if denied) */
  reason?: string;
}

// =============================================================================
// Terminal Options
// =============================================================================

/**
 * Options for creating a terminal from the agent.
 */
export interface AgentTerminalOptions {
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

// =============================================================================
// Terminal Interface
// =============================================================================

/**
 * Interface for interacting with a terminal.
 */
export interface TerminalInterface {
  /** Unique terminal identifier */
  readonly id: string;

  /** Get current terminal output */
  output(): Promise<TerminalOutputResult>;

  /** Wait for the terminal process to exit */
  waitForExit(timeout?: number): Promise<TerminalExitStatus>;

  /** Kill the terminal process */
  kill(signal?: string): Promise<void>;

  /** Release terminal resources */
  release(): Promise<void>;
}

/**
 * Result of getting terminal output.
 */
export interface TerminalOutputResult {
  /** Output content */
  output: string;
  /** Whether the output was truncated */
  truncated: boolean;
  /** Exit status if the process has exited */
  exitStatus?: TerminalExitStatus;
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Internal session data stored by the agent.
 */
export interface SessionData {
  /** Session ID */
  id: string;
  /** Working directory */
  workingDirectory: string;
  /** MCP servers */
  mcpServers: McpServer[];
  /** System prompt */
  systemPrompt?: string;
  /** Current mode */
  currentMode?: SessionMode;
  /** Configuration options */
  configOptions: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: string;
  /** Whether cancelled */
  cancelled: boolean;
  /** Message count (for loaded sessions) */
  messageCount: number;
}

/**
 * Client information stored after initialization.
 */
export interface ClientData {
  /** Client name */
  name: string;
  /** Client version */
  version: string;
  /** Client capabilities */
  capabilities: {
    fs?: {
      read?: boolean;
      write?: boolean;
      watch?: boolean;
    };
    terminal?: {
      create?: boolean;
      interactive?: boolean;
      maxConcurrent?: number;
    };
    ui?: {
      permissionDialogs?: boolean;
      diffViewer?: boolean;
      codeNavigation?: boolean;
    };
  };
}
