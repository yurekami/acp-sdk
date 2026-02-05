import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { StdioTransport, HttpTransport } from '../../src/transport/index.js';
import type { ChildProcess } from 'child_process';

// Mock modules
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

vi.mock('http', () => ({
  createServer: vi.fn(),
  request: vi.fn(),
}));

vi.mock('https', () => ({
  createServer: vi.fn(),
  request: vi.fn(),
}));

describe('StdioTransport', () => {
  let mockChildProcess: any;
  let mockReadline: any;
  let stdinMock: any;
  let stdoutMock: any;
  let stderrMock: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock child process
    stdinMock = {
      write: vi.fn(),
      end: vi.fn(),
    };

    stdoutMock = new EventEmitter();
    stderrMock = new EventEmitter();

    mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdin = stdinMock;
    mockChildProcess.stdout = stdoutMock;
    mockChildProcess.stderr = stderrMock;
    mockChildProcess.kill = vi.fn();
    mockChildProcess.pid = 12345;

    // Setup readline mock
    mockReadline = new EventEmitter() as any;
    mockReadline.close = vi.fn();

    // Mock spawn to return our mock child process
    const { spawn } = await import('child_process');
    vi.mocked(spawn).mockReturnValue(mockChildProcess as ChildProcess);

    // Mock readline.createInterface
    const readline = await import('readline');
    vi.mocked(readline.createInterface).mockReturnValue(mockReadline as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create transport with default options', () => {
      const transport = new StdioTransport();
      expect(transport).toBeDefined();
      expect(transport.connected).toBe(false);
    });

    it('should create transport with custom options', () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
        args: ['agent.js'],
        timeout: 10000,
        env: { NODE_ENV: 'test' },
        cwd: '/tmp',
      });
      expect(transport).toBeDefined();
      expect(transport.connected).toBe(false);
    });

    it('should create transport in agent mode', () => {
      const transport = new StdioTransport({
        mode: 'agent',
      });
      expect(transport).toBeDefined();
      expect(transport.connected).toBe(false);
    });
  });

  describe('start() in client mode', () => {
    it('should spawn subprocess with correct parameters', async () => {
      const { spawn } = await import('child_process');
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
        args: ['agent.js'],
        env: { NODE_ENV: 'test' },
        cwd: '/tmp',
      });

      await transport.start();

      expect(spawn).toHaveBeenCalledWith('node', ['agent.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({ NODE_ENV: 'test' }),
        cwd: '/tmp',
      });
      expect(transport.connected).toBe(true);
    });

    it('should throw error if command is not provided in client mode', async () => {
      const transport = new StdioTransport({
        mode: 'client',
      });

      await expect(transport.start()).rejects.toThrow(
        "StdioTransport in client mode requires 'command' option"
      );
    });

    it('should not start if already connected', async () => {
      const { spawn } = await import('child_process');
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await transport.start();
      await transport.start();

      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should emit error when subprocess has error', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);

      await transport.start();

      const testError = new Error('Spawn error');
      mockChildProcess.emit('error', testError);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Subprocess error: Spawn error',
        })
      );
    });

    it('should emit close when subprocess exits', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const closeHandler = vi.fn();
      transport.on('close', closeHandler);

      await transport.start();
      mockChildProcess.emit('exit', 0, null);

      expect(closeHandler).toHaveBeenCalled();
      expect(transport.connected).toBe(false);
    });

    it('should emit error when subprocess exits with non-zero code', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);

      await transport.start();
      mockChildProcess.emit('exit', 1, null);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Subprocess exited with code 1',
        })
      );
    });

    it('should emit error when subprocess is killed with signal', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);

      await transport.start();
      mockChildProcess.emit('exit', null, 'SIGTERM');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Subprocess killed with signal SIGTERM',
        })
      );
    });
  });

  describe('start() in agent mode', () => {
    it('should setup readline for process.stdin', async () => {
      const readline = await import('readline');
      const transport = new StdioTransport({
        mode: 'agent',
      });

      await transport.start();

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: undefined,
        crlfDelay: Infinity,
      });
      expect(transport.connected).toBe(true);
    });
  });

  describe('request()', () => {
    it('should send request and return response', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
        timeout: 5000,
      });

      await transport.start();

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Simulate response from subprocess
      mockReadline.emit(
        'line',
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        })
      );

      const response = await requestPromise;

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });
    });

    it('should throw error if transport not connected', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await expect(
        transport.request({
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
          params: {},
        })
      ).rejects.toThrow('Transport not connected');
    });

    it('should timeout if no response received', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
        timeout: 100,
      });

      await transport.start();

      await expect(
        transport.request({
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
          params: {},
        })
      ).rejects.toThrow('Request 1 timed out after 100ms');
    });

    it('should write request to stdin', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await transport.start();

      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test',
        params: {},
      };

      transport.request(request);

      expect(stdinMock.write).toHaveBeenCalledWith(
        JSON.stringify(request) + '\n'
      );
    });
  });

  describe('notify()', () => {
    it('should send notification without waiting for response', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await transport.start();

      const notification = {
        jsonrpc: '2.0' as const,
        method: 'notification',
        params: {},
      };

      await transport.notify(notification);

      expect(stdinMock.write).toHaveBeenCalledWith(
        JSON.stringify(notification) + '\n'
      );
    });

    it('should throw error if transport not connected', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await expect(
        transport.notify({
          jsonrpc: '2.0',
          method: 'test',
          params: {},
        })
      ).rejects.toThrow('Transport not connected');
    });
  });

  describe('message handling', () => {
    it('should emit message event for incoming messages', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const messageHandler = vi.fn();
      transport.on('message', messageHandler);

      await transport.start();

      const notification = {
        jsonrpc: '2.0',
        method: 'notification',
        params: { data: 'test' },
      };

      mockReadline.emit('line', JSON.stringify(notification));

      expect(messageHandler).toHaveBeenCalledWith(notification);
    });

    it('should skip empty lines', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const messageHandler = vi.fn();
      transport.on('message', messageHandler);

      await transport.start();

      mockReadline.emit('line', '');
      mockReadline.emit('line', '   ');

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should emit error for invalid JSON', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);

      await transport.start();

      mockReadline.emit('line', 'invalid json');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to parse message'),
        })
      );
    });

    it('should emit error for invalid JSON-RPC message', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);

      await transport.start();

      mockReadline.emit('line', JSON.stringify({ invalid: 'message' }));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to parse message'),
        })
      );
    });
  });

  describe('close()', () => {
    it('should close transport and kill subprocess', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await transport.start();
      const closePromise = transport.close();

      // Simulate subprocess exit
      mockChildProcess.emit('exit', 0, null);

      await closePromise;

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockReadline.close).toHaveBeenCalled();
      expect(transport.connected).toBe(false);
    });

    it('should force kill subprocess after timeout', async () => {
      vi.useFakeTimers();

      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await transport.start();
      const closePromise = transport.close();

      // Fast forward past the 5 second timeout
      vi.advanceTimersByTime(5000);

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');

      // Simulate subprocess exit
      mockChildProcess.emit('exit', 0, null);

      await closePromise;

      vi.useRealTimers();
    });

    it('should reject pending requests on close', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await transport.start();

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      const closePromise = transport.close();

      // Simulate subprocess exit
      mockChildProcess.emit('exit', 0, null);

      await closePromise;

      await expect(requestPromise).rejects.toThrow('Transport closed');
    });

    it('should not do anything if already closed', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      await transport.start();

      const closePromise = transport.close();
      mockChildProcess.emit('exit', 0, null);
      await closePromise;

      await transport.close();

      expect(mockChildProcess.kill).toHaveBeenCalledTimes(1);
    });

    it('should emit close event', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const closeHandler = vi.fn();
      transport.on('close', closeHandler);

      await transport.start();
      const closePromise = transport.close();
      mockChildProcess.emit('exit', 0, null);
      await closePromise;

      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    it('should register and call event handlers', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const handler = vi.fn();
      transport.on('message', handler);

      await transport.start();

      const message = {
        jsonrpc: '2.0' as const,
        method: 'test',
        params: {},
      };

      mockReadline.emit('line', JSON.stringify(message));

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should remove event handlers with off()', async () => {
      const transport = new StdioTransport({
        mode: 'client',
        command: 'node',
      });

      const handler = vi.fn();
      transport.on('message', handler);
      transport.off('message', handler);

      await transport.start();

      const message = {
        jsonrpc: '2.0' as const,
        method: 'test',
        params: {},
      };

      mockReadline.emit('line', JSON.stringify(message));

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('HttpTransport', () => {
  let mockServer: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock HTTP server
    mockServer = new EventEmitter() as any;
    mockServer.listen = vi.fn((port, host, callback) => {
      setTimeout(() => callback(), 0);
      return mockServer;
    });
    mockServer.close = vi.fn((callback) => {
      setTimeout(() => callback?.(), 0);
    });

    // Setup mock HTTP request
    mockRequest = new EventEmitter() as any;
    mockRequest.write = vi.fn();
    mockRequest.end = vi.fn();
    mockRequest.destroy = vi.fn();

    // Setup mock HTTP response
    mockResponse = new EventEmitter() as any;
    mockResponse.writeHead = vi.fn();
    mockResponse.end = vi.fn();

    // Mock http module - return a new request instance each time
    const http = await import('http');
    vi.mocked(http.createServer).mockReturnValue(mockServer);
    vi.mocked(http.request).mockImplementation(() => {
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn();
      req.destroy = vi.fn();
      mockRequest = req;
      return req;
    });

    // Mock https module
    const https = await import('https');
    vi.mocked(https.createServer).mockReturnValue(mockServer);
    vi.mocked(https.request).mockImplementation(() => {
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn();
      req.destroy = vi.fn();
      mockRequest = req;
      return req;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create transport with default options', () => {
      const transport = new HttpTransport();
      expect(transport).toBeDefined();
      expect(transport.connected).toBe(false);
    });

    it('should create transport with custom options', () => {
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
        timeout: 10000,
        maxRetries: 5,
        headers: { Authorization: 'Bearer token' },
        path: '/api/jsonrpc',
      });
      expect(transport).toBeDefined();
      expect(transport.connected).toBe(false);
    });

    it('should create transport in agent mode', () => {
      const transport = new HttpTransport({
        mode: 'agent',
        port: 4000,
        host: '0.0.0.0',
      });
      expect(transport).toBeDefined();
      expect(transport.connected).toBe(false);
    });
  });

  describe('start() in client mode', () => {
    it('should validate URL and mark as connected', async () => {
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      await transport.start();

      expect(transport.connected).toBe(true);
    });

    it('should throw error if URL is not provided in client mode', async () => {
      const transport = new HttpTransport({
        mode: 'client',
      });

      await expect(transport.start()).rejects.toThrow(
        "HttpTransport in client mode requires 'url' option"
      );
    });

    it('should throw error if URL is invalid', async () => {
      const transport = new HttpTransport({
        mode: 'client',
        url: 'not-a-valid-url',
      });

      await expect(transport.start()).rejects.toThrow('Invalid URL');
    });

    it('should not start if already connected', async () => {
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      await transport.start();
      await transport.start();

      expect(transport.connected).toBe(true);
    });
  });

  describe('start() in agent mode', () => {
    it('should create HTTP server and listen on specified port', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'agent',
        port: 4000,
        host: '0.0.0.0',
      });

      await transport.start();

      expect(http.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(
        4000,
        '0.0.0.0',
        expect.any(Function)
      );
      expect(transport.connected).toBe(true);
    });

    it('should create HTTPS server when https option is true', async () => {
      const https = await import('https');
      const transport = new HttpTransport({
        mode: 'agent',
        https: true,
      });

      await transport.start();

      expect(https.createServer).toHaveBeenCalled();
    });

    it('should emit error on server error', async () => {
      const transport = new HttpTransport({
        mode: 'agent',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);

      const startPromise = transport.start();

      const serverError = new Error('Server error');
      mockServer.emit('error', serverError);

      await expect(startPromise).rejects.toThrow('Server error');
      expect(errorHandler).toHaveBeenCalledWith(serverError);
    });
  });

  describe('request() in client mode', () => {
    it('should send HTTP POST request and return response', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      await transport.start();

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Get the request callback
      const requestCall = vi.mocked(http.request).mock.calls[0];
      const callback = requestCall[1];

      // Simulate response
      callback?.(mockResponse);
      mockResponse.emit(
        'data',
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        })
      );
      mockResponse.emit('end');

      const response = await requestPromise;

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });
    });

    it('should throw error if transport not connected', async () => {
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      await expect(
        transport.request({
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
          params: {},
        })
      ).rejects.toThrow('Transport not connected');
    });

    it('should throw error in agent mode', async () => {
      const transport = new HttpTransport({
        mode: 'agent',
      });

      await transport.start();

      await expect(
        transport.request({
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
          params: {},
        })
      ).rejects.toThrow('Cannot send requests in agent mode');
    });

    it('should retry on network error', async () => {
      const http = await import('http');

      // Reset and setup mock for this test
      vi.mocked(http.request).mockClear();

      let callCount = 0;
      vi.mocked(http.request).mockImplementation(() => {
        const req = new EventEmitter() as any;
        req.write = vi.fn();
        req.end = vi.fn();
        req.destroy = vi.fn();

        callCount++;
        if (callCount === 1) {
          // First attempt fails
          setImmediate(() => req.emit('error', new Error('Network error')));
        }

        return req;
      });

      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
        maxRetries: 2,
      });

      await transport.start();

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      // Wait for retry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second attempt succeeds
      const requestCall = vi.mocked(http.request).mock.calls[1];
      const callback = requestCall[1];
      callback?.(mockResponse);
      mockResponse.emit(
        'data',
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        })
      );
      mockResponse.emit('end');

      const response = await requestPromise;

      expect(http.request).toHaveBeenCalledTimes(2);
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });
    });

    it('should timeout on slow requests', async () => {
      const http = await import('http');

      // Reset mock completely before this specific test
      vi.mocked(http.request).mockReset();

      // Capture the request instance when it's created
      let capturedRequest: any;
      vi.mocked(http.request).mockImplementation((...args) => {
        const req = new EventEmitter() as any;
        req.write = vi.fn();
        req.end = vi.fn();
        req.destroy = vi.fn();
        capturedRequest = req;

        // Emit timeout after the request is set up
        setImmediate(() => {
          if (capturedRequest) {
            capturedRequest.emit('timeout');
          }
        });

        return req;
      });

      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
        timeout: 100,
      });

      await transport.start();

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      await expect(requestPromise).rejects.toThrow('Request timed out after 100ms');
    });

    it('should handle timeout event', async () => {
      const http = await import('http');

      // Capture the request instance when it's created
      let capturedRequest: any;
      vi.mocked(http.request).mockImplementation((...args) => {
        const req = new EventEmitter() as any;
        req.write = vi.fn();
        req.end = vi.fn();
        req.destroy = vi.fn();
        capturedRequest = req;

        // Emit timeout after the request is set up
        setImmediate(() => {
          if (capturedRequest) {
            capturedRequest.emit('timeout');
          }
        });

        return req;
      });

      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
        timeout: 1000,
      });

      await transport.start();

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      await expect(requestPromise).rejects.toThrow(
        'Request timed out after 1000ms'
      );
      expect(capturedRequest.destroy).toHaveBeenCalled();
    });

    it('should use HTTPS for https:// URLs', async () => {
      const https = await import('https');
      const transport = new HttpTransport({
        mode: 'client',
        url: 'https://example.com',
      });

      await transport.start();

      transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      expect(https.request).toHaveBeenCalled();
    });

    it('should include custom headers in request', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom': 'value',
        },
      });

      await transport.start();

      transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      const requestCall = vi.mocked(http.request).mock.calls[0];
      const options = requestCall[0];

      expect(options).toMatchObject({
        headers: expect.objectContaining({
          Authorization: 'Bearer token123',
          'X-Custom': 'value',
        }),
      });
    });
  });

  describe('notify() in client mode', () => {
    it('should send notification without waiting for response', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      await transport.start();

      const notifyPromise = transport.notify({
        jsonrpc: '2.0',
        method: 'notification',
        params: {},
      });

      // Simulate response
      const requestCall = vi.mocked(http.request).mock.calls[0];
      const callback = requestCall[1];
      callback?.(mockResponse);
      mockResponse.emit('end');

      await notifyPromise;

      expect(mockRequest.write).toHaveBeenCalled();
    });

    it('should not throw on notification error', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      await transport.start();

      const notifyPromise = transport.notify({
        jsonrpc: '2.0',
        method: 'notification',
        params: {},
      });

      mockRequest.emit('error', new Error('Network error'));

      // Should not throw
      await expect(notifyPromise).resolves.toBeUndefined();
    });

    it('should emit message in agent mode', async () => {
      const transport = new HttpTransport({
        mode: 'agent',
      });

      const messageHandler = vi.fn();
      transport.on('message', messageHandler);

      await transport.start();

      await transport.notify({
        jsonrpc: '2.0',
        method: 'notification',
        params: { data: 'test' },
      });

      expect(messageHandler).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'notification',
        params: { data: 'test' },
      });
    });
  });

  describe('close()', () => {
    it('should close server in agent mode', async () => {
      const transport = new HttpTransport({
        mode: 'agent',
      });

      await transport.start();

      const closeHandler = vi.fn();
      transport.on('close', closeHandler);

      await transport.close();

      expect(mockServer.close).toHaveBeenCalled();
      expect(closeHandler).toHaveBeenCalled();
      expect(transport.connected).toBe(false);
    });

    it('should reject pending requests on close', async () => {
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      await transport.start();
      await transport.close();

      expect(transport.connected).toBe(false);
    });

    it('should not do anything if already closed', async () => {
      const transport = new HttpTransport({
        mode: 'agent',
      });

      await transport.start();
      await transport.close();
      await transport.close();

      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });

    it('should emit close event in client mode', async () => {
      const transport = new HttpTransport({
        mode: 'client',
        url: 'http://localhost:3000',
      });

      const closeHandler = vi.fn();
      transport.on('close', closeHandler);

      await transport.start();
      await transport.close();

      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    it('should register and call event handlers', async () => {
      const transport = new HttpTransport({
        mode: 'agent',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);

      await transport.start();

      const error = new Error('Test error');
      mockServer.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should remove event handlers with off()', async () => {
      const transport = new HttpTransport({
        mode: 'agent',
      });

      const errorHandler = vi.fn();
      transport.on('error', errorHandler);
      transport.off('error', errorHandler);

      await transport.start();

      const error = new Error('Test error');
      mockServer.emit('error', error);

      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('agent mode request handling', () => {
    it('should handle valid JSON-RPC request', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'agent',
        path: '/jsonrpc',
      });

      const messageHandler = vi.fn();
      transport.on('message', messageHandler);

      await transport.start();

      // Get the request handler
      const createServerCall = vi.mocked(http.createServer).mock.calls[0];
      const requestHandler = createServerCall[0];

      // Simulate incoming request
      const mockReq = new EventEmitter() as any;
      mockReq.method = 'POST';
      mockReq.url = '/jsonrpc';

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      requestHandler(mockReq, mockRes);

      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });

      mockReq.emit('data', requestData);
      mockReq.emit('end');

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(messageHandler).toHaveBeenCalled();
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should handle notification with 204 response', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'agent',
        path: '/jsonrpc',
      });

      await transport.start();

      const createServerCall = vi.mocked(http.createServer).mock.calls[0];
      const requestHandler = createServerCall[0];

      const mockReq = new EventEmitter() as any;
      mockReq.method = 'POST';
      mockReq.url = '/jsonrpc';

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      requestHandler(mockReq, mockRes);

      const notification = JSON.stringify({
        jsonrpc: '2.0',
        method: 'notification',
        params: {},
      });

      mockReq.emit('data', notification);
      mockReq.emit('end');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes.writeHead).toHaveBeenCalledWith(204);
    });

    it('should return 404 for invalid path', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'agent',
        path: '/jsonrpc',
      });

      await transport.start();

      const createServerCall = vi.mocked(http.createServer).mock.calls[0];
      const requestHandler = createServerCall[0];

      const mockReq = new EventEmitter() as any;
      mockReq.method = 'POST';
      mockReq.url = '/invalid';

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      requestHandler(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should return 404 for non-POST method', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'agent',
        path: '/jsonrpc',
      });

      await transport.start();

      const createServerCall = vi.mocked(http.createServer).mock.calls[0];
      const requestHandler = createServerCall[0];

      const mockReq = new EventEmitter() as any;
      mockReq.method = 'GET';
      mockReq.url = '/jsonrpc';

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      requestHandler(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should handle invalid JSON with 400 response', async () => {
      const http = await import('http');
      const transport = new HttpTransport({
        mode: 'agent',
        path: '/jsonrpc',
      });

      await transport.start();

      const createServerCall = vi.mocked(http.createServer).mock.calls[0];
      const requestHandler = createServerCall[0];

      const mockReq = new EventEmitter() as any;
      mockReq.method = 'POST';
      mockReq.url = '/jsonrpc';

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      requestHandler(mockReq, mockRes);

      mockReq.emit('data', 'invalid json');
      mockReq.emit('end');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(mockRes.end).toHaveBeenCalledWith(
        expect.stringContaining('Parse error')
      );
    });
  });
});
