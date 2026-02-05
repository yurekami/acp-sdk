/**
 * Terminal Types
 *
 * Types for terminal/command execution operations between agent and client.
 * The client creates and manages terminal instances on behalf of the agent.
 *
 * @see Section 5.2.4 through 5.2.8 of the ACP specification
 */

import { z } from "zod";

// =============================================================================
// Terminal Identification
// =============================================================================

/**
 * Unique identifier for a terminal instance.
 *
 * @example "term_abc123", "term_xyz789"
 */
export type TerminalId = string;

export const TerminalIdSchema = z.string().min(1);

// =============================================================================
// Environment Variables
// =============================================================================

/**
 * An environment variable to set for the terminal process.
 */
export interface EnvVariable {
  /** Variable name */
  name: string;
  /** Variable value */
  value: string;
}

export const EnvVariableSchema = z.object({
  name: z.string(),
  value: z.string(),
});

// =============================================================================
// Create Terminal
// =============================================================================

/**
 * Parameters for the `terminal/create` method.
 * Creates a new terminal instance to execute a command.
 *
 * @example
 * ```json
 * {
 *   "command": "npm",
 *   "args": ["test"],
 *   "cwd": "/home/user/project",
 *   "env": { "NODE_ENV": "test" },
 *   "timeout": 60000
 * }
 * ```
 */
export interface CreateTerminalRequest {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

export const CreateTerminalRequestSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Result of the `terminal/create` method.
 *
 * @example
 * ```json
 * {
 *   "terminalId": "term_abc123",
 *   "pid": 12345
 * }
 * ```
 */
export interface CreateTerminalResponse {
  /** Unique identifier for the created terminal */
  terminalId: TerminalId;
  /** Process ID (if available) */
  pid?: number;
}

export const CreateTerminalResponseSchema = z.object({
  terminalId: TerminalIdSchema,
  pid: z.number().int().positive().optional(),
});

// =============================================================================
// Terminal Output
// =============================================================================

/**
 * Output stream type.
 */
export type TerminalOutputStream = "stdout" | "stderr";

export const TerminalOutputStreamSchema = z.enum(["stdout", "stderr"]);

/**
 * Parameters for the `terminal/output` method.
 * Delivers terminal output to the agent.
 *
 * @example
 * ```json
 * {
 *   "terminalId": "term_abc123",
 *   "data": "Running tests...\n",
 *   "stream": "stdout"
 * }
 * ```
 */
export interface TerminalOutputRequest {
  /** Terminal identifier */
  terminalId: TerminalId;
  /** Output data */
  data: string;
  /** Output stream ("stdout" or "stderr") */
  stream?: TerminalOutputStream;
}

export const TerminalOutputRequestSchema = z.object({
  terminalId: TerminalIdSchema,
  data: z.string(),
  stream: TerminalOutputStreamSchema.optional(),
});

/**
 * Result of the `terminal/output` method.
 */
export interface TerminalOutputResponse {
  /** Whether the output was received */
  received: boolean;
}

export const TerminalOutputResponseSchema = z.object({
  received: z.boolean(),
});

// =============================================================================
// Wait for Exit
// =============================================================================

/**
 * Parameters for the `terminal/wait_for_exit` method.
 * Waits for a terminal process to exit.
 *
 * @example
 * ```json
 * {
 *   "terminalId": "term_abc123",
 *   "timeout": 30000
 * }
 * ```
 */
export interface WaitForExitRequest {
  /** Terminal identifier */
  terminalId: TerminalId;
  /** Maximum wait time in milliseconds */
  timeout?: number;
}

export const WaitForExitRequestSchema = z.object({
  terminalId: TerminalIdSchema,
  timeout: z.number().int().positive().optional(),
});

/**
 * Result of the `terminal/wait_for_exit` method.
 *
 * @example Success:
 * ```json
 * {
 *   "exitCode": 0,
 *   "timedOut": false
 * }
 * ```
 *
 * @example Timeout:
 * ```json
 * {
 *   "exitCode": null,
 *   "timedOut": true
 * }
 * ```
 *
 * @example Killed by signal:
 * ```json
 * {
 *   "exitCode": 137,
 *   "signal": "SIGKILL"
 * }
 * ```
 */
export interface WaitForExitResponse {
  /** Process exit code */
  exitCode: number | null;
  /** Signal that killed the process (if any) */
  signal?: string;
  /** Whether the wait timed out */
  timedOut?: boolean;
}

export const WaitForExitResponseSchema = z.object({
  exitCode: z.number().int().nullable(),
  signal: z.string().optional(),
  timedOut: z.boolean().optional(),
});

// =============================================================================
// Kill Terminal
// =============================================================================

/**
 * Signal to send to a process.
 */
export type TerminalSignal =
  | "SIGTERM"
  | "SIGKILL"
  | "SIGINT"
  | "SIGHUP"
  | string;

export const TerminalSignalSchema = z.string();

/**
 * Parameters for the `terminal/kill` method.
 * Terminates a running terminal process.
 *
 * @example
 * ```json
 * {
 *   "terminalId": "term_abc123",
 *   "signal": "SIGTERM"
 * }
 * ```
 */
export interface KillTerminalRequest {
  /** Terminal identifier */
  terminalId: TerminalId;
  /** Signal to send (default: "SIGTERM") */
  signal?: TerminalSignal;
  /** Force kill with SIGKILL */
  force?: boolean;
}

export const KillTerminalRequestSchema = z.object({
  terminalId: TerminalIdSchema,
  signal: TerminalSignalSchema.optional(),
  force: z.boolean().optional(),
});

/**
 * Result of the `terminal/kill` method.
 */
export interface KillTerminalResponse {
  /** Whether the process was killed */
  killed: boolean;
}

export const KillTerminalResponseSchema = z.object({
  killed: z.boolean(),
});

// =============================================================================
// Release Terminal
// =============================================================================

/**
 * Parameters for the `terminal/release` method.
 * Releases terminal resources after command completion.
 *
 * @example
 * ```json
 * {
 *   "terminalId": "term_abc123"
 * }
 * ```
 */
export interface ReleaseTerminalRequest {
  /** Terminal identifier */
  terminalId: TerminalId;
}

export const ReleaseTerminalRequestSchema = z.object({
  terminalId: TerminalIdSchema,
});

/**
 * Result of the `terminal/release` method.
 */
export interface ReleaseTerminalResponse {
  /** Whether the terminal was released */
  released: boolean;
}

export const ReleaseTerminalResponseSchema = z.object({
  released: z.boolean(),
});

// =============================================================================
// Terminal Exit Status
// =============================================================================

/**
 * Detailed exit status for a terminal process.
 */
export interface TerminalExitStatus {
  /** Exit code (0 typically means success) */
  exitCode: number | null;
  /** Signal that terminated the process (if any) */
  signal?: string;
  /** Whether the process was killed by a signal */
  signaled?: boolean;
  /** Whether the process timed out */
  timedOut?: boolean;
  /** Total execution time in milliseconds */
  duration?: number;
}

export const TerminalExitStatusSchema = z.object({
  exitCode: z.number().int().nullable(),
  signal: z.string().optional(),
  signaled: z.boolean().optional(),
  timedOut: z.boolean().optional(),
  duration: z.number().nonnegative().optional(),
});

// =============================================================================
// Terminal Info
// =============================================================================

/**
 * Information about a terminal instance.
 */
export interface TerminalInfo {
  /** Terminal identifier */
  terminalId: TerminalId;
  /** Process ID */
  pid?: number;
  /** Command being executed */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Terminal state */
  state: "running" | "exited" | "killed";
  /** Exit status (if exited or killed) */
  exitStatus?: TerminalExitStatus;
  /** When the terminal was created */
  createdAt: string;
  /** When the terminal exited (if applicable) */
  exitedAt?: string;
}

export const TerminalInfoSchema = z.object({
  terminalId: TerminalIdSchema,
  pid: z.number().int().positive().optional(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  state: z.enum(["running", "exited", "killed"]),
  exitStatus: TerminalExitStatusSchema.optional(),
  createdAt: z.string().datetime(),
  exitedAt: z.string().datetime().optional(),
});

// =============================================================================
// Type Guards and Utilities
// =============================================================================

/**
 * Check if a terminal exit status indicates success.
 */
export function isTerminalSuccess(status: TerminalExitStatus): boolean {
  return status.exitCode === 0 && !status.signaled && !status.timedOut;
}

/**
 * Check if a terminal is still running.
 */
export function isTerminalRunning(info: TerminalInfo): boolean {
  return info.state === "running";
}

/**
 * Check if a terminal was killed by a signal.
 */
export function wasTerminalKilled(status: TerminalExitStatus): boolean {
  return status.signaled === true || status.signal !== undefined;
}

/**
 * Check if a terminal timed out.
 */
export function didTerminalTimeout(status: TerminalExitStatus): boolean {
  return status.timedOut === true;
}
