/**
 * Session Types
 *
 * Types for ACP sessions, session updates, plans, and message chunks.
 *
 * @see Section 7 of the ACP specification
 */

import { z } from "zod";
import { ToolCall, ToolCallSchema, ToolCallUpdate, ToolCallUpdateSchema } from "./toolcall.js";

// =============================================================================
// Session Identification
// =============================================================================

/**
 * Unique identifier for a session.
 *
 * @example "sess_abc123", "sess_xyz789"
 */
export type SessionId = string;

export const SessionIdSchema = z.string().min(1);

// =============================================================================
// Plan Types
// =============================================================================

/**
 * Status of a plan step.
 */
export type PlanStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export const PlanStepStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "skipped",
]);

/**
 * A single step in an execution plan.
 *
 * @example
 * ```json
 * {
 *   "id": "step_1",
 *   "description": "Read current implementation",
 *   "status": "completed"
 * }
 * ```
 */
export interface PlanStep {
  /** Unique identifier for this step */
  id: string;
  /** Human-readable description of the step */
  description: string;
  /** Current status of the step */
  status: PlanStepStatus;
  /** Additional details about the step */
  details?: string;
  /** Child steps (for hierarchical plans) */
  children?: PlanStep[];
}

// Use z.lazy() for recursive schema definition
// We cast to the correct type since Zod's recursive type inference is limited
export const PlanStepSchema: z.ZodType<PlanStep> = z.lazy(() =>
  z.object({
    id: z.string(),
    description: z.string(),
    status: PlanStepStatusSchema,
    details: z.string().optional(),
    children: z.array(PlanStepSchema).optional(),
  })
) as z.ZodType<PlanStep>;

/**
 * An execution plan created by the agent.
 *
 * @example
 * ```json
 * {
 *   "planId": "plan_xyz",
 *   "title": "Refactor auth module",
 *   "steps": [
 *     { "id": "step_1", "description": "Read current implementation", "status": "completed" },
 *     { "id": "step_2", "description": "Refactor to async/await", "status": "in_progress" }
 *   ]
 * }
 * ```
 */
export interface Plan {
  /** Unique identifier for this plan */
  planId: string;
  /** Human-readable title for the plan */
  title?: string;
  /** Steps in the plan */
  steps: PlanStep[];
}

export const PlanSchema = z.object({
  planId: z.string(),
  title: z.string().optional(),
  steps: z.array(PlanStepSchema),
});

// =============================================================================
// Message Chunk Types
// =============================================================================

/**
 * A chunk of agent message text (streaming).
 *
 * @example
 * ```json
 * {
 *   "content": "I've analyzed the code and found ",
 *   "index": 0,
 *   "final": false
 * }
 * ```
 */
export interface AgentMessageChunk {
  /** Text content of this chunk */
  content: string;
  /** Index of this chunk in the message sequence */
  index: number;
  /** Whether this is the final chunk of the message */
  final?: boolean;
}

export const AgentMessageChunkSchema = z.object({
  content: z.string(),
  index: z.number().int().nonnegative(),
  final: z.boolean().optional(),
});

/**
 * A chunk of user message text (echo).
 *
 * @example
 * ```json
 * {
 *   "content": "Please refactor...",
 *   "index": 0,
 *   "final": true
 * }
 * ```
 */
export interface UserMessageChunk {
  /** Text content of this chunk */
  content: string;
  /** Index of this chunk in the message sequence */
  index: number;
  /** Whether this is the final chunk of the message */
  final?: boolean;
}

export const UserMessageChunkSchema = z.object({
  content: z.string(),
  index: z.number().int().nonnegative(),
  final: z.boolean().optional(),
});

/**
 * A chunk of agent thought/reasoning (chain-of-thought).
 *
 * @example
 * ```json
 * {
 *   "content": "I should first check the existing error handling...",
 *   "index": 0,
 *   "visible": true
 * }
 * ```
 */
export interface ThoughtMessageChunk {
  /** Text content of this thought */
  content: string;
  /** Index of this chunk in the thought sequence */
  index: number;
  /** Whether this thought should be shown to the user */
  visible?: boolean;
  /** Whether this is the final thought chunk */
  final?: boolean;
}

export const ThoughtMessageChunkSchema = z.object({
  content: z.string(),
  index: z.number().int().nonnegative(),
  visible: z.boolean().optional(),
  final: z.boolean().optional(),
});

// =============================================================================
// Command Types
// =============================================================================

/**
 * An available slash command.
 */
export interface AvailableCommand {
  /** Command name (without slash) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Command arguments specification */
  args?: string;
}

export const AvailableCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  args: z.string().optional(),
});

// =============================================================================
// Mode Types
// =============================================================================

/**
 * Common session modes.
 * Agents may support additional custom modes.
 */
export type SessionMode =
  | "default"
  | "plan"
  | "code"
  | "architect"
  | "ask"
  | string;

export const SessionModeSchema = z.string();

/**
 * Data for a mode change update.
 */
export interface ModeChangeData {
  /** Mode before the change */
  previousMode: SessionMode;
  /** Mode after the change */
  currentMode: SessionMode;
  /** Reason for the mode change */
  reason?: string;
}

export const ModeChangeDataSchema = z.object({
  previousMode: SessionModeSchema,
  currentMode: SessionModeSchema,
  reason: z.string().optional(),
});

// =============================================================================
// Config Option Types
// =============================================================================

/**
 * Data for a config option change update.
 */
export interface ConfigOptionChangeData {
  /** Configuration key */
  key: string;
  /** Value before the change */
  previousValue?: unknown;
  /** Value after the change */
  currentValue: unknown;
  /** Source of the change */
  source?: "user" | "agent" | "system";
}

export const ConfigOptionChangeDataSchema = z.object({
  key: z.string(),
  previousValue: z.unknown().optional(),
  currentValue: z.unknown(),
  source: z.enum(["user", "agent", "system"]).optional(),
});

// =============================================================================
// Session Update Types
// =============================================================================

/**
 * All session update type identifiers.
 */
export type SessionUpdateType =
  | "plan"
  | "agent_message_chunk"
  | "user_message_chunk"
  | "thought_message_chunk"
  | "tool_call"
  | "tool_call_update"
  | "available_commands"
  | "current_mode_update"
  | "config_option_update";

export const SessionUpdateTypeSchema = z.enum([
  "plan",
  "agent_message_chunk",
  "user_message_chunk",
  "thought_message_chunk",
  "tool_call",
  "tool_call_update",
  "available_commands",
  "current_mode_update",
  "config_option_update",
]);

// =============================================================================
// Individual Session Update Types
// =============================================================================

/**
 * Plan update - agent is creating or updating an execution plan.
 */
export interface PlanUpdate {
  sessionId: SessionId;
  type: "plan";
  data: Plan;
  timestamp?: string;
}

export const PlanUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("plan"),
  data: PlanSchema,
  timestamp: z.string().datetime().optional(),
});

/**
 * Agent message chunk update - streaming text from the agent.
 */
export interface AgentMessageChunkUpdate {
  sessionId: SessionId;
  type: "agent_message_chunk";
  data: AgentMessageChunk;
  timestamp?: string;
}

export const AgentMessageChunkUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("agent_message_chunk"),
  data: AgentMessageChunkSchema,
  timestamp: z.string().datetime().optional(),
});

/**
 * User message chunk update - echo of user input.
 */
export interface UserMessageChunkUpdate {
  sessionId: SessionId;
  type: "user_message_chunk";
  data: UserMessageChunk;
  timestamp?: string;
}

export const UserMessageChunkUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("user_message_chunk"),
  data: UserMessageChunkSchema,
  timestamp: z.string().datetime().optional(),
});

/**
 * Thought message chunk update - agent's internal reasoning.
 */
export interface ThoughtMessageChunkUpdate {
  sessionId: SessionId;
  type: "thought_message_chunk";
  data: ThoughtMessageChunk;
  timestamp?: string;
}

export const ThoughtMessageChunkUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("thought_message_chunk"),
  data: ThoughtMessageChunkSchema,
  timestamp: z.string().datetime().optional(),
});

/**
 * Tool call update - agent is invoking a tool.
 */
export interface ToolCallSessionUpdate {
  sessionId: SessionId;
  type: "tool_call";
  data: ToolCall;
  timestamp?: string;
}

export const ToolCallSessionUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("tool_call"),
  data: ToolCallSchema,
  timestamp: z.string().datetime().optional(),
});

/**
 * Tool call status update - update to an existing tool call.
 */
export interface ToolCallUpdateSessionUpdate {
  sessionId: SessionId;
  type: "tool_call_update";
  data: ToolCallUpdate;
  timestamp?: string;
}

export const ToolCallUpdateSessionUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("tool_call_update"),
  data: ToolCallUpdateSchema,
  timestamp: z.string().datetime().optional(),
});

/**
 * Available commands update - agent announces available slash commands.
 */
export interface AvailableCommandsUpdate {
  sessionId: SessionId;
  type: "available_commands";
  data: {
    commands: AvailableCommand[];
  };
  timestamp?: string;
}

export const AvailableCommandsUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("available_commands"),
  data: z.object({
    commands: z.array(AvailableCommandSchema),
  }),
  timestamp: z.string().datetime().optional(),
});

/**
 * Current mode update - agent's operating mode has changed.
 */
export interface CurrentModeUpdate {
  sessionId: SessionId;
  type: "current_mode_update";
  data: ModeChangeData;
  timestamp?: string;
}

export const CurrentModeUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("current_mode_update"),
  data: ModeChangeDataSchema,
  timestamp: z.string().datetime().optional(),
});

/**
 * Config option update - a configuration option has changed.
 */
export interface ConfigOptionUpdate {
  sessionId: SessionId;
  type: "config_option_update";
  data: ConfigOptionChangeData;
  timestamp?: string;
}

export const ConfigOptionUpdateSchema = z.object({
  sessionId: SessionIdSchema,
  type: z.literal("config_option_update"),
  data: ConfigOptionChangeDataSchema,
  timestamp: z.string().datetime().optional(),
});

// =============================================================================
// Session Update Union
// =============================================================================

/**
 * Union type for all session updates.
 * Sent via the `session/update` notification.
 *
 * @see Section 7 of the ACP specification
 */
export type SessionUpdate =
  | PlanUpdate
  | AgentMessageChunkUpdate
  | UserMessageChunkUpdate
  | ThoughtMessageChunkUpdate
  | ToolCallSessionUpdate
  | ToolCallUpdateSessionUpdate
  | AvailableCommandsUpdate
  | CurrentModeUpdate
  | ConfigOptionUpdate;

export const SessionUpdateSchema = z.discriminatedUnion("type", [
  PlanUpdateSchema,
  AgentMessageChunkUpdateSchema,
  UserMessageChunkUpdateSchema,
  ThoughtMessageChunkUpdateSchema,
  ToolCallSessionUpdateSchema,
  ToolCallUpdateSessionUpdateSchema,
  AvailableCommandsUpdateSchema,
  CurrentModeUpdateSchema,
  ConfigOptionUpdateSchema,
]);

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for plan update.
 */
export function isPlanUpdate(update: SessionUpdate): update is PlanUpdate {
  return update.type === "plan";
}

/**
 * Type guard for agent message chunk update.
 */
export function isAgentMessageChunkUpdate(
  update: SessionUpdate
): update is AgentMessageChunkUpdate {
  return update.type === "agent_message_chunk";
}

/**
 * Type guard for user message chunk update.
 */
export function isUserMessageChunkUpdate(
  update: SessionUpdate
): update is UserMessageChunkUpdate {
  return update.type === "user_message_chunk";
}

/**
 * Type guard for thought message chunk update.
 */
export function isThoughtMessageChunkUpdate(
  update: SessionUpdate
): update is ThoughtMessageChunkUpdate {
  return update.type === "thought_message_chunk";
}

/**
 * Type guard for tool call update.
 */
export function isToolCallUpdate(
  update: SessionUpdate
): update is ToolCallSessionUpdate {
  return update.type === "tool_call";
}

/**
 * Type guard for tool call status update.
 */
export function isToolCallStatusUpdate(
  update: SessionUpdate
): update is ToolCallUpdateSessionUpdate {
  return update.type === "tool_call_update";
}

/**
 * Type guard for available commands update.
 */
export function isAvailableCommandsUpdate(
  update: SessionUpdate
): update is AvailableCommandsUpdate {
  return update.type === "available_commands";
}

/**
 * Type guard for current mode update.
 */
export function isCurrentModeUpdate(
  update: SessionUpdate
): update is CurrentModeUpdate {
  return update.type === "current_mode_update";
}

/**
 * Type guard for config option update.
 */
export function isConfigOptionUpdate(
  update: SessionUpdate
): update is ConfigOptionUpdate {
  return update.type === "config_option_update";
}
