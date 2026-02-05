/**
 * Tests for Session
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Session } from '../../src/client/Session.js';
import type { ACPClient } from '../../src/client/ACPClient.js';
import type { SessionUpdate } from '../../src/types/index.js';

// Mock ACPClient
class MockACPClient {
  public sendRequestMock = vi.fn();
  public sendNotificationMock = vi.fn();

  async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    return this.sendRequestMock(method, params);
  }

  async sendNotification(method: string, params?: unknown): Promise<void> {
    return this.sendNotificationMock(method, params);
  }
}

describe('Session', () => {
  let mockClient: MockACPClient;
  let session: Session;

  beforeEach(() => {
    mockClient = new MockACPClient();
    session = new Session('sess_123', mockClient as unknown as ACPClient, 'default');
  });

  describe('constructor', () => {
    it('should create session with ID and client', () => {
      expect(session.id).toBe('sess_123');
      expect(session.client).toBe(mockClient);
      expect(session.isActive).toBe(true);
      expect(session.currentMode).toBe('default');
    });

    it('should create session without initial mode', () => {
      const sessionNoMode = new Session('sess_456', mockClient as unknown as ACPClient);
      expect(sessionNoMode.currentMode).toBeUndefined();
    });
  });

  describe('prompt()', () => {
    it('should send prompt request', async () => {
      mockClient.sendRequestMock.mockResolvedValue({
        stopReason: 'end_turn',
        usage: {
          inputTokens: 10,
          outputTokens: 20,
        },
      });

      const result = await session.prompt([
        { type: 'text', text: 'Hello, agent!' },
      ]);

      expect(mockClient.sendRequestMock).toHaveBeenCalledWith('session/prompt', {
        sessionId: 'sess_123',
        content: [{ type: 'text', text: 'Hello, agent!' }],
      });

      expect(result).toEqual({
        stopReason: 'end_turn',
        usage: {
          inputTokens: 10,
          outputTokens: 20,
        },
      });
    });

    it('should throw if session is not active', async () => {
      session.deactivate();

      await expect(
        session.prompt([{ type: 'text', text: 'Hello' }])
      ).rejects.toThrow('Session sess_123 is no longer active');
    });

    it('should handle prompt without usage stats', async () => {
      mockClient.sendRequestMock.mockResolvedValue({
        stopReason: 'max_tokens',
        usage: undefined,
      });

      const result = await session.prompt([{ type: 'text', text: 'Test' }]);

      expect(result.stopReason).toBe('max_tokens');
      expect(result.usage).toBeUndefined();
    });
  });

  describe('cancel()', () => {
    it('should send cancel notification', async () => {
      await session.cancel();

      expect(mockClient.sendNotificationMock).toHaveBeenCalledWith('session/cancel', {
        sessionId: 'sess_123',
        reason: undefined,
      });
    });

    it('should send cancel with reason', async () => {
      await session.cancel('User requested stop');

      expect(mockClient.sendNotificationMock).toHaveBeenCalledWith('session/cancel', {
        sessionId: 'sess_123',
        reason: 'User requested stop',
      });
    });

    it('should throw if session is not active', async () => {
      session.deactivate();

      await expect(session.cancel()).rejects.toThrow('Session sess_123 is no longer active');
    });
  });

  describe('setMode()', () => {
    it('should set session mode', async () => {
      mockClient.sendRequestMock.mockResolvedValue({
        previousMode: 'default',
        currentMode: 'code',
      });

      const modeChangeHandler = vi.fn();
      session.on('modeChange', modeChangeHandler);

      await session.setMode('code');

      expect(mockClient.sendRequestMock).toHaveBeenCalledWith('session/set_mode', {
        sessionId: 'sess_123',
        mode: 'code',
      });

      expect(session.currentMode).toBe('code');
      expect(modeChangeHandler).toHaveBeenCalledWith('default', 'code');
    });

    it('should not emit modeChange if mode unchanged', async () => {
      mockClient.sendRequestMock.mockResolvedValue({
        previousMode: 'default',
        currentMode: 'default',
      });

      const modeChangeHandler = vi.fn();
      session.on('modeChange', modeChangeHandler);

      await session.setMode('default');

      expect(modeChangeHandler).not.toHaveBeenCalled();
    });

    it('should throw if session is not active', async () => {
      session.deactivate();

      await expect(session.setMode('code')).rejects.toThrow('Session sess_123 is no longer active');
    });
  });

  describe('setConfigOption()', () => {
    it('should set config option', async () => {
      mockClient.sendRequestMock.mockResolvedValue({
        key: 'verbose',
        previousValue: false,
        currentValue: true,
      });

      session.setConfigOptions([
        { id: 'verbose', label: 'Verbose Output', currentValueId: 'false' },
      ]);

      const configChangeHandler = vi.fn();
      session.on('configChange', configChangeHandler);

      await session.setConfigOption('verbose', 'true');

      expect(mockClient.sendRequestMock).toHaveBeenCalledWith('session/set_config_option', {
        sessionId: 'sess_123',
        key: 'verbose',
        value: 'true',
      });

      expect(configChangeHandler).toHaveBeenCalledWith('verbose', true);
      expect(session.configOptions[0].currentValueId).toBe('true');
    });

    it('should throw if session is not active', async () => {
      session.deactivate();

      await expect(session.setConfigOption('key', 'value')).rejects.toThrow(
        'Session sess_123 is no longer active'
      );
    });
  });

  describe('event handling', () => {
    it('should register and call update event handler', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);

      const update: SessionUpdate = {
        sessionId: 'sess_123',
        type: 'agent_message_chunk',
        data: {
          content: 'Hello',
          index: 0,
          final: true,
        },
      };

      session.handleUpdate(update);

      expect(updateHandler).toHaveBeenCalledWith(update);
    });

    it('should unregister event handler with off()', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);
      session.off('update', updateHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'agent_message_chunk',
        data: { content: 'Test', index: 0 },
      });

      expect(updateHandler).not.toHaveBeenCalled();
    });

    it('should emit modeChange on current_mode_update', () => {
      const modeChangeHandler = vi.fn();
      session.on('modeChange', modeChangeHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'current_mode_update',
        data: {
          previousMode: 'default',
          currentMode: 'architect',
        },
      });

      expect(session.currentMode).toBe('architect');
      expect(modeChangeHandler).toHaveBeenCalledWith('default', 'architect');
    });

    it('should emit configChange on config_option_update', () => {
      const configChangeHandler = vi.fn();
      session.on('configChange', configChangeHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'config_option_update',
        data: {
          key: 'autoApprove',
          previousValue: false,
          currentValue: true,
        },
      });

      expect(configChangeHandler).toHaveBeenCalledWith('autoApprove', true);
    });

    it('should emit commandsChange on available_commands update', () => {
      const commandsChangeHandler = vi.fn();
      session.on('commandsChange', commandsChangeHandler);

      const commands = [
        { name: 'help', description: 'Show help' },
        { name: 'exit', description: 'Exit session' },
      ];

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'available_commands',
        data: { commands },
      });

      expect(session.availableCommands).toEqual(commands);
      expect(commandsChangeHandler).toHaveBeenCalledWith(commands);
    });
  });

  describe('handleUpdate()', () => {
    it('should handle plan update', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'plan',
        data: {
          planId: 'plan_1',
          title: 'Test Plan',
          steps: [
            { id: 'step_1', description: 'Do something', status: 'pending' },
          ],
        },
      });

      expect(updateHandler).toHaveBeenCalled();
    });

    it('should handle agent_message_chunk update', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'agent_message_chunk',
        data: {
          content: 'Test message',
          index: 0,
          final: false,
        },
      });

      expect(updateHandler).toHaveBeenCalled();
    });

    it('should handle user_message_chunk update', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'user_message_chunk',
        data: {
          content: 'User input',
          index: 0,
          final: true,
        },
      });

      expect(updateHandler).toHaveBeenCalled();
    });

    it('should handle thought_message_chunk update', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'thought_message_chunk',
        data: {
          content: 'Thinking...',
          index: 0,
          visible: true,
        },
      });

      expect(updateHandler).toHaveBeenCalled();
    });

    it('should handle tool_call update', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'tool_call',
        data: {
          id: 'call_1',
          tool: 'read_file',
          input: { path: '/test/file.txt' },
          status: 'executing',
        },
      });

      expect(updateHandler).toHaveBeenCalled();
    });

    it('should handle tool_call_update', () => {
      const updateHandler = vi.fn();
      session.on('update', updateHandler);

      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'tool_call_update',
        data: {
          id: 'call_1',
          status: 'completed',
        },
      });

      expect(updateHandler).toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    it('should get current mode', () => {
      expect(session.currentMode).toBe('default');
    });

    it('should get available modes', () => {
      session.setAvailableModes(['default', 'code', 'architect']);
      expect(session.availableModes).toEqual(['default', 'code', 'architect']);
    });

    it('should return copy of available modes', () => {
      session.setAvailableModes(['default', 'code']);
      const modes = session.availableModes;
      modes.push('architect');

      expect(session.availableModes).toEqual(['default', 'code']);
    });

    it('should get config options', () => {
      const options = [
        { id: 'opt1', label: 'Option 1' },
        { id: 'opt2', label: 'Option 2' },
      ];
      session.setConfigOptions(options);

      expect(session.configOptions).toEqual(options);
    });

    it('should return copy of config options', () => {
      session.setConfigOptions([{ id: 'opt1', label: 'Option 1' }]);
      const options = session.configOptions;
      options.push({ id: 'opt2', label: 'Option 2' });

      expect(session.configOptions).toHaveLength(1);
    });

    it('should get available commands', () => {
      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'available_commands',
        data: {
          commands: [{ name: 'help', description: 'Show help' }],
        },
      });

      expect(session.availableCommands).toEqual([
        { name: 'help', description: 'Show help' },
      ]);
    });

    it('should return copy of available commands', () => {
      session.handleUpdate({
        sessionId: 'sess_123',
        type: 'available_commands',
        data: {
          commands: [{ name: 'help', description: 'Show help' }],
        },
      });

      const commands = session.availableCommands;
      commands.push({ name: 'exit', description: 'Exit' });

      expect(session.availableCommands).toHaveLength(1);
    });

    it('should check if session is active', () => {
      expect(session.isActive).toBe(true);

      session.deactivate();

      expect(session.isActive).toBe(false);
    });
  });

  describe('deactivate()', () => {
    it('should mark session as inactive', () => {
      expect(session.isActive).toBe(true);

      session.deactivate();

      expect(session.isActive).toBe(false);
    });

    it('should prevent operations after deactivation', async () => {
      session.deactivate();

      await expect(session.prompt([{ type: 'text', text: 'Test' }])).rejects.toThrow(
        'Session sess_123 is no longer active'
      );

      await expect(session.cancel()).rejects.toThrow('Session sess_123 is no longer active');

      await expect(session.setMode('code')).rejects.toThrow(
        'Session sess_123 is no longer active'
      );

      await expect(session.setConfigOption('key', 'value')).rejects.toThrow(
        'Session sess_123 is no longer active'
      );
    });
  });

  describe('setAvailableModes()', () => {
    it('should set available modes', () => {
      session.setAvailableModes(['default', 'code', 'architect']);

      expect(session.availableModes).toEqual(['default', 'code', 'architect']);
    });

    it('should allow empty modes array', () => {
      session.setAvailableModes([]);

      expect(session.availableModes).toEqual([]);
    });
  });

  describe('setConfigOptions()', () => {
    it('should set config options', () => {
      const options = [
        {
          id: 'verbose',
          label: 'Verbose Output',
          values: [
            { id: 'true', label: 'On' },
            { id: 'false', label: 'Off' },
          ],
          currentValueId: 'false',
        },
      ];

      session.setConfigOptions(options);

      expect(session.configOptions).toEqual(options);
    });

    it('should allow empty options array', () => {
      session.setConfigOptions([]);

      expect(session.configOptions).toEqual([]);
    });
  });
});
