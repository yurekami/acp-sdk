/**
 * ACP Client
 *
 * Main client class for connecting to and communicating with ACP agents.
 * Used by editors/IDEs to interact with AI coding assistants.
 *
 * @module @anthropic/acp-sdk/client/ACPClient
 */

import { EventEmitter } from "eventemitter3";
import type { Transport } from "../transport/types.js";
import { Session } from "./Session.js";
import type {
  ACPClientOptions,
  ACPClientEvents,
  NewSessionOptions,
  FileSystemHandler,
  TerminalHandler,
  PermissionHandler,
  ConnectedAgentInfo,
} from "./types.js";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  InitializeResponse,
  SessionNewResponse,
  SessionLoadResponse,
  SessionUpdate,
  ReadTextFileRequest,
  WriteTextFileRequest,
  CreateTerminalRequest,
  TerminalOutputRequest,
  WaitForExitRequest,
  KillTerminalRequest,
  ReleaseTerminalRequest,
  RequestPermissionRequest,
  ToolCall,
} from "../types/index.js";
import {
  ErrorCodes,
  SessionUpdateSchema,
  isJsonRpcRequest,
  isJsonRpcNotification,
} from "../types/index.js";

/**
 * Protocol version supported by this client.
 */
const PROTOCOL_VERSION = 1;

/**
 * Default request timeout in milliseconds.
 */
const DEFAULT_REQUEST_TIMEOUT = 30000;

/**
 * ACP Client for connecting to AI agents.
 *
 * @example
 * ```typescript
 * import { ACPClient, StdioTransport } from '@anthropic/acp-sdk';
 *
 * const transport = new StdioTransport({
 *   command: 'claude-agent',
 *   args: ['--stdio']
 * });
 *
 * const client = new ACPClient(transport, {
 *   name: 'My Editor',
 *   version: '1.0.0',
 *   fileSystem: { read: true, write: true },
 *   terminal: true
 * });
 *
 * await client.connect();
 *
 * const session = await client.createSession({
 *   workingDirectory: '/home/user/project'
 * });
 *
 * session.on('update', (update) => {
 *   console.log('Update:', update);
 * });
 *
 * await session.prompt([{ type: 'text', text: 'Hello!' }]);
 * ```
 */
export class ACPClient {
  /** Transport layer for communication */
  private readonly transport: Transport;

  /** Client options */
  private readonly options: ACPClientOptions;

  /** Event emitter for client events */
  private readonly emitter = new EventEmitter<ACPClientEvents>();

  /** Active sessions by ID */
  private readonly sessions = new Map<string, Session>();

  /** Request timeout */
  private readonly requestTimeout: number;

  /** Pending request trackers */
  private readonly pendingRequests = new Map<
    string | number,
    {
      resolve: (response: JsonRpcResponse) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  /** Next request ID */
  private nextRequestId = 1;

  /** Connected agent info */
  private _agentInfo: ConnectedAgentInfo | undefined;

  /** Whether client is connected */
  private _connected = false;

  /** File system handler */
  private fileSystemHandler: FileSystemHandler | undefined;

  /** Terminal handler */
  private terminalHandler: TerminalHandler | undefined;

  /** Permission handler */
  private permissionHandler: PermissionHandler | undefined;

  /**
   * Creates a new ACP client.
   *
   * @param transport - Transport layer for communication
   * @param options - Client options
   */
  constructor(transport: Transport, options: ACPClientOptions) {
    this.transport = transport;
    this.options = options;
    this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;

    // Set up transport event handlers
    this.setupTransportHandlers();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Connect to the agent and initialize the protocol.
   *
   * @throws Error if connection or initialization fails
   *
   * @example
   * ```typescript
   * await client.connect();
   * console.log('Connected to:', client.agentInfo?.name);
   * ```
   */
  async connect(): Promise<void> {
    if (this._connected) {
      throw new Error("Client is already connected");
    }

    // Start transport
    await this.transport.start();

    // Send initialize request
    const initResponse = await this.sendRequest<InitializeResponse>(
      "initialize",
      {
        protocolVersion: PROTOCOL_VERSION,
        clientInfo: {
          name: this.options.name,
          version: this.options.version,
        },
        capabilities: {
          fs: this.options.fileSystem,
          terminal: this.options.terminal
            ? { create: true }
            : undefined,
        },
      }
    );

    // Store agent info
    this._agentInfo = {
      name: initResponse.agentInfo.name,
      version: initResponse.agentInfo.version,
      protocolVersion: initResponse.protocolVersion,
      capabilities: initResponse.capabilities,
    };

    this._connected = true;
    this.emitter.emit("connected");
  }

  /**
   * Disconnect from the agent.
   *
   * @example
   * ```typescript
   * await client.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    if (!this._connected) {
      return;
    }

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Client disconnected"));
      this.pendingRequests.delete(id);
    }

    // Deactivate all sessions
    for (const session of this.sessions.values()) {
      session.deactivate();
    }
    this.sessions.clear();

    // Close transport
    await this.transport.close();

    this._connected = false;
    this._agentInfo = undefined;
    this.emitter.emit("disconnected");
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Create a new session.
   *
   * @param options - Session options
   * @returns New session instance
   * @throws Error if session creation fails
   *
   * @example
   * ```typescript
   * const session = await client.createSession({
   *   workingDirectory: '/home/user/project',
   *   initialMode: 'code'
   * });
   * ```
   */
  async createSession(options: NewSessionOptions): Promise<Session> {
    this.ensureConnected();

    const response = await this.sendRequest<SessionNewResponse>("session/new", {
      workingDirectory: options.workingDirectory,
      systemPrompt: options.systemPrompt,
      initialMode: options.initialMode,
      configOptions: options.configOptions,
    });

    const session = new Session(
      response.sessionId,
      this,
      options.initialMode
    );

    // Set available modes from agent capabilities
    if (this._agentInfo?.capabilities.sessionCapabilities?.modes) {
      session.setAvailableModes(
        this._agentInfo.capabilities.sessionCapabilities.modes
      );
    }

    this.sessions.set(response.sessionId, session);
    return session;
  }

  /**
   * Load an existing session.
   *
   * @param sessionId - Session ID to load
   * @returns Loaded session instance
   * @throws Error if session loading fails
   *
   * @example
   * ```typescript
   * const session = await client.loadSession('sess_abc123');
   * ```
   */
  async loadSession(sessionId: string): Promise<Session> {
    this.ensureConnected();

    if (!this._agentInfo?.capabilities.loadSession) {
      throw new Error("Agent does not support loading sessions");
    }

    const response = await this.sendRequest<SessionLoadResponse>(
      "session/load",
      { sessionId }
    );

    const session = new Session(response.sessionId, this, response.mode);

    // Set available modes from agent capabilities
    if (this._agentInfo?.capabilities.sessionCapabilities?.modes) {
      session.setAvailableModes(
        this._agentInfo.capabilities.sessionCapabilities.modes
      );
    }

    this.sessions.set(response.sessionId, session);
    return session;
  }

  /**
   * Get an active session by ID.
   *
   * @param sessionId - Session ID
   * @returns Session instance or undefined
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Register an event handler.
   *
   * @param event - Event name
   * @param handler - Event handler function
   *
   * @example
   * ```typescript
   * client.on('update', (sessionId, update) => {
   *   console.log(`Session ${sessionId}:`, update.type);
   * });
   *
   * client.on('error', (error) => {
   *   console.error('Client error:', error);
   * });
   * ```
   */
  on<K extends keyof ACPClientEvents>(
    event: K,
    handler: ACPClientEvents[K]
  ): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Unregister an event handler.
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off<K extends keyof ACPClientEvents>(
    event: K,
    handler: ACPClientEvents[K]
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  // ===========================================================================
  // Handler Registration
  // ===========================================================================

  /**
   * Set the file system handler for agent file operations.
   *
   * @param handler - File system handler implementation
   *
   * @example
   * ```typescript
   * client.setFileSystemHandler({
   *   async readTextFile(path, startLine, endLine) {
   *     const content = await fs.readFile(path, 'utf-8');
   *     return { content, encoding: 'utf-8' };
   *   },
   *   async writeTextFile(path, content) {
   *     await fs.writeFile(path, content, 'utf-8');
   *     return { bytesWritten: Buffer.byteLength(content), created: true };
   *   }
   * });
   * ```
   */
  setFileSystemHandler(handler: FileSystemHandler): void {
    this.fileSystemHandler = handler;
  }

  /**
   * Set the terminal handler for agent terminal operations.
   *
   * @param handler - Terminal handler implementation
   */
  setTerminalHandler(handler: TerminalHandler): void {
    this.terminalHandler = handler;
  }

  /**
   * Set the permission handler for permission requests.
   *
   * @param handler - Permission handler implementation
   *
   * @example
   * ```typescript
   * client.setPermissionHandler({
   *   async requestPermission(toolCall, options) {
   *     // Show permission dialog to user
   *     const userChoice = await showDialog(toolCall, options);
   *     return {
   *       granted: userChoice.allowed,
   *       remember: userChoice.remember,
   *       scope: userChoice.scope
   *     };
   *   }
   * });
   * ```
   */
  setPermissionHandler(handler: PermissionHandler): void {
    this.permissionHandler = handler;
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /**
   * Get information about the connected agent.
   */
  get agentInfo(): ConnectedAgentInfo | undefined {
    return this._agentInfo;
  }

  /**
   * Check if the client is connected.
   */
  get connected(): boolean {
    return this._connected;
  }

  // ===========================================================================
  // Internal Methods (used by Session)
  // ===========================================================================

  /**
   * Send a JSON-RPC request and wait for response.
   *
   * @internal
   */
  async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    this.ensureConnected();

    const id = this.nextRequestId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: (response: JsonRpcResponse) => {
          if (response.error) {
            reject(
              new Error(
                `${response.error.message} (code: ${response.error.code})`
              )
            );
          } else {
            resolve(response.result as T);
          }
        },
        reject,
        timeout,
      });

      // Send request
      this.transport.request(request).then(
        (response) => {
          const pending = this.pendingRequests.get(id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(id);
            pending.resolve(response);
          }
        },
        (error) => {
          const pending = this.pendingRequests.get(id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(id);
            pending.reject(error);
          }
        }
      );
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   *
   * @internal
   */
  async sendNotification(method: string, params?: unknown): Promise<void> {
    this.ensureConnected();

    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    await this.transport.notify(notification);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Set up transport event handlers.
   */
  private setupTransportHandlers(): void {
    this.transport.on("message", (message) => {
      this.handleMessage(message);
    });

    this.transport.on("error", (error) => {
      this.emitter.emit("error", error);
    });

    this.transport.on("close", () => {
      this._connected = false;
      this.emitter.emit("disconnected");
    });
  }

  /**
   * Handle an incoming message from the transport.
   */
  private handleMessage(
    message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification
  ): void {
    if (isJsonRpcRequest(message)) {
      this.handleRequest(message).catch((error) => {
        this.emitter.emit("error", error);
      });
    } else if (isJsonRpcNotification(message)) {
      this.handleNotification(message);
    }
    // Responses are handled by the pending request handlers
  }

  /**
   * Handle an incoming request from the agent.
   */
  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    let result: unknown;
    let error: { code: number; message: string } | undefined;

    try {
      switch (request.method) {
        case "fs/read_text_file":
          result = await this.handleFsReadTextFile(
            request.params as ReadTextFileRequest
          );
          break;

        case "fs/write_text_file":
          result = await this.handleFsWriteTextFile(
            request.params as WriteTextFileRequest
          );
          break;

        case "terminal/create":
          result = await this.handleTerminalCreate(
            request.params as CreateTerminalRequest
          );
          break;

        case "terminal/output":
          result = await this.handleTerminalOutput(
            request.params as TerminalOutputRequest
          );
          break;

        case "terminal/wait_for_exit":
          result = await this.handleTerminalWaitForExit(
            request.params as WaitForExitRequest
          );
          break;

        case "terminal/kill":
          result = await this.handleTerminalKill(
            request.params as KillTerminalRequest
          );
          break;

        case "terminal/release":
          result = await this.handleTerminalRelease(
            request.params as ReleaseTerminalRequest
          );
          break;

        case "session/request_permission":
          result = await this.handleRequestPermission(
            request.params as RequestPermissionRequest
          );
          break;

        default:
          error = {
            code: ErrorCodes.MethodNotFound,
            message: `Method not found: ${request.method}`,
          };
      }
    } catch (err) {
      error = {
        code: ErrorCodes.InternalError,
        message: err instanceof Error ? err.message : String(err),
      };
    }

    // Send response
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: request.id,
      ...(error ? { error } : { result }),
    };

    await this.transport.notify({
      jsonrpc: "2.0",
      method: "__response__",
      params: response,
    });
  }

  /**
   * Handle an incoming notification from the agent.
   */
  private handleNotification(notification: JsonRpcNotification): void {
    if (notification.method === "session/update") {
      this.handleSessionUpdate(notification.params as SessionUpdate);
    }
  }

  /**
   * Handle a session update notification.
   */
  private handleSessionUpdate(params: unknown): void {
    // Validate the update
    const parseResult = SessionUpdateSchema.safeParse(params);
    if (!parseResult.success) {
      this.emitter.emit(
        "error",
        new Error(`Invalid session update: ${parseResult.error.message}`)
      );
      return;
    }

    // Cast to SessionUpdate since Zod schema matches our type
    const update = parseResult.data as SessionUpdate;
    const session = this.sessions.get(update.sessionId);

    // Route to session
    if (session) {
      session.handleUpdate(update);
    }

    // Emit global event
    this.emitter.emit("update", update.sessionId, update);
  }

  // ===========================================================================
  // Request Handlers
  // ===========================================================================

  private async handleFsReadTextFile(
    params: ReadTextFileRequest
  ): Promise<unknown> {
    if (!this.fileSystemHandler) {
      throw new Error("No file system handler registered");
    }

    return await this.fileSystemHandler.readTextFile(
      params.path,
      params.startLine,
      params.endLine
    );
  }

  private async handleFsWriteTextFile(
    params: WriteTextFileRequest
  ): Promise<unknown> {
    if (!this.fileSystemHandler) {
      throw new Error("No file system handler registered");
    }

    return await this.fileSystemHandler.writeTextFile(
      params.path,
      params.content
    );
  }

  private async handleTerminalCreate(
    params: CreateTerminalRequest
  ): Promise<unknown> {
    if (!this.terminalHandler) {
      throw new Error("No terminal handler registered");
    }

    const options = params.cwd !== undefined || params.env !== undefined || params.timeout !== undefined
      ? {
          ...(params.cwd !== undefined && { cwd: params.cwd }),
          ...(params.env !== undefined && { env: params.env }),
          ...(params.timeout !== undefined && { timeout: params.timeout }),
        }
      : undefined;

    return await this.terminalHandler.create(params.command, params.args, options);
  }

  private async handleTerminalOutput(
    params: TerminalOutputRequest
  ): Promise<unknown> {
    if (!this.terminalHandler) {
      throw new Error("No terminal handler registered");
    }

    return await this.terminalHandler.output(params.terminalId);
  }

  private async handleTerminalWaitForExit(
    params: WaitForExitRequest
  ): Promise<unknown> {
    if (!this.terminalHandler) {
      throw new Error("No terminal handler registered");
    }

    return await this.terminalHandler.waitForExit(
      params.terminalId,
      params.timeout
    );
  }

  private async handleTerminalKill(
    params: KillTerminalRequest
  ): Promise<unknown> {
    if (!this.terminalHandler) {
      throw new Error("No terminal handler registered");
    }

    await this.terminalHandler.kill(params.terminalId, params.signal);
    return { killed: true };
  }

  private async handleTerminalRelease(
    params: ReleaseTerminalRequest
  ): Promise<unknown> {
    if (!this.terminalHandler) {
      throw new Error("No terminal handler registered");
    }

    await this.terminalHandler.release(params.terminalId);
    return { released: true };
  }

  private async handleRequestPermission(
    params: RequestPermissionRequest
  ): Promise<unknown> {
    if (!this.permissionHandler) {
      // Default: deny all permissions if no handler
      return {
        granted: false,
        reason: "No permission handler registered",
      };
    }

    // Build a minimal ToolCall from the request
    const toolCall: ToolCall = {
      id: params.toolCallId ?? "unknown",
      tool: params.operation,
      input: { resource: params.resource },
      status: "awaiting_permission",
      ...(params.reason !== undefined && { reason: params.reason }),
    };

    return await this.permissionHandler.requestPermission(
      toolCall,
      params.options ?? []
    );
  }

  /**
   * Ensure the client is connected before performing operations.
   */
  private ensureConnected(): void {
    if (!this._connected) {
      throw new Error("Client is not connected");
    }
  }
}
