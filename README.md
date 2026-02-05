# ACP SDK

TypeScript SDK for the Anthropic Communication Protocol (ACP).

## Overview

The Anthropic Communication Protocol (ACP) enables seamless communication between AI agents and external systems using a JSON-RPC 2.0 based protocol. This SDK provides type-safe TypeScript implementations for both clients and agents.

## Features

- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Multiple Transports**: Support for stdio, HTTP/SSE, and WebSocket
- **JSON-RPC 2.0**: Standard protocol implementation
- **Event-Driven**: Built on EventEmitter3 for flexible event handling
- **Validation**: Zod-based schema validation for all protocol messages
- **Extensible**: Easy to extend with custom transports and handlers

## Installation

```bash
npm install @anthropic/acp-sdk
```

## Quick Start

### Creating an Agent

```typescript
import { Agent } from '@anthropic/acp-sdk';

const agent = new Agent({
  name: 'my-agent',
  version: '1.0.0',
});

// Add tool handlers
agent.addTool({
  name: 'echo',
  description: 'Echo back the input',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' }
    }
  },
  handler: async (params) => {
    return { content: [{ type: 'text', text: params.message }] };
  }
});

// Start the agent
await agent.start();
```

### Creating a Client

```typescript
import { Client } from '@anthropic/acp-sdk';

const client = new Client({
  transport: 'stdio',
  command: 'node',
  args: ['./my-agent.js']
});

// Connect to the agent
await client.connect();

// Call a tool
const result = await client.callTool('echo', { message: 'Hello!' });
console.log(result);

// Disconnect
await client.disconnect();
```

## Project Structure

```
acp-sdk/
├── src/
│   ├── types/          # Protocol type definitions
│   ├── transport/      # Transport layer implementations
│   ├── client/         # ACP Client implementation
│   ├── agent/          # ACP Agent implementation
│   ├── protocol/       # JSON-RPC protocol handling
│   ├── utils/          # Utility functions
│   └── index.ts        # Main entry point
├── examples/           # Example implementations
├── tests/              # Test files
└── package.json
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Documentation

For detailed documentation, see the [docs](./docs) directory.

## License

MIT
