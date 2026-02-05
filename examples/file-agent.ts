/**
 * File Agent Example
 *
 * An agent that can read and write files with permission requests.
 * Demonstrates tool calls, permission handling, and file system access.
 *
 * Usage: npx tsx examples/file-agent.ts
 *
 * Commands:
 *   read <path>              - Read a file
 *   write <path> <content>   - Write to a file (requires permission)
 *   list <directory>         - List files in a directory
 */

import { ACPAgent, StdioTransport } from '../src/index.js';

const transport = new StdioTransport({ mode: 'agent' });

const agent = new ACPAgent(transport, {
  name: 'File Agent',
  version: '1.0.0',
  capabilities: {
    prompt: {
      streaming: true,
      cancellation: false,
      attachments: false
    }
  }
});

agent.setPromptHandler({
  async handlePrompt(session, content) {
    // Extract text command
    const text = content.find(c => c.type === 'text')?.text?.trim() || '';

    if (!text) {
      await session.sendAgentMessage({
        type: 'text',
        text: 'Please provide a command: read <path>, write <path> <content>, or list <directory>'
      });
      return 'end_turn';
    }

    // Parse command
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();

    if (command === 'read') {
      // Read file command
      const path = parts.slice(1).join(' ');

      if (!path) {
        await session.sendAgentMessage({
          type: 'text',
          text: 'Usage: read <path>'
        });
        return 'end_turn';
      }

      // Start tool call for reading
      const toolCall = session.startToolCall({
        title: `Reading ${path}`,
        kind: 'read'
      });

      // Mark as in progress
      await toolCall.inProgress().send();

      try {
        // Read the file
        const fileContent = await session.readFile(path);

        // Complete tool call with file content
        await toolCall
          .addContent({ type: 'text', text: fileContent })
          .complete()
          .send();

        // Send summary message
        await session.sendAgentMessage({
          type: 'text',
          text: `Successfully read ${fileContent.length} characters from ${path}`
        });
      } catch (error) {
        // Report failure
        await toolCall.failed((error as Error).message).send();

        await session.sendAgentMessage({
          type: 'text',
          text: `Failed to read ${path}: ${(error as Error).message}`
        });
      }

    } else if (command === 'write') {
      // Write file command
      if (parts.length < 3) {
        await session.sendAgentMessage({
          type: 'text',
          text: 'Usage: write <path> <content>'
        });
        return 'end_turn';
      }

      const path = parts[1];
      const fileContent = parts.slice(2).join(' ');

      // Start tool call for writing
      const toolCall = session.startToolCall({
        title: `Writing to ${path}`,
        kind: 'edit'
      });

      // Request permission for write operation
      await toolCall.pending().send();

      const sentToolCall = await toolCall.send();
      const permission = await session.requestPermission(
        sentToolCall,
        [
          { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
          { optionId: 'deny', name: 'Deny', kind: 'reject_once' }
        ],
        `Allow writing to ${path}?`
      );

      if (permission.outcome === 'selected' && permission.optionId === 'allow') {
        // Permission granted, proceed with write
        await toolCall.inProgress().send();

        try {
          // Try to read existing content for diff
          let oldContent = '';
          try {
            oldContent = await session.readFile(path);
          } catch {
            // File doesn't exist, that's ok
          }

          // Write the file
          await session.writeFile(path, fileContent);

          // Complete with diff
          await toolCall
            .addDiff(path, oldContent, fileContent)
            .complete()
            .send();

          await session.sendAgentMessage({
            type: 'text',
            text: `Successfully wrote ${fileContent.length} characters to ${path}`
          });
        } catch (error) {
          await toolCall.failed((error as Error).message).send();

          await session.sendAgentMessage({
            type: 'text',
            text: `Failed to write to ${path}: ${(error as Error).message}`
          });
        }
      } else {
        // Permission denied
        await toolCall.denied().send();

        await session.sendAgentMessage({
          type: 'text',
          text: `Permission denied to write to ${path}`
        });
      }

    } else if (command === 'list') {
      // List directory command
      const dir = parts.slice(1).join(' ') || '.';

      const toolCall = session.startToolCall({
        title: `Listing ${dir}`,
        kind: 'read'
      });

      await toolCall.inProgress().send();

      try {
        // Use terminal to list files
        const terminal = await session.createTerminal('ls', ['-la', dir]);

        // Wait for completion
        await terminal.waitForExit();

        // Get output
        const result = await terminal.output();

        // Release terminal
        await terminal.release();

        // Complete with output
        await toolCall
          .addContent({ type: 'text', text: result.output })
          .complete()
          .send();

        await session.sendAgentMessage({
          type: 'text',
          text: `Directory listing complete`
        });
      } catch (error) {
        await toolCall.failed((error as Error).message).send();

        await session.sendAgentMessage({
          type: 'text',
          text: `Failed to list ${dir}: ${(error as Error).message}`
        });
      }

    } else {
      await session.sendAgentMessage({
        type: 'text',
        text: `Unknown command: ${command}\nAvailable commands: read, write, list`
      });
    }

    return 'end_turn';
  }
});

// Start the agent
agent.start().then(() => {
  console.error('File agent started and ready');
}).catch((error) => {
  console.error('Failed to start file agent:', error);
  process.exit(1);
});
