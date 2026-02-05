/**
 * ACP Agent Implementation
 *
 * The agent module provides the server-side implementation for the Agent Client Protocol.
 * Use this module to build AI assistants that can receive prompts from ACP clients.
 *
 * @module @anthropic/acp-sdk/agent
 *
 * @example Basic agent setup
 * ```typescript
 * import { ACPAgent, StdioTransport } from '@anthropic/acp-sdk';
 *
 * // Create transport in agent mode
 * const transport = new StdioTransport({ mode: 'agent' });
 *
 * // Create agent
 * const agent = new ACPAgent(transport, {
 *   name: 'My Agent',
 *   version: '1.0.0',
 *   capabilities: {
 *     loadSession: true,
 *     prompt: {
 *       streaming: true,
 *       cancellation: true,
 *       attachments: true
 *     }
 *   }
 * });
 *
 * // Set up prompt handler
 * agent.setPromptHandler({
 *   async handlePrompt(session, content) {
 *     // Process the user's message
 *     for (const block of content) {
 *       if (block.type === 'text') {
 *         await session.sendAgentMessage(`You said: ${block.text}`);
 *       }
 *     }
 *     return 'end_turn';
 *   }
 * });
 *
 * // Start the agent
 * await agent.start();
 * ```
 *
 * @example Using tool calls
 * ```typescript
 * agent.setPromptHandler({
 *   async handlePrompt(session, content) {
 *     // Start a tool call
 *     const builder = session.startToolCall({
 *       tool: 'read_file',
 *       input: { path: '/src/main.ts' },
 *       kind: 'read'
 *     });
 *
 *     // Send initial tool call
 *     await builder.pending().send();
 *
 *     // Execute and report progress
 *     await builder.inProgress().send();
 *     const content = await session.readFile('/src/main.ts');
 *
 *     // Complete with results
 *     await builder.complete().addText(content).send();
 *
 *     return 'end_turn';
 *   }
 * });
 * ```
 *
 * @example Handling permissions
 * ```typescript
 * agent.setPromptHandler({
 *   async handlePrompt(session, content) {
 *     const builder = session.startToolCall({
 *       tool: 'write_file',
 *       input: { path: '/src/main.ts', content: '...' },
 *       kind: 'edit',
 *       requiresPermission: true
 *     });
 *
 *     // Request permission
 *     await builder.awaitingPermission().send();
 *
 *     const toolCall = await builder.send();
 *     const outcome = await session.requestPermission(toolCall, [
 *       { id: 'allow', kind: 'allow_once', label: 'Allow' },
 *       { id: 'deny', kind: 'reject_once', label: 'Deny' }
 *     ]);
 *
 *     if (outcome.granted) {
 *       await builder.inProgress().send();
 *       await session.writeFile('/src/main.ts', '...');
 *       await builder.complete().addText('File written').send();
 *     } else {
 *       await builder.denied().send();
 *     }
 *
 *     return 'end_turn';
 *   }
 * });
 * ```
 *
 * @example Running terminal commands
 * ```typescript
 * agent.setPromptHandler({
 *   async handlePrompt(session, content) {
 *     // Create a terminal
 *     const terminal = await session.createTerminal('npm', ['test'], {
 *       cwd: session.workingDirectory,
 *       timeout: 60000
 *     });
 *
 *     // Wait for completion
 *     const status = await terminal.waitForExit();
 *
 *     // Get output
 *     const result = await terminal.output();
 *
 *     // Report results
 *     if (status.exitCode === 0) {
 *       await session.sendAgentMessage('Tests passed!');
 *     } else {
 *       await session.sendAgentMessage(`Tests failed:\n${result.output}`);
 *     }
 *
 *     // Always release
 *     await terminal.release();
 *
 *     return 'end_turn';
 *   }
 * });
 * ```
 */

// Main classes
export { ACPAgent } from "./ACPAgent.js";
export { AgentSession } from "./AgentSession.js";
export { ToolCallBuilder } from "./ToolCallBuilder.js";
export { Terminal } from "./Terminal.js";

// Types
export type {
  // Agent options and events
  ACPAgentOptions,
  ACPAgentEvents,
  PromptHandler,
  // Session interface
  AgentSessionInterface,
  // Tool call types
  ToolCallOptions,
  ToolCallBuilderInterface,
  DiffHunkData,
  // Permission types
  AgentPermissionOutcome,
  // Terminal types
  AgentTerminalOptions,
  TerminalInterface,
  TerminalOutputResult,
  // Internal types (may be useful for extensions)
  SessionData,
  ClientData,
} from "./types.js";

// Re-export internal interfaces for advanced use
export type { ToolCallSender } from "./ToolCallBuilder.js";
export type { TerminalRequester } from "./Terminal.js";
export type { SessionRequestHandler } from "./AgentSession.js";
