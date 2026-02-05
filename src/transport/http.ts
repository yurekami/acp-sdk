/**
 * HTTP Transport
 *
 * Implements transport over HTTP/HTTPS for remote communication.
 * Supports both CLIENT mode (HTTP client) and AGENT mode (HTTP server).
 */

import * as http from "http";
import * as https from "https";
import { EventEmitter } from "eventemitter3";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessageSchema,
  isJsonRpcResponse,
  isJsonRpcNotification,
} from "../types/jsonrpc.js";
import { Transport, TransportEvents } from "./types.js";

/**
 * Configuration options for HttpTransport.
 */
export interface HttpTransportOptions {
  /**
   * Mode: 'client' makes HTTP requests, 'agent' runs HTTP server.
   * @default 'client'
   */
  mode?: "client" | "agent";

  /**
   * Base URL for the remote agent (client mode only).
   * @example 'http://localhost:3000' or 'https://agent.example.com'
   */
  url?: string;

  /**
   * Port to listen on (agent mode only).
   * @default 3000
   */
  port?: number;

  /**
   * Host to bind to (agent mode only).
   * @default 'localhost'
   */
  host?: string;

  /**
   * Custom HTTP headers for authentication (client mode only).
   * @example { 'Authorization': 'Bearer token123' }
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts for failed requests.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Use HTTPS instead of HTTP (client mode only).
   * @default false (auto-detected from URL scheme)
   */
  https?: boolean;

  /**
   * Path for the JSON-RPC endpoint.
   * @default '/jsonrpc'
   */
  path?: string;
}

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * HTTP transport implementation.
 *
 * In CLIENT mode, sends HTTP POST requests to a remote agent.
 * In AGENT mode, runs an HTTP server that accepts JSON-RPC requests.
 *
 * Messages are sent as JSON in the request/response body.
 */
export class HttpTransport implements Transport {
  private options: {
    mode: "client" | "agent";
    timeout: number;
    maxRetries: number;
    path: string;
    port: number;
    host: string;
    url?: string;
    headers?: Record<string, string>;
    https?: boolean;
  };
  private server: http.Server | https.Server | undefined = undefined;
  private pendingRequests = new Map<string | number, PendingRequest>();
  private isConnected = false;
  private emitter = new EventEmitter<TransportEvents>();

  constructor(options: HttpTransportOptions = {}) {
    this.options = {
      mode: options.mode ?? "client",
      timeout: options.timeout ?? 30000,
      maxRetries: options.maxRetries ?? 3,
      path: options.path ?? "/jsonrpc",
      port: options.port ?? 3000,
      host: options.host ?? "localhost",
    };

    if (options.url !== undefined) {
      this.options.url = options.url;
    }
    if (options.headers !== undefined) {
      this.options.headers = options.headers;
    }
    if (options.https !== undefined) {
      this.options.https = options.https;
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
    if (!this.options.url) {
      throw new Error("HttpTransport in client mode requires 'url' option");
    }

    // Validate URL
    try {
      new URL(this.options.url);
    } catch {
      throw new Error(`Invalid URL: ${this.options.url}`);
    }

    // Connection established (HTTP is connectionless, but we mark as connected)
    this.isConnected = true;
  }

  private async startAgentMode(): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestHandler = async (
        req: http.IncomingMessage,
        res: http.ServerResponse
      ) => {
        // Only handle POST requests to the JSON-RPC endpoint
        if (req.method !== "POST" || req.url !== this.options.path) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }

        // Read request body
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const json = JSON.parse(body);
            JsonRpcMessageSchema.parse(json); // Validate but don't use result

            // Handle notification (no response expected)
            if (isJsonRpcNotification(json)) {
              this.emit("message", json as JsonRpcNotification);
              res.writeHead(204); // No Content
              res.end();
              return;
            }

            // Handle request (response expected)
            this.emit("message", json as JsonRpcRequest | JsonRpcResponse);

            // Wait for response via the pending request system
            // In agent mode, the application will call request() or notify()
            // to send the response back
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: null, result: null }));
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: {
                  code: -32700,
                  message: `Parse error: ${errorMessage}`,
                },
              })
            );
            this.handleError(
              new Error(`Failed to parse request: ${errorMessage}`)
            );
          }
        });
      };

      // Create HTTP or HTTPS server based on options
      if (this.options.https) {
        this.server = https.createServer(requestHandler);
      } else {
        this.server = http.createServer(requestHandler);
      }

      this.server.on("error", (error) => {
        this.handleError(error);
        reject(error);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        resolve();
      });
    });
  }

  async request(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected) {
      throw new Error("Transport not connected");
    }

    if (this.options.mode === "agent") {
      throw new Error("Cannot send requests in agent mode");
    }

    let lastError: Error | undefined;

    // Retry logic
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await this.sendHttpRequest(request);
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));

        // Don't retry on timeout or if this was the last attempt
        if (
          lastError.message.includes("timeout") ||
          attempt === this.options.maxRetries
        ) {
          break;
        }

        // Exponential backoff: wait 100ms, 200ms, 400ms, etc.
        const delay = Math.min(100 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error("Request failed");
  }

  private async sendHttpRequest(
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      if (!this.options.url) {
        reject(new Error("URL not configured"));
        return;
      }

      const url = new URL(this.options.url);
      const isHttps = url.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const postData = JSON.stringify(request);

      const requestOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: this.options.path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          ...this.options.headers,
        },
        timeout: this.options.timeout,
      };

      const req = httpModule.request(requestOptions, (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk.toString();
        });

        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            JsonRpcMessageSchema.parse(json); // Validate but don't use result

            if (isJsonRpcResponse(json)) {
              resolve(json as JsonRpcResponse);
            } else {
              reject(new Error("Expected JSON-RPC response"));
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            reject(new Error(`Failed to parse response: ${errorMessage}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(
          new Error(
            `Request timed out after ${this.options.timeout}ms`
          )
        );
      });

      req.write(postData);
      req.end();
    });
  }

  async notify(notification: JsonRpcNotification): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Transport not connected");
    }

    if (this.options.mode === "agent") {
      // In agent mode, notifications are sent via the message event
      this.emit("message", notification as JsonRpcNotification);
      return;
    }

    // In client mode, send HTTP POST request (fire and forget)
    try {
      await this.sendHttpNotification(notification);
    } catch (error) {
      // Log but don't throw - notifications are best-effort
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[HttpTransport] Notification failed: ${errorMessage}`);
    }
  }

  private async sendHttpNotification(
    notification: JsonRpcNotification
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.options.url) {
        reject(new Error("URL not configured"));
        return;
      }

      const url = new URL(this.options.url);
      const isHttps = url.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const postData = JSON.stringify(notification);

      const requestOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: this.options.path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          ...this.options.headers,
        },
        timeout: this.options.timeout,
      };

      const req = httpModule.request(requestOptions, (res) => {
        // Drain response body
        res.on("data", () => {});
        res.on("end", () => {
          resolve();
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Notification request timed out"));
      });

      req.write(postData);
      req.end();
    });
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

    // Close server if in agent mode
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.server = undefined;
          this.emit("close");
          resolve();
        });
      });
    }

    this.emit("close");
  }

  private handleError(error: Error): void {
    console.error(`[HttpTransport Error]: ${error.message}`);
    this.emit("error", error);
  }
}
