/**
 * ACP Client Implementation
 *
 * Client connects to an ACP Agent and sends requests.
 * Used by editors/IDEs to communicate with AI coding assistants.
 *
 * @module @anthropic/acp-sdk/client
 *
 * @example
 * ```typescript
 * import { ACPClient, StdioTransport } from '@anthropic/acp-sdk';
 * import {
 *   createNodeFileSystemHandler,
 *   createNodeTerminalHandler,
 *   createConsolePermissionHandler
 * } from '@anthropic/acp-sdk/client';
 *
 * // Create transport
 * const transport = new StdioTransport({
 *   command: 'claude-agent',
 *   args: ['--stdio']
 * });
 *
 * // Create client
 * const client = new ACPClient(transport, {
 *   name: 'My Editor',
 *   version: '1.0.0',
 *   fileSystem: { read: true, write: true },
 *   terminal: true
 * });
 *
 * // Set up handlers
 * client.setFileSystemHandler(createNodeFileSystemHandler('/home/user/project'));
 * client.setTerminalHandler(createNodeTerminalHandler());
 * client.setPermissionHandler(createConsolePermissionHandler());
 *
 * // Connect and create session
 * await client.connect();
 * const session = await client.createSession({
 *   workingDirectory: '/home/user/project'
 * });
 *
 * // Handle updates
 * session.on('update', (update) => {
 *   if (update.type === 'agent_message_chunk') {
 *     process.stdout.write(update.data.content);
 *   }
 * });
 *
 * // Send prompt
 * await session.prompt([{ type: 'text', text: 'Hello!' }]);
 *
 * // Disconnect when done
 * await client.disconnect();
 * ```
 */

// Main client class
export { ACPClient } from "./ACPClient.js";

// Session class
export { Session } from "./Session.js";

// Types
export type {
  ACPClientOptions,
  ACPClientEvents,
  SessionEvents,
  NewSessionOptions,
  SessionConfigOption,
  SessionConfigValue,
  PromptResult,
  FileSystemHandler,
  ReadFileResult,
  WriteFileResult,
  TerminalHandler,
  ClientTerminalOptions,
  TerminalOutput,
  CreateTerminalResult,
  PermissionHandler,
  ClientPermissionOutcome,
  ConnectedAgentInfo,
} from "./types.js";

// Default handler implementations
export {
  createNodeFileSystemHandler,
  createNodeTerminalHandler,
  createConsolePermissionHandler,
  createAutoApproveHandler,
  createAutoDenyHandler,
} from "./handlers.js";
