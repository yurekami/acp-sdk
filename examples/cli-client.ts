/**
 * CLI Client Example
 *
 * A simple command-line client that connects to an ACP agent.
 * Demonstrates client setup, session management, and interactive communication.
 *
 * Usage:
 *   npx tsx examples/cli-client.ts "npx tsx examples/echo-agent.ts"
 *   npx tsx examples/cli-client.ts "npx tsx examples/file-agent.ts"
 */

import * as readline from 'readline';
import {
  ACPClient,
  StdioTransport,
  createNodeFileSystemHandler,
  createNodeTerminalHandler,
  createConsolePermissionHandler
} from '../src/index.js';

// Parse command line arguments
const agentCommand = process.argv[2];

if (!agentCommand) {
  console.error('Usage: npx tsx examples/cli-client.ts "<agent-command>"');
  console.error('Example: npx tsx examples/cli-client.ts "npx tsx examples/echo-agent.ts"');
  process.exit(1);
}

// Parse command and args
const commandParts = agentCommand.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
const command = commandParts[0]?.replace(/"/g, '');
const args = commandParts.slice(1).map(arg => arg.replace(/"/g, ''));

if (!command) {
  console.error('Invalid command format');
  process.exit(1);
}

console.log(`Starting agent: ${command} ${args.join(' ')}`);

// Create transport to spawn agent process
const transport = new StdioTransport({
  mode: 'client',
  command,
  args
});

// Create client with capabilities
const client = new ACPClient(transport, {
  name: 'CLI Client',
  version: '1.0.0',
  capabilities: {
    fileSystem: { read: true, write: true },
    terminal: true
  }
});

// Set up handlers
client.setFileSystemHandler(createNodeFileSystemHandler(process.cwd()));
client.setTerminalHandler(createNodeTerminalHandler());
client.setPermissionHandler(createConsolePermissionHandler());

async function main() {
  try {
    // Connect to agent
    console.log('Connecting to agent...');
    await client.connect();
    console.log('Connected!');

    const agentInfo = client.getConnectedAgentInfo();
    if (agentInfo) {
      console.log(`Agent: ${agentInfo.name} v${agentInfo.version}`);
      console.log(`Capabilities:`, JSON.stringify(agentInfo.capabilities, null, 2));
    }

    // Create session
    console.log('Creating session...');
    const session = await client.createSession({
      workingDirectory: process.cwd()
    });
    console.log('Session created!\n');

    // Listen for session updates
    session.on('update', (update) => {
      if (update.type === 'agent_message_chunk') {
        // Stream agent messages to stdout
        const content = update.content;
        if (content.type === 'text') {
          process.stdout.write(content.text);
        }
      } else if (update.type === 'tool_call') {
        // Display tool calls
        console.log(`\n[Tool Call: ${update.title || 'Unnamed'}]`);
        if (update.status === 'complete') {
          console.log(`[Tool Call Complete]\n`);
        } else if (update.status === 'failed') {
          console.log(`[Tool Call Failed: ${update.errorMessage}]\n`);
        }
      } else if (update.type === 'thinking') {
        // Display thinking updates
        if (update.thinking) {
          console.log(`[Thinking: ${update.thinking}]`);
        }
      }
    });

    // Set up readline for interactive input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\n> '
    });

    console.log('Type your messages below. Type "exit" to quit.\n');
    rl.prompt();

    // Handle user input
    rl.on('line', async (line) => {
      const trimmed = line.trim();

      if (trimmed === 'exit' || trimmed === 'quit') {
        console.log('Disconnecting...');
        await client.disconnect();
        rl.close();
        process.exit(0);
      }

      if (!trimmed) {
        rl.prompt();
        return;
      }

      try {
        // Send prompt to agent
        await session.prompt([{ type: 'text', text: trimmed }]);
      } catch (error) {
        console.error(`\nError: ${(error as Error).message}`);
      }

      rl.prompt();
    });

    // Handle Ctrl+C
    rl.on('SIGINT', async () => {
      console.log('\nReceived SIGINT. Disconnecting...');
      await client.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
