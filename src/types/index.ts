/**
 * ACP Protocol Type Definitions
 *
 * This module exports all type definitions for the Agent Client Protocol (ACP).
 * Types are organized into logical categories:
 *
 * - **jsonrpc**: JSON-RPC 2.0 base types and error codes
 * - **content**: Content block types (text, image, audio, resources)
 * - **toolcall**: Tool call types and statuses
 * - **session**: Session types and update types
 * - **permission**: Permission system types
 * - **filesystem**: File system operation types
 * - **terminal**: Terminal operation types
 * - **mcp**: MCP integration types
 * - **protocol**: Core protocol types (init, auth, session methods)
 *
 * @module @anthropic/acp-sdk/types
 */

// =============================================================================
// JSON-RPC 2.0 Base Types
// =============================================================================

export {
  // Types
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type JsonRpcError,
  type JsonRpcMessage,
  type ErrorCode,
  // Constants
  ErrorCodes,
  // Schemas
  JsonRpcIdSchema,
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcNotificationSchema,
  JsonRpcErrorSchema,
  JsonRpcMessageSchema,
  // Type Guards
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcNotification,
  isJsonRpcError,
} from "./jsonrpc.js";

// =============================================================================
// Content Block Types
// =============================================================================

export {
  // Types
  type TextContent,
  type Base64ImageSource,
  type UrlImageSource,
  type ImageSource,
  type ImageContent,
  type Base64AudioSource,
  type UrlAudioSource,
  type AudioSource,
  type AudioContent,
  type ResourceLink,
  type EmbeddedResource,
  type ContentAnnotations,
  type ContentBlock,
  // Schemas
  TextContentSchema,
  ImageSourceSchema,
  ImageContentSchema,
  AudioSourceSchema,
  AudioContentSchema,
  ResourceLinkSchema,
  EmbeddedResourceSchema,
  ContentAnnotationsSchema,
  ContentBlockSchema,
  // Type Guards
  isTextContent,
  isImageContent,
  isAudioContent,
  isResourceLink,
  isEmbeddedResource,
} from "./content.js";

// =============================================================================
// Tool Call Types
// =============================================================================

export {
  // Types
  type ToolCallId,
  type ToolCallStatus,
  type ToolKind,
  type ToolCallLocation,
  type ToolCallTextContent,
  type DiffHunk,
  type ToolCallDiffContent,
  type ToolCallTerminalContent,
  type ToolCallContent,
  type ToolCall,
  type ToolCallUpdate,
  // Schemas
  ToolCallIdSchema,
  ToolCallStatusSchema,
  ToolKindSchema,
  ToolCallLocationSchema,
  ToolCallTextContentSchema,
  DiffHunkSchema,
  ToolCallDiffContentSchema,
  ToolCallTerminalContentSchema,
  ToolCallContentSchema,
  ToolCallSchema,
  ToolCallUpdateSchema,
  // Type Guards
  isToolCallTextContent,
  isToolCallDiffContent,
  isToolCallTerminalContent,
  isToolCallTerminal,
  isToolCallActive,
} from "./toolcall.js";

// =============================================================================
// Session Types
// =============================================================================

export {
  // Types
  type SessionId,
  type PlanStepStatus,
  type PlanStep,
  type Plan,
  type AgentMessageChunk,
  type UserMessageChunk,
  type ThoughtMessageChunk,
  type AvailableCommand,
  type SessionMode,
  type ModeChangeData,
  type ConfigOptionChangeData,
  type SessionUpdateType,
  type PlanUpdate,
  type AgentMessageChunkUpdate,
  type UserMessageChunkUpdate,
  type ThoughtMessageChunkUpdate,
  type ToolCallSessionUpdate,
  type ToolCallUpdateSessionUpdate,
  type AvailableCommandsUpdate,
  type CurrentModeUpdate,
  type ConfigOptionUpdate,
  type SessionUpdate,
  // Schemas
  SessionIdSchema,
  PlanStepStatusSchema,
  PlanStepSchema,
  PlanSchema,
  AgentMessageChunkSchema,
  UserMessageChunkSchema,
  ThoughtMessageChunkSchema,
  AvailableCommandSchema,
  SessionModeSchema,
  ModeChangeDataSchema,
  ConfigOptionChangeDataSchema,
  SessionUpdateTypeSchema,
  PlanUpdateSchema,
  AgentMessageChunkUpdateSchema,
  UserMessageChunkUpdateSchema,
  ThoughtMessageChunkUpdateSchema,
  ToolCallSessionUpdateSchema,
  ToolCallUpdateSessionUpdateSchema,
  AvailableCommandsUpdateSchema,
  CurrentModeUpdateSchema,
  ConfigOptionUpdateSchema,
  SessionUpdateSchema,
  // Type Guards
  isPlanUpdate,
  isAgentMessageChunkUpdate,
  isUserMessageChunkUpdate,
  isThoughtMessageChunkUpdate,
  isToolCallUpdate,
  isToolCallStatusUpdate,
  isAvailableCommandsUpdate,
  isCurrentModeUpdate,
  isConfigOptionUpdate,
} from "./session.js";

// =============================================================================
// Permission Types
// =============================================================================

export {
  // Types
  type PermissionOperation,
  type PermissionScope,
  type PermissionOptionKind,
  type PermissionOption,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type RequestPermissionOutcome,
  type PermissionEntry,
  type PermissionRule,
  // Schemas
  PermissionOperationSchema,
  PermissionScopeSchema,
  PermissionOptionKindSchema,
  PermissionOptionSchema,
  RequestPermissionRequestSchema,
  RequestPermissionResponseSchema,
  RequestPermissionOutcomeSchema,
  PermissionEntrySchema,
  PermissionRuleSchema,
  // Type Guards
  isPermissionGranted,
  shouldRememberPermission,
  isOutcomeGranted,
  isOutcomeDenied,
} from "./permission.js";

// =============================================================================
// File System Types
// =============================================================================

export {
  // Types
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
  type ListDirectoryRequest,
  type DirectoryEntry,
  type ListDirectoryResponse,
  type DeleteFileRequest,
  type DeleteFileResponse,
  type MoveFileRequest,
  type MoveFileResponse,
  type FileStat,
  type StatFileRequest,
  type StatFileResponse,
  // Schemas
  ReadTextFileRequestSchema,
  ReadTextFileResponseSchema,
  WriteTextFileRequestSchema,
  WriteTextFileResponseSchema,
  ListDirectoryRequestSchema,
  DirectoryEntrySchema,
  ListDirectoryResponseSchema,
  DeleteFileRequestSchema,
  DeleteFileResponseSchema,
  MoveFileRequestSchema,
  MoveFileResponseSchema,
  FileStatSchema,
  StatFileRequestSchema,
  StatFileResponseSchema,
} from "./filesystem.js";

// =============================================================================
// Terminal Types
// =============================================================================

export {
  // Types
  type TerminalId,
  type EnvVariable,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type TerminalOutputStream,
  type TerminalOutputRequest,
  type TerminalOutputResponse,
  type WaitForExitRequest,
  type WaitForExitResponse,
  type TerminalSignal,
  type KillTerminalRequest,
  type KillTerminalResponse,
  type ReleaseTerminalRequest,
  type ReleaseTerminalResponse,
  type TerminalExitStatus,
  type TerminalInfo,
  // Schemas
  TerminalIdSchema,
  EnvVariableSchema,
  CreateTerminalRequestSchema,
  CreateTerminalResponseSchema,
  TerminalOutputStreamSchema,
  TerminalOutputRequestSchema,
  TerminalOutputResponseSchema,
  WaitForExitRequestSchema,
  WaitForExitResponseSchema,
  TerminalSignalSchema,
  KillTerminalRequestSchema,
  KillTerminalResponseSchema,
  ReleaseTerminalRequestSchema,
  ReleaseTerminalResponseSchema,
  TerminalExitStatusSchema,
  TerminalInfoSchema,
  // Type Guards
  isTerminalSuccess,
  isTerminalRunning,
  wasTerminalKilled,
  didTerminalTimeout,
} from "./terminal.js";

// =============================================================================
// MCP Integration Types
// =============================================================================

export {
  // Types
  type HttpHeader,
  type McpStdioTransport,
  type McpHttpTransport,
  type McpSseTransport,
  type McpAcpTransport,
  type McpTransport,
  type McpServer,
  type McpCapabilities,
  type AgentMcpCapabilities,
  type McpToolInfo,
  type McpResourceInfo,
  type McpServerStatus,
  type McpServerInfo,
  // Schemas
  HttpHeaderSchema,
  McpStdioTransportSchema,
  McpHttpTransportSchema,
  McpSseTransportSchema,
  McpAcpTransportSchema,
  McpTransportSchema,
  McpServerSchema,
  McpCapabilitiesSchema,
  AgentMcpCapabilitiesSchema,
  McpToolInfoSchema,
  McpResourceInfoSchema,
  McpServerStatusSchema,
  McpServerInfoSchema,
  // Type Guards
  isStdioTransport,
  isHttpTransport,
  isSseTransport,
  isAcpTransport,
  isMcpServerConnected,
} from "./mcp.js";

// =============================================================================
// Protocol Types
// =============================================================================

export {
  // Types
  type ClientInfo,
  type AgentInfo,
  type ClientFsCapabilities,
  type ClientTerminalCapabilities,
  type ClientUiCapabilities,
  type ClientCapabilities,
  type AgentPromptCapabilities,
  type AgentSessionCapabilities,
  type AgentCapabilities,
  type InitializeRequest,
  type InitializeResponse,
  type AuthenticateRequest,
  type AuthenticateResponse,
  type SessionNewRequest,
  type SessionNewResponse,
  type SessionLoadRequest,
  type SessionLoadResponse,
  type Attachment,
  type UsageStats,
  type StopReason,
  type SessionPromptRequest,
  type SessionPromptResponse,
  type SessionCancelParams,
  type SessionSetModeRequest,
  type SessionSetModeResponse,
  type SessionSetConfigOptionRequest,
  type SessionSetConfigOptionResponse,
  // Schemas
  ClientInfoSchema,
  AgentInfoSchema,
  ClientFsCapabilitiesSchema,
  ClientTerminalCapabilitiesSchema,
  ClientUiCapabilitiesSchema,
  ClientCapabilitiesSchema,
  AgentPromptCapabilitiesSchema,
  AgentSessionCapabilitiesSchema,
  AgentCapabilitiesSchema,
  InitializeRequestSchema,
  InitializeResponseSchema,
  AuthenticateRequestSchema,
  AuthenticateResponseSchema,
  SessionNewRequestSchema,
  SessionNewResponseSchema,
  SessionLoadRequestSchema,
  SessionLoadResponseSchema,
  AttachmentSchema,
  UsageStatsSchema,
  StopReasonSchema,
  SessionPromptRequestSchema,
  SessionPromptResponseSchema,
  SessionCancelParamsSchema,
  SessionSetModeRequestSchema,
  SessionSetModeResponseSchema,
  SessionSetConfigOptionRequestSchema,
  SessionSetConfigOptionResponseSchema,
} from "./protocol.js";
