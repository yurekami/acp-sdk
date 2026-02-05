/**
 * @anthropic/acp-sdk
 * TypeScript SDK for Anthropic Communication Protocol (ACP)
 *
 * This SDK provides both client and agent implementations for the ACP protocol,
 * enabling communication between AI coding assistants and their clients (IDEs, editors, etc).
 *
 * @example Client usage
 * ```typescript
 * import { ACPClient, StdioTransport, createNodeFileSystemHandler } from '@anthropic/acp-sdk';
 *
 * const transport = new StdioTransport({ command: 'claude-agent', args: ['--stdio'] });
 * const client = new ACPClient(transport, {
 *   name: 'My Editor',
 *   version: '1.0.0',
 *   fileSystem: { read: true, write: true }
 * });
 *
 * client.setFileSystemHandler(createNodeFileSystemHandler('/project'));
 * await client.connect();
 * const session = await client.createSession();
 * await session.prompt([{ type: 'text', text: 'Hello!' }]);
 * ```
 *
 * @example Agent usage
 * ```typescript
 * import { ACPAgent, StdioTransport } from '@anthropic/acp-sdk';
 *
 * const transport = new StdioTransport({ mode: 'agent' });
 * const agent = new ACPAgent(transport, {
 *   name: 'My Agent',
 *   version: '1.0.0',
 *   capabilities: { prompt: { streaming: true } }
 * });
 *
 * agent.setPromptHandler({
 *   async handlePrompt(session, content) {
 *     await session.sendAgentMessage('Hello!');
 *     return 'end_turn';
 *   }
 * });
 *
 * await agent.start();
 * ```
 *
 * @module @anthropic/acp-sdk
 */

// =============================================================================
// Protocol Types
// =============================================================================
//
// Complete type definitions for the ACP protocol, including:
// - JSON-RPC 2.0 base types
// - Content blocks (text, image, audio, resources)
// - Tool calls and statuses
// - Session management
// - Permission system
// - File system operations
// - Terminal operations
// - MCP integration
//
export * from "./types/index.js";

// =============================================================================
// Transport Layer
// =============================================================================
//
// Communication layer implementations:
// - StdioTransport: Standard I/O for subprocess communication
// - HttpTransport: HTTP/HTTPS for remote communication
//
export type { Transport, TransportEvents } from "./transport/index.js";
export {
  StdioTransport,
  type StdioTransportOptions,
  HttpTransport,
  type HttpTransportOptions,
} from "./transport/index.js";

// =============================================================================
// Protocol Handling
// =============================================================================
//
// JSON-RPC 2.0 protocol implementation:
// - ProtocolHandler: Message routing and handling
// - Message utilities: parsing, serialization, validation
// - Error classes: All ACP error types
//
export {
  ProtocolHandler,
  type RequestHandler,
  type NotificationHandler,
  generateId,
  resetIdCounter,
  isRequest,
  isResponse,
  isNotification,
  isError,
  parseMessage,
  serializeMessage,
  isValidMessage,
  isValidRequest,
  isValidResponse,
  isValidNotification,
} from "./protocol/index.js";

// Protocol error classes
export {
  ACPError,
  ParseError,
  InvalidRequestError,
  MethodNotFoundError,
  InvalidParamsError,
  InternalError,
  SessionNotFoundError,
  AuthRequiredError,
  PermissionDeniedError,
  OperationCancelledError,
  ResourceNotFoundError,
  ResourceAccessDeniedError,
  InvalidSessionStateError,
  CapabilityNotSupportedError,
  RateLimitedError,
  TimeoutError,
} from "./protocol/index.js";

// =============================================================================
// Client Implementation
// =============================================================================
//
// Client-side ACP implementation for connecting to agents:
// - ACPClient: Main client class
// - Session: Session management and prompting
// - Handler implementations: File system, terminal, permissions
//
export {
  ACPClient,
  Session,
  type ACPClientOptions,
  type ACPClientEvents,
  type SessionEvents,
  type NewSessionOptions,
  type SessionConfigOption,
  type SessionConfigValue,
  type PromptResult,
  type FileSystemHandler,
  type ReadFileResult,
  type WriteFileResult,
  type TerminalHandler,
  type ClientTerminalOptions,
  type TerminalOutput,
  type CreateTerminalResult,
  type PermissionHandler,
  type ClientPermissionOutcome,
  type ConnectedAgentInfo,
} from "./client/index.js";

// Client handler implementations
export {
  createNodeFileSystemHandler,
  createNodeTerminalHandler,
  createConsolePermissionHandler,
  createAutoApproveHandler,
  createAutoDenyHandler,
} from "./client/index.js";

// =============================================================================
// Agent Implementation
// =============================================================================
//
// Server-side ACP implementation for building agents:
// - ACPAgent: Main agent class
// - AgentSession: Session handling
// - ToolCallBuilder: Fluent API for tool calls
// - Terminal: Terminal command execution
//
export {
  ACPAgent,
  AgentSession,
  ToolCallBuilder,
  Terminal,
  type ACPAgentOptions,
  type ACPAgentEvents,
  type PromptHandler,
  type AgentSessionInterface,
  type ToolCallOptions,
  type ToolCallBuilderInterface,
  type DiffHunkData,
  type AgentPermissionOutcome,
  type AgentTerminalOptions,
  type TerminalInterface,
  type TerminalOutputResult,
  type SessionData,
  type ClientData,
  type ToolCallSender,
  type TerminalRequester,
  type SessionRequestHandler,
} from "./agent/index.js";
