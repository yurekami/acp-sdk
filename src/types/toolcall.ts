/**
 * Tool Call Types
 *
 * Types for representing agent tool invocations, their status,
 * and the content they produce.
 *
 * @see Section 8 of the ACP specification
 */

import { z } from "zod";

// =============================================================================
// Tool Call Identification
// =============================================================================

/**
 * Unique identifier for a tool call.
 *
 * @example "tc_123", "tc_abc456"
 */
export type ToolCallId = string;

export const ToolCallIdSchema = z.string().min(1);

// =============================================================================
// Tool Call Status
// =============================================================================

/**
 * Status of a tool call through its lifecycle.
 *
 * Flow: pending -> awaiting_permission -> in_progress -> completed/failed/cancelled
 *       pending -> in_progress -> completed/failed/cancelled (no permission needed)
 *       pending/in_progress -> cancelled (user cancel)
 *       awaiting_permission -> denied (permission denied)
 *
 * @see Section 8.2 of the ACP specification
 */
export type ToolCallStatus =
  | "pending"
  | "awaiting_permission"
  | "in_progress"
  | "completed"
  | "failed"
  | "denied"
  | "cancelled";

export const ToolCallStatusSchema = z.enum([
  "pending",
  "awaiting_permission",
  "in_progress",
  "completed",
  "failed",
  "denied",
  "cancelled",
]);

// =============================================================================
// Tool Kind
// =============================================================================

/**
 * Category of tool operation.
 * Used for UI presentation and permission grouping.
 */
export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "other";

export const ToolKindSchema = z.enum([
  "read",
  "edit",
  "delete",
  "move",
  "search",
  "execute",
  "think",
  "fetch",
  "other",
]);

// =============================================================================
// Tool Call Location
// =============================================================================

/**
 * Location information for a tool call.
 * Used by clients to navigate to relevant code.
 *
 * @example
 * ```json
 * {
 *   "path": "/home/user/project/src/auth.ts",
 *   "line": 42,
 *   "column": 5,
 *   "endLine": 55,
 *   "endColumn": 2
 * }
 * ```
 */
export interface ToolCallLocation {
  /** Absolute file path */
  path: string;
  /** Starting line number (1-indexed) */
  line?: number;
  /** Starting column number (1-indexed) */
  column?: number;
  /** Ending line number (1-indexed) */
  endLine?: number;
  /** Ending column number (1-indexed) */
  endColumn?: number;
}

export const ToolCallLocationSchema = z.object({
  path: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
});

// =============================================================================
// Tool Call Content Types
// =============================================================================

/**
 * Text content from a tool call.
 */
export interface ToolCallTextContent {
  /** Content type identifier */
  type: "text";
  /** Text content */
  text: string;
}

export const ToolCallTextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

/**
 * A single diff hunk.
 */
export interface DiffHunk {
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

export const DiffHunkSchema = z.object({
  oldStart: z.number().int(),
  oldLines: z.number().int().nonnegative(),
  newStart: z.number().int(),
  newLines: z.number().int().nonnegative(),
  content: z.string(),
});

/**
 * Diff content from a tool call (typically file edits).
 *
 * @example
 * ```json
 * {
 *   "type": "diff",
 *   "path": "/home/user/project/src/auth.ts",
 *   "hunks": [
 *     {
 *       "oldStart": 10,
 *       "oldLines": 5,
 *       "newStart": 10,
 *       "newLines": 8,
 *       "content": "@@ -10,5 +10,8 @@\n function auth() {...}"
 *     }
 *   ]
 * }
 * ```
 */
export interface ToolCallDiffContent {
  /** Content type identifier */
  type: "diff";
  /** Path to the modified file */
  path: string;
  /** Array of diff hunks */
  hunks: DiffHunk[];
}

export const ToolCallDiffContentSchema = z.object({
  type: z.literal("diff"),
  path: z.string(),
  hunks: z.array(DiffHunkSchema),
});

/**
 * Terminal content from a tool call (command execution results).
 *
 * @example
 * ```json
 * {
 *   "type": "terminal",
 *   "terminalId": "term_abc",
 *   "command": "npm test",
 *   "exitCode": 0,
 *   "stdout": "All tests passed!",
 *   "stderr": ""
 * }
 * ```
 */
export interface ToolCallTerminalContent {
  /** Content type identifier */
  type: "terminal";
  /** Terminal identifier */
  terminalId: string;
  /** Command that was executed */
  command: string;
  /** Process exit code */
  exitCode?: number;
  /** Standard output content */
  stdout?: string;
  /** Standard error content */
  stderr?: string;
}

export const ToolCallTerminalContentSchema = z.object({
  type: z.literal("terminal"),
  terminalId: z.string(),
  command: z.string(),
  exitCode: z.number().int().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});

/**
 * Union type for tool call output content.
 */
export type ToolCallContent =
  | ToolCallTextContent
  | ToolCallDiffContent
  | ToolCallTerminalContent;

export const ToolCallContentSchema = z.discriminatedUnion("type", [
  ToolCallTextContentSchema,
  ToolCallDiffContentSchema,
  ToolCallTerminalContentSchema,
]);

// =============================================================================
// Tool Call
// =============================================================================

/**
 * Represents an agent's invocation of a tool.
 * Sent via session/update notification when agent starts a tool call.
 *
 * @example
 * ```json
 * {
 *   "id": "tc_123",
 *   "tool": "fs/write_text_file",
 *   "input": {
 *     "path": "/home/user/project/src/auth.ts",
 *     "content": "// Refactored code..."
 *   },
 *   "status": "pending",
 *   "requiresPermission": true,
 *   "kind": "edit"
 * }
 * ```
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: ToolCallId;
  /** Tool/method name being invoked */
  tool: string;
  /** Input parameters for the tool */
  input: Record<string, unknown>;
  /** Current status of the tool call */
  status: ToolCallStatus;
  /** Whether this tool call requires user permission */
  requiresPermission?: boolean;
  /** Category of the tool operation */
  kind?: ToolKind;
  /** Location in code relevant to this tool call */
  location?: ToolCallLocation;
  /** Human-readable reason for the tool call */
  reason?: string;
}

export const ToolCallSchema = z.object({
  id: ToolCallIdSchema,
  tool: z.string(),
  input: z.record(z.unknown()),
  status: ToolCallStatusSchema,
  requiresPermission: z.boolean().optional(),
  kind: ToolKindSchema.optional(),
  location: ToolCallLocationSchema.optional(),
  reason: z.string().optional(),
});

// =============================================================================
// Tool Call Update
// =============================================================================

/**
 * Update to an existing tool call.
 * Sent via session/update notification to update status or provide results.
 *
 * @example Completed:
 * ```json
 * {
 *   "id": "tc_123",
 *   "status": "completed",
 *   "output": {
 *     "type": "text",
 *     "text": "File successfully written"
 *   },
 *   "duration": 45
 * }
 * ```
 *
 * @example Failed:
 * ```json
 * {
 *   "id": "tc_123",
 *   "status": "failed",
 *   "error": "Permission denied: /etc/passwd"
 * }
 * ```
 */
export interface ToolCallUpdate {
  /** ID of the tool call being updated */
  id: ToolCallId;
  /** New status */
  status: ToolCallStatus;
  /** Output content (for completed tool calls) */
  output?: ToolCallContent;
  /** Error message (for failed tool calls) */
  error?: string;
  /** Duration of the tool call in milliseconds */
  duration?: number;
}

export const ToolCallUpdateSchema = z.object({
  id: ToolCallIdSchema,
  status: ToolCallStatusSchema,
  output: ToolCallContentSchema.optional(),
  error: z.string().optional(),
  duration: z.number().nonnegative().optional(),
});

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if tool call content is text.
 */
export function isToolCallTextContent(
  content: ToolCallContent
): content is ToolCallTextContent {
  return content.type === "text";
}

/**
 * Type guard to check if tool call content is a diff.
 */
export function isToolCallDiffContent(
  content: ToolCallContent
): content is ToolCallDiffContent {
  return content.type === "diff";
}

/**
 * Type guard to check if tool call content is terminal output.
 */
export function isToolCallTerminalContent(
  content: ToolCallContent
): content is ToolCallTerminalContent {
  return content.type === "terminal";
}

/**
 * Check if a tool call is in a terminal state (completed, failed, denied, or cancelled).
 */
export function isToolCallTerminal(status: ToolCallStatus): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "denied" ||
    status === "cancelled"
  );
}

/**
 * Check if a tool call is active (pending, awaiting_permission, or in_progress).
 */
export function isToolCallActive(status: ToolCallStatus): boolean {
  return (
    status === "pending" ||
    status === "awaiting_permission" ||
    status === "in_progress"
  );
}
