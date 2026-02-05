/**
 * ACP Protocol Types
 *
 * Core protocol types for initialization, authentication, and session management.
 *
 * @see Sections 4 and 5 of the ACP specification
 */

import { z } from "zod";
import { ContentBlock, ContentBlockSchema } from "./content.js";
import { McpServer, McpServerSchema, AgentMcpCapabilities, AgentMcpCapabilitiesSchema } from "./mcp.js";
import { SessionId, SessionIdSchema, SessionMode, SessionModeSchema } from "./session.js";

// =============================================================================
// Implementation Info
// =============================================================================

/**
 * Information about a client implementation.
 */
export interface ClientInfo {
  /** Client name (e.g., "VS Code", "Zed") */
  name: string;
  /** Client version */
  version: string;
}

export const ClientInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
});

/**
 * Information about an agent implementation.
 */
export interface AgentInfo {
  /** Agent name (e.g., "Claude Agent") */
  name: string;
  /** Agent version */
  version: string;
}

export const AgentInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
});

// =============================================================================
// Client Capabilities
// =============================================================================

/**
 * File system capabilities that a client provides.
 */
export interface ClientFsCapabilities {
  /** Can read files */
  read?: boolean;
  /** Can write files */
  write?: boolean;
  /** Can watch for file changes */
  watch?: boolean;
}

export const ClientFsCapabilitiesSchema = z.object({
  read: z.boolean().optional(),
  write: z.boolean().optional(),
  watch: z.boolean().optional(),
});

/**
 * Terminal capabilities that a client provides.
 */
export interface ClientTerminalCapabilities {
  /** Can create terminals */
  create?: boolean;
  /** Supports interactive terminals */
  interactive?: boolean;
  /** Maximum concurrent terminals */
  maxConcurrent?: number;
}

export const ClientTerminalCapabilitiesSchema = z.object({
  create: z.boolean().optional(),
  interactive: z.boolean().optional(),
  maxConcurrent: z.number().int().positive().optional(),
});

/**
 * UI capabilities that a client provides.
 */
export interface ClientUiCapabilities {
  /** Can show permission dialogs */
  permissionDialogs?: boolean;
  /** Can display diffs */
  diffViewer?: boolean;
  /** Supports code navigation */
  codeNavigation?: boolean;
}

export const ClientUiCapabilitiesSchema = z.object({
  permissionDialogs: z.boolean().optional(),
  diffViewer: z.boolean().optional(),
  codeNavigation: z.boolean().optional(),
});

/**
 * Capabilities that a client declares during initialization.
 *
 * @see Section 10.2 of the ACP specification
 */
export interface ClientCapabilities {
  /** File system capabilities */
  fs?: ClientFsCapabilities;
  /** Terminal capabilities */
  terminal?: ClientTerminalCapabilities;
  /** UI capabilities */
  ui?: ClientUiCapabilities;
  /** Custom capabilities (underscore-prefixed) */
  _custom?: Record<string, unknown>;
}

export const ClientCapabilitiesSchema = z.object({
  fs: ClientFsCapabilitiesSchema.optional(),
  terminal: ClientTerminalCapabilitiesSchema.optional(),
  ui: ClientUiCapabilitiesSchema.optional(),
  _custom: z.record(z.unknown()).optional(),
});

// =============================================================================
// Agent Capabilities
// =============================================================================

/**
 * Prompt-related capabilities that an agent provides.
 */
export interface AgentPromptCapabilities {
  /** Supports streaming responses */
  streaming?: boolean;
  /** Supports mid-request cancellation */
  cancellation?: boolean;
  /** Supports file attachments */
  attachments?: boolean;
}

export const AgentPromptCapabilitiesSchema = z.object({
  streaming: z.boolean().optional(),
  cancellation: z.boolean().optional(),
  attachments: z.boolean().optional(),
});

/**
 * Session-related capabilities that an agent provides.
 */
export interface AgentSessionCapabilities {
  /** Available operating modes */
  modes?: string[];
  /** Configurable options */
  configOptions?: string[];
  /** Supports session persistence */
  persistence?: boolean;
}

export const AgentSessionCapabilitiesSchema = z.object({
  modes: z.array(z.string()).optional(),
  configOptions: z.array(z.string()).optional(),
  persistence: z.boolean().optional(),
});

/**
 * Capabilities that an agent declares during initialization.
 *
 * @see Section 10.1 of the ACP specification
 */
export interface AgentCapabilities {
  /** Can load saved sessions */
  loadSession?: boolean;
  /** MCP-related capabilities */
  mcpCapabilities?: AgentMcpCapabilities;
  /** Prompt-related capabilities */
  promptCapabilities?: AgentPromptCapabilities;
  /** Session-related capabilities */
  sessionCapabilities?: AgentSessionCapabilities;
  /** Custom capabilities (underscore-prefixed) */
  _custom?: Record<string, unknown>;
}

export const AgentCapabilitiesSchema = z.object({
  loadSession: z.boolean().optional(),
  mcpCapabilities: AgentMcpCapabilitiesSchema.optional(),
  promptCapabilities: AgentPromptCapabilitiesSchema.optional(),
  sessionCapabilities: AgentSessionCapabilitiesSchema.optional(),
  _custom: z.record(z.unknown()).optional(),
});

// =============================================================================
// Initialize
// =============================================================================

/**
 * Parameters for the `initialize` method.
 *
 * @example
 * ```json
 * {
 *   "protocolVersion": 1,
 *   "clientInfo": { "name": "VS Code", "version": "1.85.0" },
 *   "capabilities": {
 *     "fs": { "read": true, "write": true },
 *     "terminal": { "create": true }
 *   }
 * }
 * ```
 */
export interface InitializeRequest {
  /** Protocol version (currently 1) */
  protocolVersion: number;
  /** Information about the client */
  clientInfo: ClientInfo;
  /** Client capabilities */
  capabilities: ClientCapabilities;
  /** Extension metadata */
  _meta?: Record<string, unknown>;
}

export const InitializeRequestSchema = z.object({
  protocolVersion: z.number().int().positive(),
  clientInfo: ClientInfoSchema,
  capabilities: ClientCapabilitiesSchema,
  _meta: z.record(z.unknown()).optional(),
});

/**
 * Result of the `initialize` method.
 *
 * @example
 * ```json
 * {
 *   "protocolVersion": 1,
 *   "agentInfo": { "name": "Claude Agent", "version": "1.0.0" },
 *   "capabilities": {
 *     "loadSession": true,
 *     "promptCapabilities": { "streaming": true, "cancellation": true }
 *   }
 * }
 * ```
 */
export interface InitializeResponse {
  /** Negotiated protocol version */
  protocolVersion: number;
  /** Information about the agent */
  agentInfo: AgentInfo;
  /** Agent capabilities */
  capabilities: AgentCapabilities;
}

export const InitializeResponseSchema = z.object({
  protocolVersion: z.number().int().positive(),
  agentInfo: AgentInfoSchema,
  capabilities: AgentCapabilitiesSchema,
});

// =============================================================================
// Authenticate
// =============================================================================

/**
 * Parameters for the `authenticate` method.
 *
 * @example API key:
 * ```json
 * {
 *   "method": "api_key",
 *   "credentials": { "apiKey": "sk-..." }
 * }
 * ```
 *
 * @example OAuth2:
 * ```json
 * {
 *   "method": "oauth2",
 *   "credentials": { "token": "eyJ..." }
 * }
 * ```
 */
export interface AuthenticateRequest {
  /** Authentication method */
  method: "api_key" | "oauth2" | "custom" | string;
  /** Method-specific credentials */
  credentials: Record<string, unknown>;
}

export const AuthenticateRequestSchema = z.object({
  method: z.string(),
  credentials: z.record(z.unknown()),
});

/**
 * Result of the `authenticate` method.
 *
 * @example Success:
 * ```json
 * {
 *   "success": true,
 *   "expiresAt": "2024-12-31T23:59:59Z"
 * }
 * ```
 *
 * @example Failure:
 * ```json
 * {
 *   "success": false,
 *   "error": "Invalid API key"
 * }
 * ```
 */
export interface AuthenticateResponse {
  /** Whether authentication succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Expiration timestamp (ISO 8601) */
  expiresAt?: string;
}

export const AuthenticateResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

// =============================================================================
// Session New
// =============================================================================

/**
 * Parameters for the `session/new` method.
 *
 * @example
 * ```json
 * {
 *   "workingDirectory": "/home/user/project",
 *   "mcpServers": [
 *     {
 *       "name": "filesystem",
 *       "transport": { "type": "stdio", "command": "mcp-server-filesystem" }
 *     }
 *   ],
 *   "systemPrompt": "You are a helpful coding assistant.",
 *   "initialMode": "default"
 * }
 * ```
 */
export interface SessionNewRequest {
  /** Absolute path to working directory */
  workingDirectory: string;
  /** MCP servers to connect */
  mcpServers?: McpServer[];
  /** Custom system prompt */
  systemPrompt?: string;
  /** Starting mode */
  initialMode?: SessionMode;
  /** Initial configuration options */
  configOptions?: Record<string, unknown>;
}

export const SessionNewRequestSchema = z.object({
  workingDirectory: z.string(),
  mcpServers: z.array(McpServerSchema).optional(),
  systemPrompt: z.string().optional(),
  initialMode: SessionModeSchema.optional(),
  configOptions: z.record(z.unknown()).optional(),
});

/**
 * Result of the `session/new` method.
 *
 * @example
 * ```json
 * {
 *   "sessionId": "sess_a1b2c3d4",
 *   "createdAt": "2026-02-04T10:30:00Z"
 * }
 * ```
 */
export interface SessionNewResponse {
  /** Unique session identifier */
  sessionId: SessionId;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
}

export const SessionNewResponseSchema = z.object({
  sessionId: SessionIdSchema,
  createdAt: z.string().datetime(),
});

// =============================================================================
// Session Load
// =============================================================================

/**
 * Parameters for the `session/load` method.
 *
 * @example
 * ```json
 * {
 *   "sessionId": "sess_abc123"
 * }
 * ```
 */
export interface SessionLoadRequest {
  /** Session ID to load */
  sessionId: SessionId;
}

export const SessionLoadRequestSchema = z.object({
  sessionId: SessionIdSchema,
});

/**
 * Result of the `session/load` method.
 *
 * @example
 * ```json
 * {
 *   "sessionId": "sess_abc123",
 *   "workingDirectory": "/home/user/project",
 *   "mode": "default",
 *   "configOptions": { "autoApprove": false },
 *   "messageCount": 42
 * }
 * ```
 */
export interface SessionLoadResponse {
  /** Loaded session ID */
  sessionId: SessionId;
  /** Session working directory */
  workingDirectory: string;
  /** Current session mode */
  mode: SessionMode;
  /** Current configuration options */
  configOptions: Record<string, unknown>;
  /** Number of messages in history */
  messageCount: number;
}

export const SessionLoadResponseSchema = z.object({
  sessionId: SessionIdSchema,
  workingDirectory: z.string(),
  mode: SessionModeSchema,
  configOptions: z.record(z.unknown()),
  messageCount: z.number().int().nonnegative(),
});

// =============================================================================
// Session Prompt
// =============================================================================

/**
 * An attachment to include with a prompt.
 */
export interface Attachment {
  /** Attachment filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Base64-encoded content */
  content: string;
}

export const AttachmentSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  content: z.string(),
});

/**
 * Parameters for the `session/prompt` method.
 *
 * @example
 * ```json
 * {
 *   "sessionId": "sess_abc123",
 *   "content": [{ "type": "text", "text": "Hello, agent!" }]
 * }
 * ```
 */
export interface SessionPromptRequest {
  /** Target session ID */
  sessionId: SessionId;
  /** User message content */
  content: ContentBlock[];
  /** File attachments */
  attachments?: Attachment[];
}

export const SessionPromptRequestSchema = z.object({
  sessionId: SessionIdSchema,
  content: z.array(ContentBlockSchema),
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Token usage statistics.
 */
export interface UsageStats {
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
  /** Number of cached input tokens */
  cachedInputTokens?: number;
}

export const UsageStatsSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
});

/**
 * Reasons why generation stopped.
 *
 * @see Section 5.1.5 of the ACP specification
 */
export type StopReason =
  | "end_turn"
  | "cancelled"
  | "max_tokens"
  | "error";

export const StopReasonSchema = z.enum([
  "end_turn",
  "cancelled",
  "max_tokens",
  "error",
]);

/**
 * Result of the `session/prompt` method.
 *
 * @example
 * ```json
 * {
 *   "stopReason": "end_turn",
 *   "usage": { "inputTokens": 350, "outputTokens": 520 }
 * }
 * ```
 */
export interface SessionPromptResponse {
  /** Why generation stopped */
  stopReason: StopReason;
  /** Token usage statistics */
  usage?: UsageStats;
}

export const SessionPromptResponseSchema = z.object({
  stopReason: StopReasonSchema,
  usage: UsageStatsSchema.optional(),
});

// =============================================================================
// Session Cancel
// =============================================================================

/**
 * Parameters for the `session/cancel` notification.
 *
 * @example
 * ```json
 * {
 *   "sessionId": "sess_abc123",
 *   "reason": "user_requested"
 * }
 * ```
 */
export interface SessionCancelParams {
  /** Session to cancel */
  sessionId: SessionId;
  /** Cancellation reason */
  reason?: string;
}

export const SessionCancelParamsSchema = z.object({
  sessionId: SessionIdSchema,
  reason: z.string().optional(),
});

// =============================================================================
// Session Set Mode
// =============================================================================

/**
 * Parameters for the `session/set_mode` method.
 */
export interface SessionSetModeRequest {
  /** Target session ID */
  sessionId: SessionId;
  /** New mode identifier */
  mode: SessionMode;
}

export const SessionSetModeRequestSchema = z.object({
  sessionId: SessionIdSchema,
  mode: SessionModeSchema,
});

/**
 * Result of the `session/set_mode` method.
 */
export interface SessionSetModeResponse {
  /** Mode before change */
  previousMode: SessionMode;
  /** Mode after change */
  currentMode: SessionMode;
}

export const SessionSetModeResponseSchema = z.object({
  previousMode: SessionModeSchema,
  currentMode: SessionModeSchema,
});

// =============================================================================
// Session Set Config Option
// =============================================================================

/**
 * Parameters for the `session/set_config_option` method.
 */
export interface SessionSetConfigOptionRequest {
  /** Target session ID */
  sessionId: SessionId;
  /** Configuration key */
  key: string;
  /** New value */
  value: unknown;
}

export const SessionSetConfigOptionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  key: z.string(),
  value: z.unknown(),
});

/**
 * Result of the `session/set_config_option` method.
 */
export interface SessionSetConfigOptionResponse {
  /** Configuration key */
  key: string;
  /** Value before change */
  previousValue?: unknown;
  /** Value after change */
  currentValue: unknown;
}

export const SessionSetConfigOptionResponseSchema = z.object({
  key: z.string(),
  previousValue: z.unknown().optional(),
  currentValue: z.unknown(),
});
