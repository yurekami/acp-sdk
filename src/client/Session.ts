/**
 * ACP Session
 *
 * Manages an individual session with an ACP agent.
 * Handles prompts, mode changes, and session-specific events.
 *
 * @module @anthropic/acp-sdk/client/Session
 */

import { EventEmitter } from "eventemitter3";
import type { ACPClient } from "./ACPClient.js";
import type {
  SessionEvents,
  PromptResult,
  SessionConfigOption,
} from "./types.js";
import type {
  ContentBlock,
  SessionMode,
  SessionUpdate,
  AvailableCommand,
  SessionPromptResponse,
} from "../types/index.js";

/**
 * Represents an active session with an ACP agent.
 *
 * @example
 * ```typescript
 * const session = await client.createSession({
 *   workingDirectory: '/home/user/project'
 * });
 *
 * session.on('update', (update) => {
 *   if (update.type === 'agent_message_chunk') {
 *     process.stdout.write(update.data.content);
 *   }
 * });
 *
 * await session.prompt([{ type: 'text', text: 'Hello!' }]);
 * ```
 */
export class Session {
  /** Unique session identifier */
  readonly id: string;

  /** Reference to the parent client */
  readonly client: ACPClient;

  /** Event emitter for session events */
  private readonly emitter = new EventEmitter<SessionEvents>();

  /** Current operating mode */
  private _currentMode: SessionMode | undefined;

  /** Available modes for this session */
  private _availableModes: SessionMode[] = [];

  /** Current configuration options */
  private _configOptions: SessionConfigOption[] = [];

  /** Available commands */
  private _availableCommands: AvailableCommand[] = [];

  /** Whether the session is active */
  private _isActive = true;

  /**
   * Creates a new Session instance.
   * This should not be called directly - use ACPClient.createSession() or ACPClient.loadSession().
   *
   * @param id - Session identifier
   * @param client - Parent ACP client
   * @param initialMode - Initial mode (optional)
   */
  constructor(id: string, client: ACPClient, initialMode?: SessionMode) {
    this.id = id;
    this.client = client;
    this._currentMode = initialMode;
  }

  // ===========================================================================
  // Session Operations
  // ===========================================================================

  /**
   * Send a prompt to the agent.
   *
   * @param content - Content blocks to send
   * @returns Promise resolving to the prompt result
   * @throws Error if the session is not active or the prompt fails
   *
   * @example
   * ```typescript
   * const result = await session.prompt([
   *   { type: 'text', text: 'Refactor this function to use async/await' }
   * ]);
   * console.log('Stop reason:', result.stopReason);
   * ```
   */
  async prompt(content: ContentBlock[]): Promise<PromptResult> {
    this.ensureActive();

    const response = await this.client.sendRequest<SessionPromptResponse>(
      "session/prompt",
      {
        sessionId: this.id,
        content,
      }
    );

    return {
      stopReason: response.stopReason,
      usage: response.usage,
    };
  }

  /**
   * Cancel the current operation.
   *
   * @param reason - Optional cancellation reason
   *
   * @example
   * ```typescript
   * // Cancel with reason
   * await session.cancel('User requested stop');
   * ```
   */
  async cancel(reason?: string): Promise<void> {
    this.ensureActive();

    await this.client.sendNotification("session/cancel", {
      sessionId: this.id,
      reason,
    });
  }

  /**
   * Set the session operating mode.
   *
   * @param modeId - Mode identifier to set
   * @returns Promise resolving when mode is set
   *
   * @example
   * ```typescript
   * await session.setMode('architect');
   * ```
   */
  async setMode(modeId: string): Promise<void> {
    this.ensureActive();

    const response = await this.client.sendRequest<{
      previousMode: SessionMode;
      currentMode: SessionMode;
    }>("session/set_mode", {
      sessionId: this.id,
      mode: modeId,
    });

    const previousMode = this._currentMode;
    this._currentMode = response.currentMode;

    if (previousMode !== response.currentMode) {
      this.emitter.emit(
        "modeChange",
        previousMode ?? "unknown",
        response.currentMode
      );
    }
  }

  /**
   * Set a configuration option.
   *
   * @param configId - Configuration key
   * @param valueId - Value to set
   * @returns Promise resolving when option is set
   *
   * @example
   * ```typescript
   * await session.setConfigOption('autoApprove', 'enabled');
   * ```
   */
  async setConfigOption(configId: string, valueId: string): Promise<void> {
    this.ensureActive();

    const response = await this.client.sendRequest<{
      key: string;
      previousValue?: unknown;
      currentValue: unknown;
    }>("session/set_config_option", {
      sessionId: this.id,
      key: configId,
      value: valueId,
    });

    // Update local config state
    const option = this._configOptions.find((o) => o.id === configId);
    if (option) {
      option.currentValueId = valueId;
    }

    this.emitter.emit("configChange", configId, response.currentValue);
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
   * session.on('update', (update) => {
   *   console.log('Received update:', update.type);
   * });
   *
   * session.on('modeChange', (prev, curr) => {
   *   console.log(`Mode changed from ${prev} to ${curr}`);
   * });
   * ```
   */
  on<K extends keyof SessionEvents>(event: K, handler: SessionEvents[K]): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Unregister an event handler.
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off<K extends keyof SessionEvents>(
    event: K,
    handler: SessionEvents[K]
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Handle an incoming session update from the agent.
   * Called by ACPClient when a session/update notification is received.
   *
   * @internal
   */
  handleUpdate(update: SessionUpdate): void {
    // Process specific update types
    switch (update.type) {
      case "current_mode_update":
        this._currentMode = update.data.currentMode;
        this.emitter.emit(
          "modeChange",
          update.data.previousMode,
          update.data.currentMode
        );
        break;

      case "config_option_update":
        this.emitter.emit(
          "configChange",
          update.data.key,
          update.data.currentValue
        );
        break;

      case "available_commands":
        this._availableCommands = update.data.commands;
        this.emitter.emit("commandsChange", update.data.commands);
        break;
    }

    // Always emit the generic update event
    this.emitter.emit("update", update);
  }

  /**
   * Mark the session as inactive.
   *
   * @internal
   */
  deactivate(): void {
    this._isActive = false;
  }

  /**
   * Set available modes for this session.
   *
   * @internal
   */
  setAvailableModes(modes: SessionMode[]): void {
    this._availableModes = modes;
  }

  /**
   * Set configuration options for this session.
   *
   * @internal
   */
  setConfigOptions(options: SessionConfigOption[]): void {
    this._configOptions = options;
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /**
   * Get the current operating mode.
   */
  get currentMode(): SessionMode | undefined {
    return this._currentMode;
  }

  /**
   * Get available modes for this session.
   */
  get availableModes(): SessionMode[] {
    return [...this._availableModes];
  }

  /**
   * Get current configuration options.
   */
  get configOptions(): SessionConfigOption[] {
    return [...this._configOptions];
  }

  /**
   * Get available commands.
   */
  get availableCommands(): AvailableCommand[] {
    return [...this._availableCommands];
  }

  /**
   * Check if the session is active.
   */
  get isActive(): boolean {
    return this._isActive;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Ensure the session is active before performing operations.
   */
  private ensureActive(): void {
    if (!this._isActive) {
      throw new Error(`Session ${this.id} is no longer active`);
    }
  }
}
