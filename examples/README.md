# ACP SDK Examples

This directory contains example implementations demonstrating how to use the ACP SDK.

## Quick Reference

| Example | Type | Complexity | Key Features |
|---------|------|------------|--------------|
| `echo-agent.ts` | Agent | Beginner | Basic agent setup, message handling |
| `file-agent.ts` | Agent | Intermediate | Tool calls, permissions, file I/O |
| `calculator-agent.ts` | Agent | Intermediate | Thinking updates, error handling |
| `advanced-agent.ts` | Agent | Advanced | Session modes, plans, state management |
| `cli-client.ts` | Client | Intermediate | Interactive REPL, handler setup |
| `protocol-handler-demo.ts` | Protocol | Advanced | Low-level protocol handling |

## Prerequisites

Make sure you have built the SDK:

```bash
cd ..
npm install
npm run build
```

## Running Examples

All examples use `tsx` for TypeScript execution without compilation:

```bash
npx tsx examples/<example-file>.ts
```

## Available Examples

### 1. Echo Agent (`echo-agent.ts`)

A simple agent that echoes back whatever the user sends.

**Demonstrates:**
- Basic agent setup
- Prompt handling
- Streaming agent messages

**Usage:**
```bash
# Run with CLI client
npx tsx examples/cli-client.ts "npx tsx examples/echo-agent.ts"

# Then type messages:
> Hello, agent!
Echo: Hello, agent!
```

### 2. File Agent (`file-agent.ts`)

An agent that can read and write files with permission requests.

**Demonstrates:**
- Tool calls (read/write/list operations)
- Permission requests for write operations
- File system access through the session
- Terminal commands for listing directories
- Diff generation for file edits

**Usage:**
```bash
# Run with CLI client
npx tsx examples/cli-client.ts "npx tsx examples/file-agent.ts"

# Available commands:
> read package.json           # Read a file
> write test.txt Hello World  # Write to a file (requires permission)
> list src                     # List files in directory
```

### 3. Calculator Agent (`calculator-agent.ts`)

An agent that performs mathematical calculations and shows its thinking process.

**Demonstrates:**
- Thinking updates during processing
- Multi-step operations
- Error handling and validation
- Command parsing and execution

**Usage:**
```bash
# Run with CLI client
npx tsx examples/cli-client.ts "npx tsx examples/calculator-agent.ts"

# Available commands:
> add 5 3              # Addition: 8
> subtract 10 4        # Subtraction: 6
> multiply 7 8         # Multiplication: 56
> divide 20 4          # Division: 5
> sqrt 16              # Square root: 4
> power 2 8            # Exponentiation: 256
> eval (5 + 3) * 2     # Expression evaluation: 16
```

### 4. Advanced Agent (`advanced-agent.ts`)

Demonstrates advanced ACP features like session modes, plans, and multi-step workflows.

**Demonstrates:**
- Session modes (read_only, standard)
- Plan creation and management
- Multi-turn conversation with state
- Complex tool call workflows
- Session state persistence

**Usage:**
```bash
# Run with CLI client
npx tsx examples/cli-client.ts "npx tsx examples/advanced-agent.ts"

# Available commands:
> help                          # Show help
> mode read_only                # Switch to read-only mode
> mode standard                 # Switch to standard mode
> plan "Build authentication"   # Create a plan
> status                        # Show current status
> analyze package.json          # Analyze a file
> history                       # Show conversation history
```

### 5. Protocol Handler Demo (`protocol-handler-demo.ts`)

A low-level example demonstrating direct usage of the JSON-RPC protocol handler.

**Demonstrates:**
- Direct protocol handler usage
- Request/response handling
- Notification handling
- Error handling at protocol level
- Message parsing and serialization

**Usage:**
```bash
npx tsx examples/protocol-handler-demo.ts
```

This example is useful for understanding the underlying protocol layer and for building custom transport implementations.

### 6. CLI Client (`cli-client.ts`)

A command-line client that connects to any ACP agent.

**Demonstrates:**
- Client setup and connection
- Session management
- Event handling for updates
- File system handler integration
- Terminal handler integration
- Permission handler integration
- Interactive REPL interface

**Usage:**
```bash
# Connect to echo agent
npx tsx examples/cli-client.ts "npx tsx examples/echo-agent.ts"

# Connect to file agent
npx tsx examples/cli-client.ts "npx tsx examples/file-agent.ts"

# Connect to calculator agent
npx tsx examples/cli-client.ts "npx tsx examples/calculator-agent.ts"

# Connect to advanced agent
npx tsx examples/cli-client.ts "npx tsx examples/advanced-agent.ts"

# Connect to any agent command
npx tsx examples/cli-client.ts "your-agent-command --args"
```

## Example Patterns

### Creating an Agent

```typescript
import { ACPAgent, StdioTransport } from '@anthropic/acp-sdk';

const transport = new StdioTransport({ mode: 'agent' });

const agent = new ACPAgent(transport, {
  name: 'My Agent',
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
    // Process user input
    await session.sendAgentMessage({
      type: 'text',
      text: 'Response'
    });
    return 'end_turn';
  }
});

await agent.start();
```

### Creating a Client

```typescript
import {
  ACPClient,
  StdioTransport,
  createNodeFileSystemHandler,
  createNodeTerminalHandler,
  createConsolePermissionHandler
} from '@anthropic/acp-sdk';

const transport = new StdioTransport({
  mode: 'client',
  command: 'agent-command',
  args: ['--stdio']
});

const client = new ACPClient(transport, {
  name: 'My Client',
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

// Connect
await client.connect();

// Create session
const session = await client.createSession({
  workingDirectory: process.cwd()
});

// Listen for updates
session.on('update', (update) => {
  console.log('Update:', update);
});

// Send prompt
await session.prompt([{ type: 'text', text: 'Hello!' }]);
```

### Tool Calls

```typescript
// Simple read operation
const toolCall = session.startToolCall({
  title: 'Reading file',
  kind: 'read'
});

await toolCall.inProgress().send();

try {
  const content = await session.readFile('/path/to/file');
  await toolCall
    .addContent({ type: 'text', text: content })
    .complete()
    .send();
} catch (error) {
  await toolCall.failed(error.message).send();
}
```

### Permission Requests

```typescript
// Write operation requiring permission
const toolCall = session.startToolCall({
  title: 'Writing file',
  kind: 'edit'
});

await toolCall.pending().send();

const sentToolCall = await toolCall.send();
const permission = await session.requestPermission(
  sentToolCall,
  [
    { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
    { optionId: 'deny', name: 'Deny', kind: 'reject_once' }
  ],
  'Allow writing to file?'
);

if (permission.outcome === 'selected' && permission.optionId === 'allow') {
  await toolCall.inProgress().send();
  await session.writeFile('/path/to/file', 'content');
  await toolCall.complete().send();
} else {
  await toolCall.denied().send();
}
```

### Terminal Commands

```typescript
// Execute a command
const terminal = await session.createTerminal('npm', ['test'], {
  cwd: session.workingDirectory,
  timeout: 60000
});

// Wait for completion
const status = await terminal.waitForExit();

// Get output
const result = await terminal.output();

console.log('Exit code:', status.exitCode);
console.log('Output:', result.output);

// Always release
await terminal.release();
```

## Building Your Own Agent

1. **Define your agent's capabilities**
   - What operations does it support?
   - Does it stream responses?
   - Does it handle cancellation?

2. **Implement the prompt handler**
   - Parse user input
   - Execute operations via tool calls
   - Request permissions for sensitive operations
   - Send responses via agent messages

3. **Handle tool calls properly**
   - Start with appropriate status (pending/inProgress)
   - Update status as operation progresses
   - Complete with results or fail with error message
   - Use appropriate tool call kind (read/edit/search/command)

4. **Request permissions when needed**
   - Always request permission for write operations
   - Provide clear permission options
   - Handle both granted and denied outcomes

5. **Use file system and terminal access**
   - Read files via `session.readFile()`
   - Write files via `session.writeFile()`
   - Execute commands via `session.createTerminal()`

## Testing Your Implementation

Test agents with the CLI client:

```bash
npx tsx examples/cli-client.ts "npx tsx your-agent.ts"
```

Test clients against the echo agent:

```bash
npx tsx your-client.ts "npx tsx examples/echo-agent.ts"
```

## Next Steps

- Read the [SDK documentation](../README.md)
- Explore the [type definitions](../src/types/)
- Check out the [test suite](../tests/) for more examples
- Review the [ACP specification](https://github.com/anthropics/acp-spec)

## Troubleshooting

### "Cannot find module" errors

Make sure you've built the SDK:
```bash
cd .. && npm run build
```

### Permission denied errors

The file agent requires proper file system permissions. Make sure:
- The working directory is accessible
- Files you're trying to read exist and are readable
- Files you're trying to write to are writable

### Agent not responding

Check stderr output for agent errors:
```bash
npx tsx examples/cli-client.ts "npx tsx examples/echo-agent.ts" 2>agent.log
```

### Transport errors

Ensure the agent command is correct and the agent starts successfully:
```bash
# Test agent directly first
npx tsx examples/echo-agent.ts
# Should output: "Echo agent started and ready"
```
