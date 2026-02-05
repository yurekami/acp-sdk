/**
 * Echo Agent Example
 *
 * A simple agent that echoes back whatever the user sends.
 * Demonstrates basic agent setup, prompt handling, and streaming responses.
 *
 * Usage: npx tsx examples/echo-agent.ts
 */

import { ACPAgent, StdioTransport } from '../src/index.js';

// Create transport in agent mode (receives requests via stdio)
const transport = new StdioTransport({ mode: 'agent' });

// Create agent with basic capabilities
const agent = new ACPAgent(transport, {
  name: 'Echo Agent',
  version: '1.0.0',
  capabilities: {
    prompt: {
      streaming: true,
      cancellation: false,
      attachments: false
    }
  }
});

// Set up prompt handler
agent.setPromptHandler({
  async handlePrompt(session, content) {
    // Echo back each content block
    for (const block of content) {
      if (block.type === 'text') {
        // Send agent message with echo
        await session.sendAgentMessage({
          type: 'text',
          text: `Echo: ${block.text}`
        });
      } else if (block.type === 'image') {
        // Echo image information
        await session.sendAgentMessage({
          type: 'text',
          text: `Echo: Received image (format: ${block.format}, ${block.data.length} bytes)`
        });
      }
    }

    // End the turn
    return 'end_turn';
  }
});

// Start the agent
agent.start().then(() => {
  console.error('Echo agent started and ready');
}).catch((error) => {
  console.error('Failed to start echo agent:', error);
  process.exit(1);
});
