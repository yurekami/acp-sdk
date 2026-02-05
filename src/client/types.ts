/**
 * ACP Client Types
 *
 * Client-specific type definitions for editors/IDEs connecting to ACP agents.
 *
 * @module @anthropic/acp-sdk/client/types
 */

import type {
  SessionUpdate,
  ToolCall,
  PermissionOption,
  PermissionScope,
  StopReason,
  UsageStats,
  AvailableCommand,
  TerminalExitStatus,
} from "../types/index.js";

// =============================================================================
// Client Options
// =============================================================================

/**
 * Options for creating an ACP client.
 */
export interface ACPClientOptions {
  /** Client name for identification */
  name: string;
  /** Client version */
  version: string;
  /** Enable file system access capabilities */
  fileSystem?: {
    /** Allow reading files */
    read?: boolean;
    /** Allow writing files */
    write?: boolean;
  };
  /** Enable terminal access */
  terminal?: boolean;
  /** Request timeout in ms (default: 30000) */
  requestTimeout?: number;
}

// =============================================================================
// Client Events
// =============================================================================

/**
 * Events emitted by the ACP client.
 */
export interface ACPClientEvents {
  /** Session update received from agent */
  update: (sessionId: string, update: SessionUpdate) => void;
  /** Connection established with agent */
  connected: () => void;
  /** Connection closed */
  disconnected: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

// =============================================================================
// Session Events
// =============================================================================

/**
 * Events emitted by a session.
 */
export interface SessionEvents {
  /** Session update received */
  update: (update: SessionUpdate) => void;
  /** Mode changed */
  modeChange: (previousMode: string, currentMode: string) => void;
  /** Config option changed */
  configChange: (key: string, value: unknown) => void;
  /** Available commands changed */
  commandsChange: (commands: AvailableCommand[]) => void;
}

// =============================================================================
// New Session Options
// =============================================================================

/**
 * Options for creating a new session.
 */
export interface NewSessionOptions {
  /** Working directory for the session */
  workingDirectory: string;
  /** Custom system prompt */
  systemPrompt?: string;
  /** Initial mode */
  initialMode?: string;
  /** Initial configuration options */
  configOptions?: Record<string, unknown>;
}

// =============================================================================
// Session Config
// =============================================================================

/**
 * A session configuration option.
 */
export interface SessionConfigOption {
  /** Configuration key */
  id: string;
  /** Human-readable label */
  label: string;
  /** Configuration description */
  description?: string;
  /** Available values for this option */
  values?: SessionConfigValue[];
  /** Current value ID */
  currentValueId?: string;
}

/**
 * A value for a configuration option.
 */
export interface SessionConfigValue {
  /** Value ID */
  id: string;
  /** Human-readable label */
  label: string;
  /** Value description */
  description?: string;
}

// =============================================================================
// Prompt Result
// =============================================================================

/**
 * Result of sending a prompt to the agent.
 */
export interface PromptResult {
  /** Why generation stopped */
  stopReason: StopReason;
  /** Token usage statistics (may be undefined) */
  usage: UsageStats | undefined;
}

// =============================================================================
// File System Handler
// =============================================================================

/**
 * Handler for file system operations requested by the agent.
 */
export interface FileSystemHandler {
  /**
   * Read content from a text file.
   *
   * @param path - Absolute path to the file
   * @param startLine - Starting line number (1-indexed, optional)
   * @param endLine - Ending line number (1-indexed, optional)
   * @returns File content
   */
  readTextFile(path: string, startLine?: number, endLine?: number): Promise<ReadFileResult>;

  /**
   * Write content to a text file.
   *
   * @param path - Absolute path to the file
   * @param content - Content to write
   * @returns Write result
   */
  writeTextFile(path: string, content: string): Promise<WriteFileResult>;
}

/**
 * Result of reading a file.
 */
export interface ReadFileResult {
  /** File content */
  content: string;
  /** Encoding used */
  encoding: string;
  /** Total lines in file */
  totalLines?: number;
  /** Whether content was truncated */
  truncated?: boolean;
}

/**
 * Result of writing a file.
 */
export interface WriteFileResult {
  /** Bytes written */
  bytesWritten: number;
  /** Whether file was created */
  created: boolean;
}

// =============================================================================
// Terminal Handler
// =============================================================================

/**
 * Options for creating a terminal (client-side).
 */
export interface ClientTerminalOptions {
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Output from a terminal.
 */
export interface TerminalOutput {
  /** Standard output content */
  stdout: string;
  /** Standard error content */
  stderr: string;
  /** Whether output is complete */
  complete: boolean;
}

/**
 * Handler for terminal operations requested by the agent.
 */
export interface TerminalHandler {
  /**
   * Create a new terminal and execute a command.
   *
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Terminal options
   * @returns Terminal ID
   */
  create(command: string, args?: string[], options?: ClientTerminalOptions): Promise<CreateTerminalResult>;

  /**
   * Get output from a terminal.
   *
   * @param terminalId - Terminal identifier
   * @returns Terminal output
   */
  output(terminalId: string): Promise<TerminalOutput>;

  /**
   * Wait for a terminal to exit.
   *
   * @param terminalId - Terminal identifier
   * @param timeout - Timeout in milliseconds
   * @returns Exit status
   */
  waitForExit(terminalId: string, timeout?: number): Promise<TerminalExitStatus>;

  /**
   * Kill a terminal process.
   *
   * @param terminalId - Terminal identifier
   * @param signal - Signal to send
   */
  kill(terminalId: string, signal?: string): Promise<void>;

  /**
   * Release terminal resources.
   *
   * @param terminalId - Terminal identifier
   */
  release(terminalId: string): Promise<void>;
}

/**
 * Result of creating a terminal.
 */
export interface CreateTerminalResult {
  /** Terminal identifier */
  terminalId: string;
  /** Process ID (may be undefined) */
  pid: number | undefined;
}

// =============================================================================
// Permission Handler
// =============================================================================

/**
 * Outcome of a permission request (client-side).
 */
export interface ClientPermissionOutcome {
  /** Whether permission was granted */
  granted: boolean;
  /** Whether to remember this decision */
  remember?: boolean;
  /** Scope of the permission */
  scope?: PermissionScope;
  /** Reason for denial */
  reason?: string;
  /** Selected option ID */
  selectedOptionId?: string;
}

/**
 * Handler for permission requests from the agent.
 */
export interface PermissionHandler {
  /**
   * Request permission for a tool call.
   *
   * @param toolCall - The tool call requiring permission
   * @param options - Permission options to present to the user
   * @returns Permission outcome
   */
  requestPermission(toolCall: ToolCall, options: PermissionOption[]): Promise<ClientPermissionOutcome>;
}

// =============================================================================
// Agent Info (from initialization)
// =============================================================================

/**
 * Information about the connected agent.
 */
export interface ConnectedAgentInfo {
  /** Agent name */
  name: string;
  /** Agent version */
  version: string;
  /** Protocol version */
  protocolVersion: number;
  /** Agent capabilities */
  capabilities: {
    /** Can load saved sessions */
    loadSession?: boolean;
    /** Prompt-related capabilities */
    promptCapabilities?: {
      streaming?: boolean;
      cancellation?: boolean;
      attachments?: boolean;
    };
    /** Session-related capabilities */
    sessionCapabilities?: {
      modes?: string[];
      configOptions?: string[];
      persistence?: boolean;
    };
  };
}
