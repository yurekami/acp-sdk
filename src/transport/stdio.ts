/**
 * Standard I/O Transport
 *
 * Implements transport over stdin/stdout for subprocess communication.
 * Supports both CLIENT mode (spawning a subprocess) and AGENT mode (using process stdio).
 */

import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import { EventEmitter } from "eventemitter3";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessageSchema,
  isJsonRpcResponse,
} from "../types/jsonrpc.js";
import { Transport, TransportEvents } from "./types.js";

/**
 * Configuration options for StdioTransport.
 */
export interface StdioTransportOptions {
  /**
   * Mode: 'client' spawns a subprocess, 'agent' uses current process stdio.
   * @default 'client'
   */
  mode?: "client" | "agent";

  /**
   * Command to spawn (client mode only).
   * @example 'node'
   */
  command?: string;

  /**
   * Arguments for the command (client mode only).
   * @example ['agent.js']
   */
  args?: string[];

  /**
   * Environment variables for the subprocess (client mode only).
   */
  env?: Record<string, string>;

  /**
   * Working directory for the subprocess (client mode only).
   */
  cwd?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Standard I/O transport implementation.
 *
 * In CLIENT mode, spawns a subprocess and communicates via stdin/stdout.
 * In AGENT mode, reads from process.stdin and writes to process.stdout.
 *
 * Messages are framed as newline-delimited JSON.
 */
export class StdioTransport implements Transport {
  private options: {
    mode: "client" | "agent";
    timeout: number;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
  };
  private childProcess: ChildProcess | undefined = undefined;
  private readlineInterface: readline.Interface | undefined = undefined;
  private pendingRequests = new Map<string | number, PendingRequest>();
  private isConnected = false;
  private emitter = new EventEmitter<TransportEvents>();

  constructor(options: StdioTransportOptions = {}) {
    this.options = {
      mode: options.mode ?? "client",
      timeout: options.timeout ?? 30000,
    };

    if (options.command !== undefined) {
      this.options.command = options.command;
    }
    if (options.args !== undefined) {
      this.options.args = options.args;
    }
    if (options.env !== undefined) {
      this.options.env = options.env;
    }
    if (options.cwd !== undefined) {
      this.options.cwd = options.cwd;
    }
  }

  on<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void {
    this.emitter.on(event, handler as any);
  }

  off<K extends keyof TransportEvents>(
    event: K,
    handler: TransportEvents[K]
  ): void {
    this.emitter.off(event, handler as any);
  }

  private emit(
    event: "message",
    arg: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification
  ): void;
  private emit(event: "error", arg: Error): void;
  private emit(event: "close"): void;
  private emit(
    event: keyof TransportEvents,
    arg?: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification | Error
  ): void {
    (this.emitter as any).emit(event, arg);
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async start(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.options.mode === "client") {
      await this.startClientMode();
    } else {
      await this.startAgentMode();
    }

    this.isConnected = true;
  }

  private async startClientMode(): Promise<void> {
    if (!this.options.command) {
      throw new Error(
        "StdioTransport in client mode requires 'command' option"
      );
    }

    // Spawn the subprocess
    this.childProcess = spawn(
      this.options.command,
      this.options.args ?? [],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...this.options.env },
        cwd: this.options.cwd,
      }
    );

    // Handle subprocess errors
    this.childProcess.on("error", (error) => {
      this.handleError(new Error(`Subprocess error: ${error.message}`));
    });

    // Handle subprocess exit
    this.childProcess.on("exit", (code, signal) => {
      this.isConnected = false;
      this.emit("close");

      if (code !== 0 && code !== null) {
        this.handleError(new Error(`Subprocess exited with code ${code}`));
      } else if (signal) {
        this.handleError(new Error(`Subprocess killed with signal ${signal}`));
      }
    });

    // Set up stderr logging
    if (this.childProcess.stderr) {
      this.childProcess.stderr.on("data", (data) => {
        console.error(`[Agent stderr]: ${data.toString()}`);
      });
    }

    // Set up readline for stdout
    if (this.childProcess.stdout) {
      this.readlineInterface = readline.createInterface({
        input: this.childProcess.stdout,
        crlfDelay: Infinity,
      });

      this.readlineInterface.on("line", (line) => {
        this.handleIncomingMessage(line);
      });
    }
  }

  private async startAgentMode(): Promise<void> {
    // Set up readline for process.stdin
    this.readlineInterface = readline.createInterface({
      input: process.stdin,
      output: undefined, // Don't echo input
      crlfDelay: Infinity,
    });

    this.readlineInterface.on("line", (line) => {
      this.handleIncomingMessage(line);
    });

    // Handle stdin close
    process.stdin.on("end", () => {
      this.isConnected = false;
      this.emit("close");
    });
  }

  private handleIncomingMessage(line: string): void {
    if (!line.trim()) {
      return; // Skip empty lines
    }

    try {
      const json = JSON.parse(line);
      JsonRpcMessageSchema.parse(json); // Validate but don't use result

      // Type-safe casting from parsed JSON
      if (isJsonRpcResponse(json)) {
        if (json.id !== null) {
          const pending = this.pendingRequests.get(json.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(json.id);
            pending.resolve(json as JsonRpcResponse);
            return;
          }
        }
      }

      // Emit the message for the application to handle
      this.emit("message", json as JsonRpcRequest | JsonRpcResponse | JsonRpcNotification);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.handleError(new Error(`Failed to parse message: ${errorMessage}`));
    }
  }

  async request(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected) {
      throw new Error("Transport not connected");
    }

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(
          new Error(
            `Request ${request.id} timed out after ${this.options.timeout}ms`
          )
        );
      }, this.options.timeout);

      // Store the pending request
      this.pendingRequests.set(request.id, { resolve, reject, timer });

      // Send the request
      try {
        this.sendMessage(request);
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(request.id);
        reject(error);
      }
    });
  }

  async notify(notification: JsonRpcNotification): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Transport not connected");
    }

    this.sendMessage(notification);
  }

  private sendMessage(
    message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification
  ): void {
    const json = JSON.stringify(message);
    const line = json + "\n";

    if (this.options.mode === "client") {
      if (!this.childProcess?.stdin) {
        throw new Error("Child process stdin not available");
      }
      this.childProcess.stdin.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    this.isConnected = false;

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Transport closed"));
    }
    this.pendingRequests.clear();

    // Close readline interface
    if (this.readlineInterface) {
      this.readlineInterface.close();
      this.readlineInterface = undefined;
    }

    // Kill child process if in client mode
    if (this.childProcess) {
      return new Promise<void>((resolve) => {
        if (!this.childProcess) {
          resolve();
          return;
        }

        const exitHandler = () => {
          this.childProcess = undefined;
          resolve();
        };

        this.childProcess.once("exit", exitHandler);

        // Try graceful shutdown first
        this.childProcess.kill("SIGTERM");

        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.childProcess) {
            this.childProcess.kill("SIGKILL");
          }
        }, 5000);
      });
    }

    this.emit("close");
  }

  private handleError(error: Error): void {
    console.error(`[StdioTransport Error]: ${error.message}`);
    this.emit("error", error);
  }
}
