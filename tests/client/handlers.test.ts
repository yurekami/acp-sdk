/**
 * Tests for handler implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createNodeFileSystemHandler,
  createNodeTerminalHandler,
  createConsolePermissionHandler,
  createAutoApproveHandler,
  createAutoDenyHandler,
} from '../../src/client/handlers.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolCall } from '../../src/types/index.js';

// Mock fs module
vi.mock('fs/promises');

// Mock child_process module
vi.mock('child_process', () => {
  const EventEmitter = require('events');

  class MockChildProcess extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    pid = 12345;

    kill(signal?: string) {
      // Simulate process termination
      setTimeout(() => {
        this.emit('close', 0, signal || null);
      }, 10);
      return true;
    }
  }

  return {
    spawn: vi.fn((command: string, args?: string[], options?: any) => {
      const proc = new MockChildProcess();

      // Simulate process lifecycle
      setTimeout(() => {
        if (command === 'echo') {
          proc.stdout.emit('data', Buffer.from('hello\n'));
          proc.emit('close', 0, null);
        } else if (command === 'error-command') {
          proc.stderr.emit('data', Buffer.from('error\n'));
          proc.emit('close', 1, null);
        } else if (command === 'sleep') {
          // Long-running process
          setTimeout(() => {
            proc.emit('close', 0, null);
          }, 5000);
        } else {
          proc.emit('close', 0, null);
        }
      }, 10);

      return proc;
    }),
  };
});

// Mock readline module
vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((query: string, callback: (answer: string) => void) => {
      // Auto-respond 'y' for tests
      callback('y');
    }),
    close: vi.fn(),
  })),
}));

describe('createNodeFileSystemHandler', () => {
  const workingDir = '/test/project';
  let handler: ReturnType<typeof createNodeFileSystemHandler>;

  beforeEach(() => {
    handler = createNodeFileSystemHandler(workingDir);
    vi.clearAllMocks();
  });

  describe('readTextFile()', () => {
    it('should read entire file', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await handler.readTextFile('/test/project/file.txt');

      expect(result).toEqual({
        content,
        encoding: 'utf-8',
        totalLines: 5,
        truncated: false,
      });

      expect(fs.readFile).toHaveBeenCalledWith('/test/project/file.txt', 'utf-8');
    });

    it('should read absolute path file', async () => {
      const content = 'absolute content';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await handler.readTextFile('/absolute/path/file.txt');

      expect(result).toEqual({
        content,
        encoding: 'utf-8',
        totalLines: 1,
        truncated: false,
      });

      expect(fs.readFile).toHaveBeenCalledWith('/absolute/path/file.txt', 'utf-8');
    });

    it('should read file with line range', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await handler.readTextFile('/test/project/file.txt', 2, 4);

      expect(result).toEqual({
        content: 'line2\nline3\nline4',
        encoding: 'utf-8',
        totalLines: 5,
        truncated: true,
      });
    });

    it('should read from start line only', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await handler.readTextFile('/test/project/file.txt', 3);

      expect(result).toEqual({
        content: 'line3\nline4\nline5',
        encoding: 'utf-8',
        totalLines: 5,
        truncated: true,
      });
    });

    it('should read to end line only', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await handler.readTextFile('/test/project/file.txt', undefined, 3);

      expect(result).toEqual({
        content: 'line1\nline2\nline3',
        encoding: 'utf-8',
        totalLines: 5,
        truncated: true,
      });
    });

    it('should handle read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await expect(handler.readTextFile('/test/project/missing.txt')).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('writeTextFile()', () => {
    it('should write new file', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const content = 'Hello, World!';
      const result = await handler.writeTextFile('/test/project/new.txt', content);

      expect(result).toEqual({
        bytesWritten: 13,
        created: true,
      });

      expect(fs.mkdir).toHaveBeenCalledWith('/test/project', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith('/test/project/new.txt', content, 'utf-8');
    });

    it('should write existing file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const content = 'Updated content';
      const result = await handler.writeTextFile('/test/project/existing.txt', content);

      expect(result).toEqual({
        bytesWritten: 15,
        created: false,
      });

      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith('/test/project/existing.txt', content, 'utf-8');
    });

    it('should create parent directories for new file', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await handler.writeTextFile('/test/project/deep/nested/file.txt', 'content');

      expect(fs.mkdir).toHaveBeenCalledWith('/test/project/deep/nested', { recursive: true });
    });

    it('should handle absolute paths', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await handler.writeTextFile('/absolute/path/file.txt', 'content');

      expect(fs.mkdir).toHaveBeenCalledWith('/absolute/path', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith('/absolute/path/file.txt', 'content', 'utf-8');
    });

    it('should handle write errors', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      await expect(handler.writeTextFile('/test/project/file.txt', 'content')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should calculate correct byte count for UTF-8', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const content = 'Hello, 世界!'; // Contains multi-byte characters
      const result = await handler.writeTextFile('/test/project/unicode.txt', content);

      expect(result.bytesWritten).toBeGreaterThan(content.length);
    });
  });
});

describe('createNodeTerminalHandler', () => {
  let handler: ReturnType<typeof createNodeTerminalHandler>;

  beforeEach(() => {
    handler = createNodeTerminalHandler();
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('should create terminal and execute command', async () => {
      const result = await handler.create('echo', ['hello']);

      expect(result).toEqual({
        terminalId: 'term_1',
        pid: 12345,
      });
    });

    it('should create terminal with options', async () => {
      const result = await handler.create('npm', ['test'], {
        cwd: '/test/project',
        env: { NODE_ENV: 'test' },
      });

      // Each test gets a fresh handler, so terminalId starts from 1
      expect(result).toMatchObject({
        terminalId: 'term_1',
        pid: 12345,
      });
    });

    it('should increment terminal IDs', async () => {
      const result1 = await handler.create('echo', ['1']);
      const result2 = await handler.create('echo', ['2']);
      const result3 = await handler.create('echo', ['3']);

      // Each test gets a fresh handler starting from term_1
      expect(result1.terminalId).toBe('term_1');
      expect(result2.terminalId).toBe('term_2');
      expect(result3.terminalId).toBe('term_3');
    });

    it('should handle timeout option', async () => {
      const result = await handler.create('sleep', ['10'], { timeout: 100 });

      expect(result.terminalId).toBeDefined();
    }, 1000);
  });

  describe('output()', () => {
    it('should return terminal output', async () => {
      const { terminalId } = await handler.create('echo', ['hello']);

      // Wait for command to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = await handler.output(terminalId);

      expect(output).toEqual({
        stdout: 'hello\n',
        stderr: '',
        complete: true,
      });
    });

    it('should return partial output while running', async () => {
      const { terminalId } = await handler.create('sleep', ['10']);

      const output = await handler.output(terminalId);

      expect(output).toEqual({
        stdout: '',
        stderr: '',
        complete: false,
      });
    });

    it('should throw for non-existent terminal', async () => {
      await expect(handler.output('term_nonexistent')).rejects.toThrow(
        'Terminal not found: term_nonexistent'
      );
    });

    it('should capture stderr', async () => {
      const { terminalId } = await handler.create('error-command');

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = await handler.output(terminalId);

      expect(output.stderr).toBe('error\n');
      expect(output.complete).toBe(true);
    });
  });

  describe('waitForExit()', () => {
    it('should wait for terminal to exit', async () => {
      const { terminalId } = await handler.create('echo', ['hello']);

      const exitStatus = await handler.waitForExit(terminalId);

      expect(exitStatus).toMatchObject({
        exitCode: 0,
        timedOut: false,
      });
      expect(exitStatus.duration).toBeGreaterThan(0);
    });

    it('should return immediately if already exited', async () => {
      const { terminalId } = await handler.create('echo', ['hello']);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const exitStatus = await handler.waitForExit(terminalId);

      expect(exitStatus.exitCode).toBe(0);
    });

    it('should handle timeout', async () => {
      const { terminalId } = await handler.create('sleep', ['10']);

      const exitStatus = await handler.waitForExit(terminalId, 50);

      expect(exitStatus).toMatchObject({
        exitCode: null,
        timedOut: true,
      });
    }, 1000);

    it('should throw for non-existent terminal', async () => {
      await expect(handler.waitForExit('term_nonexistent')).rejects.toThrow(
        'Terminal not found: term_nonexistent'
      );
    });

    it('should capture exit code', async () => {
      const { terminalId } = await handler.create('error-command');

      const exitStatus = await handler.waitForExit(terminalId);

      expect(exitStatus.exitCode).toBe(1);
    });
  });

  describe('kill()', () => {
    it('should kill terminal process', async () => {
      const { terminalId } = await handler.create('sleep', ['10']);

      await handler.kill(terminalId);

      // Wait for kill to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const exitStatus = await handler.waitForExit(terminalId);
      expect(exitStatus.exitCode).toBeDefined();
    });

    it('should kill with custom signal', async () => {
      const { terminalId } = await handler.create('sleep', ['10']);

      await handler.kill(terminalId, 'SIGKILL');

      await new Promise((resolve) => setTimeout(resolve, 50));

      const exitStatus = await handler.waitForExit(terminalId);
      expect(exitStatus.exitCode).toBeDefined();
    });

    it('should throw for non-existent terminal', async () => {
      await expect(handler.kill('term_nonexistent')).rejects.toThrow(
        'Terminal not found: term_nonexistent'
      );
    });
  });

  describe('release()', () => {
    it('should release terminal resources', async () => {
      const { terminalId } = await handler.create('echo', ['hello']);

      await new Promise((resolve) => setTimeout(resolve, 50));

      await handler.release(terminalId);

      // Terminal should no longer be found
      await expect(handler.output(terminalId)).rejects.toThrow('Terminal not found');
    });

    it('should kill running process before release', async () => {
      const { terminalId } = await handler.create('sleep', ['10']);

      await handler.release(terminalId);

      // Should not throw
      await expect(handler.output(terminalId)).rejects.toThrow('Terminal not found');
    });

    it('should not throw for non-existent terminal', async () => {
      await expect(handler.release('term_nonexistent')).resolves.toBeUndefined();
    });
  });
});

describe('createConsolePermissionHandler', () => {
  let handler: ReturnType<typeof createConsolePermissionHandler>;

  beforeEach(() => {
    handler = createConsolePermissionHandler();
  });

  it('should grant permission on "y" response', async () => {
    const toolCall: ToolCall = {
      id: 'call_1',
      tool: 'read_file',
      input: { path: '/test/file.txt' },
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(toolCall, []);

    expect(result).toEqual({
      granted: true,
      remember: false,
      scope: 'once',
    });
  });

  it('should handle permission options', async () => {
    const readline = await import('readline');
    const mockInterface = {
      question: vi.fn((query: string, callback: (answer: string) => void) => {
        callback('always');
      }),
      close: vi.fn(),
    };

    vi.mocked(readline.createInterface).mockReturnValue(mockInterface as any);

    const toolCall: ToolCall = {
      id: 'call_2',
      tool: 'write_file',
      input: { path: '/test/file.txt' },
      status: 'awaiting_permission',
    };

    const options = [
      { id: 'once', label: 'Once', isDefault: true },
      { id: 'always', label: 'Always' },
    ];

    const result = await handler.requestPermission(toolCall, options);

    expect(result).toEqual({
      granted: true,
      remember: true,
      scope: 'always',
    });
  });

  it('should deny permission on "n" response', async () => {
    const readline = await import('readline');
    const mockInterface = {
      question: vi.fn((query: string, callback: (answer: string) => void) => {
        callback('n');
      }),
      close: vi.fn(),
    };

    vi.mocked(readline.createInterface).mockReturnValue(mockInterface as any);

    const toolCall: ToolCall = {
      id: 'call_3',
      tool: 'execute',
      input: { command: 'rm -rf /' },
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(toolCall, []);

    expect(result).toEqual({
      granted: false,
      reason: 'User denied',
    });
  });

  it('should handle "never" response', async () => {
    const readline = await import('readline');
    const mockInterface = {
      question: vi.fn((query: string, callback: (answer: string) => void) => {
        callback('never');
      }),
      close: vi.fn(),
    };

    vi.mocked(readline.createInterface).mockReturnValue(mockInterface as any);

    const toolCall: ToolCall = {
      id: 'call_4',
      tool: 'dangerous_tool',
      input: {},
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(toolCall, []);

    expect(result).toEqual({
      granted: false,
      remember: true,
      reason: 'User permanently denied',
    });
  });
});

describe('createAutoApproveHandler', () => {
  it('should always grant permission', async () => {
    const handler = createAutoApproveHandler();

    const toolCall: ToolCall = {
      id: 'call_1',
      tool: 'any_tool',
      input: {},
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(toolCall, []);

    expect(result).toEqual({
      granted: true,
      remember: false,
      scope: 'once',
    });
  });

  it('should grant regardless of tool type', async () => {
    const handler = createAutoApproveHandler();

    const dangerousTool: ToolCall = {
      id: 'call_2',
      tool: 'execute',
      input: { command: 'rm -rf /' },
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(dangerousTool, []);

    expect(result.granted).toBe(true);
  });
});

describe('createAutoDenyHandler', () => {
  it('should always deny permission with default reason', async () => {
    const handler = createAutoDenyHandler();

    const toolCall: ToolCall = {
      id: 'call_1',
      tool: 'any_tool',
      input: {},
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(toolCall, []);

    expect(result).toEqual({
      granted: false,
      reason: 'Permission denied by policy',
    });
  });

  it('should deny with custom reason', async () => {
    const handler = createAutoDenyHandler('Read-only mode active');

    const toolCall: ToolCall = {
      id: 'call_2',
      tool: 'write_file',
      input: { path: '/test/file.txt' },
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(toolCall, []);

    expect(result).toEqual({
      granted: false,
      reason: 'Read-only mode active',
    });
  });

  it('should deny regardless of tool type', async () => {
    const handler = createAutoDenyHandler('Security policy');

    const safeTool: ToolCall = {
      id: 'call_3',
      tool: 'read_file',
      input: { path: '/public/readme.txt' },
      status: 'awaiting_permission',
    };

    const result = await handler.requestPermission(safeTool, []);

    expect(result.granted).toBe(false);
  });
});
