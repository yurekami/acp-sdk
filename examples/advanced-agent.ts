/**
 * Advanced Agent Example
 *
 * Demonstrates advanced ACP features:
 * - Session modes (read_only, standard)
 * - Multi-turn conversations with context
 * - Plan management
 * - Complex tool call workflows
 *
 * Usage: npx tsx examples/advanced-agent.ts
 *
 * Commands:
 *   mode <read_only|standard>     - Change session mode
 *   plan <description>            - Create a plan
 *   status                        - Show current status
 *   analyze <path>                - Analyze a file
 *   help                          - Show available commands
 */

import { ACPAgent, StdioTransport } from '../src/index.js';
import type { Plan, SessionMode } from '../src/types/index.js';

const transport = new StdioTransport({ mode: 'agent' });

const agent = new ACPAgent(transport, {
  name: 'Advanced Agent',
  version: '1.0.0',
  capabilities: {
    loadSession: true,
    prompt: {
      streaming: true,
      cancellation: false,
      attachments: true
    }
  }
});

// Track current session state
const sessionState = new Map<string, {
  mode: SessionMode;
  currentPlan?: Plan;
  conversationHistory: string[];
}>();

agent.setPromptHandler({
  async handlePrompt(session, content) {
    // Initialize session state if needed
    if (!sessionState.has(session.sessionId)) {
      sessionState.set(session.sessionId, {
        mode: 'standard',
        conversationHistory: []
      });
    }

    const state = sessionState.get(session.sessionId)!;

    // Extract text command
    const text = content.find(c => c.type === 'text')?.text?.trim() || '';

    if (!text) {
      await session.sendAgentMessage({
        type: 'text',
        text: 'Please provide a command. Type "help" for available commands.'
      });
      return 'end_turn';
    }

    // Add to conversation history
    state.conversationHistory.push(`User: ${text}`);

    // Parse command
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();

    try {
      switch (command) {
        case 'help': {
          const helpText = `
Available Commands:
------------------
mode <read_only|standard>   - Change session mode
plan <description>          - Create a plan
status                      - Show current status
analyze <path>              - Analyze a file
history                     - Show conversation history
help                        - Show this help message
          `.trim();

          await session.sendAgentMessage({
            type: 'text',
            text: helpText
          });
          break;
        }

        case 'mode': {
          const newMode = parts[1] as SessionMode;

          if (newMode !== 'read_only' && newMode !== 'standard') {
            throw new Error('Invalid mode. Use "read_only" or "standard"');
          }

          await session.updateThinking(`Changing session mode to ${newMode}...`);

          // Change session mode
          const result = await session.setMode(newMode);

          state.mode = result.currentMode;

          await session.sendAgentMessage({
            type: 'text',
            text: `Session mode changed from ${result.previousMode} to ${result.currentMode}`
          });

          await session.updateThinking(undefined);
          break;
        }

        case 'plan': {
          const description = parts.slice(1).join(' ');

          if (!description) {
            throw new Error('Please provide a plan description');
          }

          await session.updateThinking('Creating plan...');

          // Create a plan
          const plan: Plan = {
            planId: `plan-${Date.now()}`,
            title: description,
            description: `Plan: ${description}`,
            steps: [
              {
                stepId: 'step-1',
                title: 'Analysis',
                description: 'Analyze requirements',
                status: 'pending'
              },
              {
                stepId: 'step-2',
                title: 'Implementation',
                description: 'Implement solution',
                status: 'pending'
              },
              {
                stepId: 'step-3',
                title: 'Verification',
                description: 'Verify results',
                status: 'pending'
              }
            ],
            status: 'pending',
            createdAt: new Date().toISOString()
          };

          state.currentPlan = plan;

          // Send plan update
          await session.updatePlan(plan);

          await session.sendAgentMessage({
            type: 'text',
            text: `Plan created with ${plan.steps.length} steps:\n${
              plan.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n')
            }`
          });

          await session.updateThinking(undefined);
          break;
        }

        case 'status': {
          const statusText = `
Current Status:
--------------
Session ID: ${session.sessionId}
Mode: ${state.mode}
Working Directory: ${session.workingDirectory}
Current Plan: ${state.currentPlan ? state.currentPlan.title : 'None'}
Conversation Turns: ${state.conversationHistory.length}
          `.trim();

          await session.sendAgentMessage({
            type: 'text',
            text: statusText
          });
          break;
        }

        case 'analyze': {
          const path = parts.slice(1).join(' ');

          if (!path) {
            throw new Error('Please provide a file path');
          }

          // Multi-step tool call workflow
          const readTool = session.startToolCall({
            title: `Reading ${path}`,
            kind: 'read'
          });

          await readTool.inProgress().send();

          try {
            const fileContent = await session.readFile(path);

            await readTool
              .addContent({ type: 'text', text: fileContent })
              .complete()
              .send();

            // Analyze the content
            await session.updateThinking('Analyzing file content...');

            const lines = fileContent.split('\n');
            const analysis = {
              totalLines: lines.length,
              totalChars: fileContent.length,
              blankLines: lines.filter(l => !l.trim()).length,
              hasImports: fileContent.includes('import'),
              hasExports: fileContent.includes('export')
            };

            // Create analysis tool call
            const analyzeTool = session.startToolCall({
              title: `Analyzing ${path}`,
              kind: 'search'
            });

            await analyzeTool.inProgress().send();

            const analysisText = `
File Analysis: ${path}
----------------------
Total Lines: ${analysis.totalLines}
Total Characters: ${analysis.totalChars}
Blank Lines: ${analysis.blankLines}
Has Imports: ${analysis.hasImports}
Has Exports: ${analysis.hasExports}
            `.trim();

            await analyzeTool
              .addContent({ type: 'text', text: analysisText })
              .complete()
              .send();

            await session.sendAgentMessage({
              type: 'text',
              text: analysisText
            });

            await session.updateThinking(undefined);
          } catch (error) {
            await readTool.failed((error as Error).message).send();
            throw error;
          }
          break;
        }

        case 'history': {
          const history = state.conversationHistory.join('\n');

          await session.sendAgentMessage({
            type: 'text',
            text: `Conversation History:\n${history}`
          });
          break;
        }

        default: {
          await session.sendAgentMessage({
            type: 'text',
            text: `Unknown command: ${command}\nType "help" for available commands.`
          });
        }
      }

      // Add agent response to history
      state.conversationHistory.push(`Agent: Processed ${command} command`);

    } catch (error) {
      await session.sendAgentMessage({
        type: 'text',
        text: `Error: ${(error as Error).message}`
      });

      await session.updateThinking(undefined);
    }

    return 'end_turn';
  }
});

// Start the agent
agent.start().then(() => {
  console.error('Advanced agent started and ready');
}).catch((error) => {
  console.error('Failed to start advanced agent:', error);
  process.exit(1);
});
