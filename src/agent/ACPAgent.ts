/**
 * ACP Agent
 *
 * Main agent class that handles communication with ACP clients.
 * Processes JSON-RPC requests and manages sessions.
 *
 * @module @anthropic/acp-sdk/agent/ACPAgent
 */

import { EventEmitter } from "eventemitter3";
import type { Transport } from "../transport/types.js";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  SessionId,
  SessionUpdate,
  PermissionOption,
  SessionMode,
  TerminalExitStatus,
  TerminalSignal,
  ToolCallId,
  StopReason,
  InitializeRequest,
  InitializeResponse,
  SessionNewRequest,
  SessionNewResponse,
  SessionLoadRequest,
  SessionLoadResponse,
  SessionPromptRequest,
  SessionPromptResponse,
  SessionCancelParams,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "../types/index.js";
import {
  ErrorCodes,
  isJsonRpcRequest,
  isJsonRpcNotification,
} from "../types/jsonrpc.js";
import type {
  ACPAgentOptions,
  ACPAgentEvents,
  PromptHandler,
  AgentPermissionOutcome,
  SessionData,
  ClientData,
} from "./types.js";
import { AgentSession, type SessionRequestHandler } from "./AgentSession.js";

/**
 * ACP Agent for handling client connections and processing prompts.
 *
 * The agent:
 * - Handles the initialization handshake with clients
 * - Creates and manages sessions
 * - Routes prompts to the configured handler
 * - Provides access to client capabilities (file system, terminal, etc.)
 *
 * @example
 * ```typescript
 * import { ACPAgent, StdioTransport } from '@anthropic/acp-sdk';
 *
 * const transport = new StdioTransport({ mode: 'agent' });
 * const agent = new ACPAgent(transport, {
 *   name: 'My Agent',
 *   version: '1.0.0',
 *   capabilities: {
 *     loadSession: true,
 *     prompt: { streaming: true, cancellation: true }
 *   }
 * });
 *
 * agent.setPromptHandler({
 *   async handlePrompt(session, content) {
 *     await session.sendAgentMessage('Hello! I received your message.');
 *     return 'end_turn';
 *   }
 * });
 *
 * agent.on('sessionCreated', (session) => {
 *   console.log('New session:', session.id);
 * });
 *
 * await agent.start();
 * ```
 */
export class ACPAgent implements SessionRequestHandler {
  private transport: Transport;
  private options: ACPAgentOptions;
  private emitter = new EventEmitter<ACPAgentEvents>();

  private sessions = new Map<SessionId, AgentSession>();
  private _clientData: ClientData | null = null;
  private promptHandler: PromptHandler | null = null;
  private requestIdCounter = 0;
  private pendingRequests = new Map<
    number | string,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  private initialized = false;
  private running = false;

  /**
   * Create a new ACPAgent.
   *
   * @param transport - Transport for communicating with the client
   * @param options - Agent configuration options
   */
  constructor(transport: Transport, options: ACPAgentOptions) {
    this.transport = transport;
    this.options = options;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the agent and begin listening for connections.
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Set up message handler
    this.transport.on("message", this.handleMessage.bind(this));
    this.transport.on("error", this.handleTransportError.bind(this));
    this.transport.on("close", this.handleTransportClose.bind(this));

    // Start the transport
    await this.transport.start();

    this.running = true;
    this.emitter.emit("started");
  }

  /**
   * Stop the agent gracefully.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Clear all sessions
    for (const session of this.sessions.values()) {
      session.markCancelled();
    }
    this.sessions.clear();

    // Reject pending requests
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error("Agent stopped"));
    }
    this.pendingRequests.clear();

    // Close transport
    await this.transport.close();

    this.emitter.emit("stopped");
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set the prompt handler for processing incoming prompts.
   *
   * @param handler - Handler to process prompts
   */
  setPromptHandler(handler: PromptHandler): void {
    this.promptHandler = handler;
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Register an event handler.
   */
  on<K extends keyof ACPAgentEvents>(event: K, handler: ACPAgentEvents[K]): void {
    this.emitter.on(event, handler as any);
  }

  /**
   * Unregister an event handler.
   */
  off<K extends keyof ACPAgentEvents>(event: K, handler: ACPAgentEvents[K]): void {
    this.emitter.off(event, handler as any);
  }

  // ===========================================================================
  // Session Access
  // ===========================================================================

  /**
   * Get a session by ID.
   *
   * @param sessionId - The session ID to look up
   * @returns The session or undefined if not found
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions.
   *
   * @returns Array of all active sessions
   */
  getSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  private handleMessage(
    message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification
  ): void {
    if (isJsonRpcRequest(message)) {
      this.handleRequest(message).catch((error) => {
        this.emitter.emit("error", error);
      });
    } else if (isJsonRpcNotification(message)) {
      this.handleNotification(message).catch((error) => {
        this.emitter.emit("error", error);
      });
    } else {
      // It's a response to one of our requests
      this.handleResponse(message);
    }
  }

  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    try {
      const result = await this.processRequest(request);
      await this.sendResponse(request.id, result);
    } catch (error) {
      await this.sendErrorResponse(
        request.id,
        error instanceof Error ? error.message : String(error),
        ErrorCodes.InternalError
      );
    }
  }

  private async processRequest(request: JsonRpcRequest): Promise<unknown> {
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(request.params as InitializeRequest);

      case "session/new":
        return this.handleSessionNew(request.params as SessionNewRequest);

      case "session/load":
        return this.handleSessionLoad(request.params as SessionLoadRequest);

      case "session/prompt":
        return this.handleSessionPrompt(request.params as SessionPromptRequest);

      default:
        throw new Error(`Method not found: ${request.method}`);
    }
  }

  private async handleNotification(
    notification: JsonRpcNotification
  ): Promise<void> {
    switch (notification.method) {
      case "session/cancel":
        await this.handleSessionCancel(
          notification.params as SessionCancelParams
        );
        break;

      default:
        // Unknown notification - ignore
        break;
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    if (response.id === null) {
      return;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  // ===========================================================================
  // Protocol Handlers
  // ===========================================================================

  /**
   * Get the client data after initialization.
   */
  get clientData(): ClientData | null {
    return this._clientData;
  }

  private async handleInitialize(
    params: InitializeRequest
  ): Promise<InitializeResponse> {
    // Store client information
    this._clientData = {
      name: params.clientInfo.name,
      version: params.clientInfo.version,
      capabilities: params.capabilities,
    };

    this.initialized = true;

    const capabilities: InitializeResponse["capabilities"] = {};

    if (this.options.capabilities?.loadSession !== undefined) {
      capabilities.loadSession = this.options.capabilities.loadSession;
    }

    if (this.options.capabilities?.mcp) {
      capabilities.mcpCapabilities = {
        servers: true,
        transport: ["stdio", "http", "sse"],
      };
    }

    if (this.options.capabilities?.prompt) {
      capabilities.promptCapabilities = this.options.capabilities.prompt;
    }

    if (this.options.capabilities?.session) {
      capabilities.sessionCapabilities = this.options.capabilities.session;
    }

    return {
      protocolVersion: params.protocolVersion,
      agentInfo: {
        name: this.options.name,
        version: this.options.version,
      },
      capabilities,
    };
  }

  private async handleSessionNew(
    params: SessionNewRequest
  ): Promise<SessionNewResponse> {
    this.ensureInitialized();

    const sessionId = this.generateSessionId();
    const createdAt = new Date().toISOString();

    const sessionData: SessionData = {
      id: sessionId,
      workingDirectory: params.workingDirectory,
      mcpServers: params.mcpServers ?? [],
      configOptions: params.configOptions ?? {},
      createdAt,
      cancelled: false,
      messageCount: 0,
    };

    if (params.systemPrompt !== undefined) {
      sessionData.systemPrompt = params.systemPrompt;
    }

    if (params.initialMode !== undefined) {
      sessionData.currentMode = params.initialMode;
    }

    const session = new AgentSession(this, sessionData);
    this.sessions.set(sessionId, session);

    this.emitter.emit("sessionCreated", session);

    return {
      sessionId,
      createdAt,
    };
  }

  private async handleSessionLoad(
    params: SessionLoadRequest
  ): Promise<SessionLoadResponse> {
    this.ensureInitialized();

    // Check if session exists (in a real implementation, load from storage)
    const existingSession = this.sessions.get(params.sessionId);
    if (!existingSession) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }

    const data = existingSession.getData();

    this.emitter.emit("sessionLoaded", existingSession);

    return {
      sessionId: params.sessionId,
      workingDirectory: data.workingDirectory,
      mode: data.currentMode ?? "default",
      configOptions: data.configOptions,
      messageCount: data.messageCount,
    };
  }

  private async handleSessionPrompt(
    params: SessionPromptRequest
  ): Promise<SessionPromptResponse> {
    this.ensureInitialized();

    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }

    if (!this.promptHandler) {
      throw new Error("No prompt handler configured");
    }

    // Emit prompt event
    this.emitter.emit("prompt", session, params.content);

    // Process the prompt
    let stopReason: StopReason;
    try {
      stopReason = await this.promptHandler.handlePrompt(session, params.content);
    } catch (error) {
      if (session.isCancelled) {
        stopReason = "cancelled";
      } else {
        stopReason = "error";
      }
    }

    // Update message count
    session.updateData({
      messageCount: session.getData().messageCount + 1,
    });

    return {
      stopReason,
      // Usage would be tracked and returned here in a real implementation
    };
  }

  private async handleSessionCancel(params: SessionCancelParams): Promise<void> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      return;
    }

    session.markCancelled();
    this.emitter.emit("cancelled", session);
  }

  // ===========================================================================
  // SessionRequestHandler Implementation
  // ===========================================================================

  /**
   * Send a session update notification to the client.
   */
  async sendSessionUpdate(
    _sessionId: SessionId,
    update: SessionUpdate
  ): Promise<void> {
    await this.transport.notify({
      jsonrpc: "2.0",
      method: "session/update",
      params: update,
    });
  }

  /**
   * Request permission from the client.
   */
  async requestPermission(
    _sessionId: SessionId,
    operation: string,
    resource: string,
    toolCallId: ToolCallId,
    options: PermissionOption[],
    reason?: string
  ): Promise<AgentPermissionOutcome> {
    const request: RequestPermissionRequest = {
      sessionId: _sessionId,
      operation,
      resource,
      toolCallId,
      options,
    };

    if (reason !== undefined) {
      request.reason = reason;
    }

    const response = await this.sendRequest<RequestPermissionResponse>(
      "session/request_permission",
      request
    );

    let outcome: AgentPermissionOutcome["outcome"];
    if (response.granted) {
      outcome = response.remember ? "granted_always" : "granted";
    } else {
      outcome = response.remember ? "denied_always" : "denied";
    }

    const result: AgentPermissionOutcome = {
      outcome,
      granted: response.granted,
      remember: response.remember ?? false,
    };

    if (response.scope !== undefined) {
      result.scope = response.scope;
    }
    if (response.selectedOptionId !== undefined) {
      result.selectedOptionId = response.selectedOptionId;
    }
    if (response.reason !== undefined) {
      result.reason = response.reason;
    }

    return result;
  }

  /**
   * Read a file from the client.
   */
  async readFile(
    path: string,
    startLine?: number,
    endLine?: number
  ): Promise<string> {
    const response = await this.sendRequest<{ content: string }>(
      "fs/read_text_file",
      { path, startLine, endLine }
    );
    return response.content;
  }

  /**
   * Write a file to the client.
   */
  async writeFile(path: string, content: string): Promise<void> {
    await this.sendRequest("fs/write_text_file", { path, content });
  }

  /**
   * Create a terminal on the client.
   */
  async createTerminal(
    command: string,
    args?: string[],
    cwd?: string,
    env?: Record<string, string>,
    timeout?: number
  ): Promise<string> {
    const response = await this.sendRequest<{ terminalId: string }>(
      "terminal/create",
      { command, args, cwd, env, timeout }
    );
    return response.terminalId;
  }

  /**
   * Get terminal output from the client.
   */
  async getTerminalOutput(terminalId: string): Promise<{
    output: string;
    truncated: boolean;
    exitStatus?: TerminalExitStatus;
  }> {
    return this.sendRequest("terminal/output", { terminalId });
  }

  /**
   * Wait for terminal to exit.
   */
  async waitForTerminalExit(
    terminalId: string,
    timeout?: number
  ): Promise<TerminalExitStatus> {
    const response = await this.sendRequest<{
      exitCode: number | null;
      signal?: string;
      timedOut?: boolean;
    }>("terminal/wait_for_exit", { terminalId, timeout });

    const result: TerminalExitStatus = {
      exitCode: response.exitCode,
    };

    if (response.signal !== undefined) {
      result.signal = response.signal;
    }
    if (response.timedOut !== undefined) {
      result.timedOut = response.timedOut;
    }

    return result;
  }

  /**
   * Kill a terminal.
   */
  async killTerminal(
    terminalId: string,
    signal?: TerminalSignal
  ): Promise<boolean> {
    const response = await this.sendRequest<{ killed: boolean }>(
      "terminal/kill",
      { terminalId, signal }
    );
    return response.killed;
  }

  /**
   * Release a terminal.
   */
  async releaseTerminal(terminalId: string): Promise<boolean> {
    const response = await this.sendRequest<{ released: boolean }>(
      "terminal/release",
      { terminalId }
    );
    return response.released;
  }

  /**
   * Set session mode.
   */
  async setSessionMode(
    sessionId: SessionId,
    mode: SessionMode
  ): Promise<{ previousMode: SessionMode; currentMode: SessionMode }> {
    return this.sendRequest("session/set_mode", { sessionId, mode });
  }

  // ===========================================================================
  // Internal Helpers
  // ===========================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Agent not initialized");
    }
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async sendRequest<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.requestIdCounter;

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      });

      this.transport.request(request).then(
        (response) => {
          const pending = this.pendingRequests.get(id);
          if (pending) {
            this.pendingRequests.delete(id);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        },
        (error) => {
          const pending = this.pendingRequests.get(id);
          if (pending) {
            this.pendingRequests.delete(id);
            pending.reject(error);
          }
        }
      );
    });
  }

  private async sendResponse(
    id: number | string,
    result: unknown
  ): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      result,
    };

    // Use notify since we're sending a response, not expecting one back
    await this.transport.notify(response as unknown as JsonRpcNotification);
  }

  private async sendErrorResponse(
    id: number | string,
    message: string,
    code: number
  ): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };

    await this.transport.notify(response as unknown as JsonRpcNotification);
  }

  private handleTransportError(error: Error): void {
    this.emitter.emit("error", error);
  }

  private handleTransportClose(): void {
    // Mark all sessions as cancelled
    for (const session of this.sessions.values()) {
      session.markCancelled();
    }
  }
}
