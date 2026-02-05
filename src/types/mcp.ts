/**
 * MCP Integration Types
 *
 * Types for Model Context Protocol (MCP) server configuration and integration.
 * ACP provides first-class integration with MCP.
 *
 * @see Section 11 of the ACP specification
 */

import { z } from "zod";

// =============================================================================
// HTTP Header
// =============================================================================

/**
 * An HTTP header key-value pair.
 */
export interface HttpHeader {
  /** Header name */
  name: string;
  /** Header value */
  value: string;
}

export const HttpHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

// =============================================================================
// MCP Transport Types
// =============================================================================

/**
 * stdio transport configuration.
 * Runs the MCP server as a subprocess communicating via stdin/stdout.
 *
 * @example
 * ```json
 * {
 *   "type": "stdio",
 *   "command": "mcp-server-filesystem",
 *   "args": ["--root", "/home/user"],
 *   "env": { "DEBUG": "1" },
 *   "cwd": "/home/user"
 * }
 * ```
 */
export interface McpStdioTransport {
  /** Transport type identifier */
  type: "stdio";
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

export const McpStdioTransportSchema = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

/**
 * HTTP transport configuration.
 * Connects to an MCP server over HTTP/HTTPS.
 *
 * @example
 * ```json
 * {
 *   "type": "http",
 *   "url": "https://api.example.com/mcp",
 *   "headers": {
 *     "Authorization": "Bearer token"
 *   },
 *   "timeout": 30000
 * }
 * ```
 */
export interface McpHttpTransport {
  /** Transport type identifier */
  type: "http";
  /** MCP server URL */
  url: string;
  /** HTTP headers to include in requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export const McpHttpTransportSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * SSE (Server-Sent Events) transport configuration.
 * Connects to an MCP server using Server-Sent Events for streaming.
 *
 * @example
 * ```json
 * {
 *   "type": "sse",
 *   "url": "https://api.example.com/mcp/events",
 *   "headers": {
 *     "Authorization": "Bearer token"
 *   }
 * }
 * ```
 */
export interface McpSseTransport {
  /** Transport type identifier */
  type: "sse";
  /** SSE endpoint URL */
  url: string;
  /** HTTP headers to include */
  headers?: Record<string, string>;
}

export const McpSseTransportSchema = z.object({
  type: z.literal("sse"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

/**
 * ACP transport configuration (MCP-over-ACP).
 * Routes MCP traffic through an ACP connection.
 * This is a proposed future feature.
 *
 * @example
 * ```json
 * {
 *   "type": "acp",
 *   "agentUrl": "acp://trusted-agent.example.com",
 *   "mcpServerName": "internal-tool"
 * }
 * ```
 */
export interface McpAcpTransport {
  /** Transport type identifier */
  type: "acp";
  /** URL of the ACP agent to connect through */
  agentUrl: string;
  /** Name of the MCP server to access via the agent */
  mcpServerName: string;
}

export const McpAcpTransportSchema = z.object({
  type: z.literal("acp"),
  agentUrl: z.string(),
  mcpServerName: z.string(),
});

/**
 * Union type for all MCP transport configurations.
 */
export type McpTransport =
  | McpStdioTransport
  | McpHttpTransport
  | McpSseTransport
  | McpAcpTransport;

export const McpTransportSchema = z.discriminatedUnion("type", [
  McpStdioTransportSchema,
  McpHttpTransportSchema,
  McpSseTransportSchema,
  McpAcpTransportSchema,
]);

// =============================================================================
// MCP Server Configuration
// =============================================================================

/**
 * Configuration for an MCP server to connect.
 *
 * @example
 * ```json
 * {
 *   "name": "filesystem",
 *   "transport": {
 *     "type": "stdio",
 *     "command": "mcp-server-filesystem",
 *     "args": ["/home/user/project"]
 *   },
 *   "capabilities": {
 *     "tools": true,
 *     "resources": true
 *   }
 * }
 * ```
 */
export interface McpServer {
  /** Unique name for this MCP server configuration */
  name: string;
  /** Transport configuration */
  transport: McpTransport;
  /** Expected capabilities (optional, for validation) */
  capabilities?: McpCapabilities;
  /** Whether to auto-connect when session starts */
  autoConnect?: boolean;
  /** Description of what this MCP server provides */
  description?: string;
}

export const McpServerSchema = z.object({
  name: z.string(),
  transport: McpTransportSchema,
  capabilities: z
    .object({
      tools: z.boolean().optional(),
      resources: z.boolean().optional(),
      prompts: z.boolean().optional(),
      sampling: z.boolean().optional(),
    })
    .optional(),
  autoConnect: z.boolean().optional(),
  description: z.string().optional(),
});

// =============================================================================
// MCP Capabilities
// =============================================================================

/**
 * Capabilities that an MCP server may provide.
 */
export interface McpCapabilities {
  /** Server provides tools */
  tools?: boolean;
  /** Server provides resources */
  resources?: boolean;
  /** Server provides prompts */
  prompts?: boolean;
  /** Server supports sampling */
  sampling?: boolean;
}

export const McpCapabilitiesSchema = z.object({
  tools: z.boolean().optional(),
  resources: z.boolean().optional(),
  prompts: z.boolean().optional(),
  sampling: z.boolean().optional(),
});

// =============================================================================
// MCP Agent Capabilities (for ACP capability negotiation)
// =============================================================================

/**
 * MCP-related capabilities that an ACP agent supports.
 * Declared in the agent's capabilities during initialization.
 */
export interface AgentMcpCapabilities {
  /** Agent can connect to MCP servers */
  servers: boolean;
  /** Supported MCP transport types */
  transport: Array<"stdio" | "http" | "sse" | "acp">;
}

export const AgentMcpCapabilitiesSchema = z.object({
  servers: z.boolean(),
  transport: z.array(z.enum(["stdio", "http", "sse", "acp"])),
});

// =============================================================================
// MCP Tool Information
// =============================================================================

/**
 * Information about an MCP tool.
 */
export interface McpToolInfo {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** JSON Schema for the tool's input */
  inputSchema?: Record<string, unknown>;
  /** MCP server that provides this tool */
  serverName: string;
}

export const McpToolInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  serverName: z.string(),
});

/**
 * Information about an MCP resource.
 */
export interface McpResourceInfo {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name?: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
  /** MCP server that provides this resource */
  serverName: string;
}

export const McpResourceInfoSchema = z.object({
  uri: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  serverName: z.string(),
});

// =============================================================================
// MCP Server Status
// =============================================================================

/**
 * Status of an MCP server connection.
 */
export type McpServerStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export const McpServerStatusSchema = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "error",
]);

/**
 * Information about a connected MCP server.
 */
export interface McpServerInfo {
  /** Server name */
  name: string;
  /** Connection status */
  status: McpServerStatus;
  /** Server capabilities (once connected) */
  capabilities?: McpCapabilities;
  /** Available tools (once connected) */
  tools?: McpToolInfo[];
  /** Available resources (once connected) */
  resources?: McpResourceInfo[];
  /** Error message (if status is "error") */
  error?: string;
}

export const McpServerInfoSchema = z.object({
  name: z.string(),
  status: McpServerStatusSchema,
  capabilities: McpCapabilitiesSchema.optional(),
  tools: z.array(McpToolInfoSchema).optional(),
  resources: z.array(McpResourceInfoSchema).optional(),
  error: z.string().optional(),
});

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for stdio transport.
 */
export function isStdioTransport(
  transport: McpTransport
): transport is McpStdioTransport {
  return transport.type === "stdio";
}

/**
 * Type guard for HTTP transport.
 */
export function isHttpTransport(
  transport: McpTransport
): transport is McpHttpTransport {
  return transport.type === "http";
}

/**
 * Type guard for SSE transport.
 */
export function isSseTransport(
  transport: McpTransport
): transport is McpSseTransport {
  return transport.type === "sse";
}

/**
 * Type guard for ACP transport.
 */
export function isAcpTransport(
  transport: McpTransport
): transport is McpAcpTransport {
  return transport.type === "acp";
}

/**
 * Check if an MCP server is connected.
 */
export function isMcpServerConnected(info: McpServerInfo): boolean {
  return info.status === "connected";
}
