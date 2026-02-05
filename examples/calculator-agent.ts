/**
 * Calculator Agent Example
 *
 * An agent that performs mathematical calculations and shows its thinking process.
 * Demonstrates thinking updates, multi-step operations, and error handling.
 *
 * Usage: npx tsx examples/calculator-agent.ts
 *
 * Commands:
 *   add <a> <b>              - Add two numbers
 *   subtract <a> <b>         - Subtract b from a
 *   multiply <a> <b>         - Multiply two numbers
 *   divide <a> <b>           - Divide a by b
 *   sqrt <n>                 - Square root of n
 *   power <base> <exponent>  - Raise base to exponent
 *   eval <expression>        - Evaluate mathematical expression
 */

import { ACPAgent, StdioTransport } from '../src/index.js';

const transport = new StdioTransport({ mode: 'agent' });

const agent = new ACPAgent(transport, {
  name: 'Calculator Agent',
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
    // Extract command text
    const text = content.find(c => c.type === 'text')?.text?.trim() || '';

    if (!text) {
      await session.sendAgentMessage({
        type: 'text',
        text: 'Please provide a calculation command. Available: add, subtract, multiply, divide, sqrt, power, eval'
      });
      return 'end_turn';
    }

    // Parse command
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();

    try {
      // Send thinking update
      await session.updateThinking('Parsing command and preparing calculation...');

      switch (command) {
        case 'add': {
          const [_, a, b] = parts.map(Number);
          if (isNaN(a) || isNaN(b)) {
            throw new Error('Invalid numbers provided');
          }

          await session.updateThinking(`Adding ${a} + ${b}`);

          const result = a + b;

          await session.sendAgentMessage({
            type: 'text',
            text: `${a} + ${b} = ${result}`
          });
          break;
        }

        case 'subtract': {
          const [_, a, b] = parts.map(Number);
          if (isNaN(a) || isNaN(b)) {
            throw new Error('Invalid numbers provided');
          }

          await session.updateThinking(`Subtracting ${b} from ${a}`);

          const result = a - b;

          await session.sendAgentMessage({
            type: 'text',
            text: `${a} - ${b} = ${result}`
          });
          break;
        }

        case 'multiply': {
          const [_, a, b] = parts.map(Number);
          if (isNaN(a) || isNaN(b)) {
            throw new Error('Invalid numbers provided');
          }

          await session.updateThinking(`Multiplying ${a} × ${b}`);

          const result = a * b;

          await session.sendAgentMessage({
            type: 'text',
            text: `${a} × ${b} = ${result}`
          });
          break;
        }

        case 'divide': {
          const [_, a, b] = parts.map(Number);
          if (isNaN(a) || isNaN(b)) {
            throw new Error('Invalid numbers provided');
          }
          if (b === 0) {
            throw new Error('Cannot divide by zero');
          }

          await session.updateThinking(`Dividing ${a} by ${b}`);

          const result = a / b;

          await session.sendAgentMessage({
            type: 'text',
            text: `${a} ÷ ${b} = ${result}`
          });
          break;
        }

        case 'sqrt': {
          const [_, n] = parts.map(Number);
          if (isNaN(n)) {
            throw new Error('Invalid number provided');
          }
          if (n < 0) {
            throw new Error('Cannot take square root of negative number');
          }

          await session.updateThinking(`Calculating square root of ${n}`);

          const result = Math.sqrt(n);

          await session.sendAgentMessage({
            type: 'text',
            text: `√${n} = ${result}`
          });
          break;
        }

        case 'power': {
          const [_, base, exponent] = parts.map(Number);
          if (isNaN(base) || isNaN(exponent)) {
            throw new Error('Invalid numbers provided');
          }

          await session.updateThinking(`Calculating ${base} raised to power ${exponent}`);

          const result = Math.pow(base, exponent);

          await session.sendAgentMessage({
            type: 'text',
            text: `${base}^${exponent} = ${result}`
          });
          break;
        }

        case 'eval': {
          const expression = parts.slice(1).join(' ');

          await session.updateThinking(`Evaluating expression: ${expression}`);

          // Simple expression evaluation (safe for demo)
          // In production, use a proper math parser
          const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');

          if (sanitized !== expression) {
            throw new Error('Expression contains invalid characters');
          }

          try {
            // Use Function constructor for safer evaluation
            const result = new Function('return ' + sanitized)();

            await session.sendAgentMessage({
              type: 'text',
              text: `${expression} = ${result}`
            });
          } catch (error) {
            throw new Error('Invalid mathematical expression');
          }
          break;
        }

        default:
          await session.sendAgentMessage({
            type: 'text',
            text: `Unknown command: ${command}\nAvailable: add, subtract, multiply, divide, sqrt, power, eval`
          });
      }

      // Clear thinking after completion
      await session.updateThinking(undefined);

    } catch (error) {
      // Send error message
      await session.sendAgentMessage({
        type: 'text',
        text: `Error: ${(error as Error).message}`
      });

      // Clear thinking
      await session.updateThinking(undefined);
    }

    return 'end_turn';
  }
});

// Start the agent
agent.start().then(() => {
  console.error('Calculator agent started and ready');
}).catch((error) => {
  console.error('Failed to start calculator agent:', error);
  process.exit(1);
});
