/**
 * Permission Types
 *
 * Types for the ACP permission system, which provides defense in depth
 * for sensitive operations.
 *
 * @see Section 5.2.1 and Section 14.2 of the ACP specification
 */

import { z } from "zod";
import { SessionId, SessionIdSchema } from "./session.js";
import { ToolCallId, ToolCallIdSchema } from "./toolcall.js";

// =============================================================================
// Permission Operation Types
// =============================================================================

/**
 * Types of operations that may require permission.
 */
export type PermissionOperation =
  | "file_read"
  | "file_write"
  | "file_delete"
  | "terminal_execute"
  | "network_access"
  | "mcp_tool"
  | string;

export const PermissionOperationSchema = z.string();

// =============================================================================
// Permission Scope
// =============================================================================

/**
 * Scope of a permission grant.
 *
 * - `once`: This request only
 * - `session`: This session
 * - `workspace`: This workspace
 * - `always`: Permanent
 */
export type PermissionScope = "once" | "session" | "workspace" | "always";

export const PermissionScopeSchema = z.enum([
  "once",
  "session",
  "workspace",
  "always",
]);

// =============================================================================
// Permission Option Kind
// =============================================================================

/**
 * Type of permission decision.
 *
 * - `allow_once`: Allow this request only
 * - `allow_always`: Allow always for this resource/operation
 * - `reject_once`: Reject this request only
 * - `reject_always`: Reject always for this resource/operation
 */
export type PermissionOptionKind =
  | "allow_once"
  | "allow_always"
  | "reject_once"
  | "reject_always";

export const PermissionOptionKindSchema = z.enum([
  "allow_once",
  "allow_always",
  "reject_once",
  "reject_always",
]);

// =============================================================================
// Permission Option
// =============================================================================

/**
 * A permission option presented to the user.
 */
export interface PermissionOption {
  /** Unique identifier for this option */
  id: string;
  /** Kind of permission decision */
  kind: PermissionOptionKind;
  /** Human-readable label for the option */
  label: string;
  /** Additional description */
  description?: string;
  /** Whether this is the default/recommended option */
  isDefault?: boolean;
}

export const PermissionOptionSchema = z.object({
  id: z.string(),
  kind: PermissionOptionKindSchema,
  label: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// =============================================================================
// Request Permission Request
// =============================================================================

/**
 * Parameters for the `session/request_permission` method.
 * Sent by the agent to request user permission for an operation.
 *
 * @example
 * ```json
 * {
 *   "sessionId": "sess_abc123",
 *   "operation": "file_write",
 *   "resource": "/home/user/project/src/auth.ts",
 *   "reason": "Add error handling to login function",
 *   "toolCallId": "tc_002"
 * }
 * ```
 */
export interface RequestPermissionRequest {
  /** Session requesting permission */
  sessionId: SessionId;
  /** Type of operation being performed */
  operation: PermissionOperation;
  /** Resource being accessed (file path, URL, command, etc.) */
  resource: string;
  /** Human-readable reason why permission is needed */
  reason?: string;
  /** Associated tool call ID */
  toolCallId?: ToolCallId;
  /** Custom permission options to present to the user */
  options?: PermissionOption[];
  /** Additional context for the permission request */
  context?: Record<string, unknown>;
}

export const RequestPermissionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  operation: PermissionOperationSchema,
  resource: z.string(),
  reason: z.string().optional(),
  toolCallId: ToolCallIdSchema.optional(),
  options: z.array(PermissionOptionSchema).optional(),
  context: z.record(z.unknown()).optional(),
});

// =============================================================================
// Request Permission Response
// =============================================================================

/**
 * Result of the `session/request_permission` method.
 * Returned by the client with the user's decision.
 *
 * @example Granted:
 * ```json
 * {
 *   "granted": true,
 *   "remember": true,
 *   "scope": "session"
 * }
 * ```
 *
 * @example Denied:
 * ```json
 * {
 *   "granted": false,
 *   "reason": "User rejected file write"
 * }
 * ```
 */
export interface RequestPermissionResponse {
  /** Whether permission was granted */
  granted: boolean;
  /** Whether to remember this decision */
  remember?: boolean;
  /** Scope of the permission grant (if granted) */
  scope?: PermissionScope;
  /** Reason for denial (if denied) */
  reason?: string;
  /** ID of the selected option (if options were provided) */
  selectedOptionId?: string;
}

export const RequestPermissionResponseSchema = z.object({
  granted: z.boolean(),
  remember: z.boolean().optional(),
  scope: PermissionScopeSchema.optional(),
  reason: z.string().optional(),
  selectedOptionId: z.string().optional(),
});

// =============================================================================
// Permission Outcome
// =============================================================================

/**
 * Outcome of a permission request for tracking/logging.
 */
export type RequestPermissionOutcome =
  | "granted"
  | "denied"
  | "granted_always"
  | "denied_always"
  | "timeout"
  | "cancelled";

export const RequestPermissionOutcomeSchema = z.enum([
  "granted",
  "denied",
  "granted_always",
  "denied_always",
  "timeout",
  "cancelled",
]);

// =============================================================================
// Permission Entry (for tracking)
// =============================================================================

/**
 * A recorded permission decision for audit/tracking purposes.
 */
export interface PermissionEntry {
  /** Timestamp of the decision */
  timestamp: string;
  /** Session ID */
  sessionId: SessionId;
  /** Operation type */
  operation: PermissionOperation;
  /** Resource that was accessed */
  resource: string;
  /** Outcome of the permission request */
  outcome: RequestPermissionOutcome;
  /** Scope of the decision */
  scope?: PermissionScope;
  /** Associated tool call ID */
  toolCallId?: ToolCallId;
}

export const PermissionEntrySchema = z.object({
  timestamp: z.string().datetime(),
  sessionId: SessionIdSchema,
  operation: PermissionOperationSchema,
  resource: z.string(),
  outcome: RequestPermissionOutcomeSchema,
  scope: PermissionScopeSchema.optional(),
  toolCallId: ToolCallIdSchema.optional(),
});

// =============================================================================
// Permission Rule (for auto-approval)
// =============================================================================

/**
 * A permission rule for automatic approval/denial.
 */
export interface PermissionRule {
  /** Unique identifier for this rule */
  id: string;
  /** Operation type this rule applies to */
  operation: PermissionOperation;
  /** Resource pattern (glob or regex) */
  resourcePattern: string;
  /** Whether to allow or deny */
  allow: boolean;
  /** Scope of this rule */
  scope: PermissionScope;
  /** When this rule was created */
  createdAt: string;
  /** When this rule expires (optional) */
  expiresAt?: string;
}

export const PermissionRuleSchema = z.object({
  id: z.string(),
  operation: PermissionOperationSchema,
  resourcePattern: z.string(),
  allow: z.boolean(),
  scope: PermissionScopeSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a permission response indicates granted permission.
 */
export function isPermissionGranted(
  response: RequestPermissionResponse
): boolean {
  return response.granted === true;
}

/**
 * Check if a permission response indicates the decision should be remembered.
 */
export function shouldRememberPermission(
  response: RequestPermissionResponse
): boolean {
  return response.remember === true;
}

/**
 * Check if an outcome indicates permission was granted.
 */
export function isOutcomeGranted(outcome: RequestPermissionOutcome): boolean {
  return outcome === "granted" || outcome === "granted_always";
}

/**
 * Check if an outcome indicates permission was denied.
 */
export function isOutcomeDenied(outcome: RequestPermissionOutcome): boolean {
  return outcome === "denied" || outcome === "denied_always";
}
