/**
 * Protocol Handler Demo
 *
 * Demonstrates usage of the JSON-RPC protocol handler.
 */

import {
  ProtocolHandler,
  parseMessage,
  serializeMessage,
  SessionNotFoundError,
  InvalidParamsError,
} from "../src/protocol/index.js";

// Create a protocol handler
const handler = new ProtocolHandler();

// Register a request handler for session/prompt
handler.onRequest("session/prompt", async (params) => {
  const { sessionId, content } = params as {
    sessionId: string;
    content: Array<{ type: string; text: string }>;
  };

  console.log(`Handling prompt for session: ${sessionId}`);
  console.log(`Content:`, content);

  // Simulate processing
  if (sessionId === "invalid") {
    throw new SessionNotFoundError(sessionId);
  }

  return {
    sessionId,
    messageId: "msg_123",
    status: "processing",
  };
});

// Register a notification handler for session/update
handler.onNotification("session/update", (params) => {
  console.log("Session update received:", params);
});

// Example 1: Handle a valid request
async function example1() {
  console.log("\n=== Example 1: Valid Request ===");

  const requestJson = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "session/prompt",
    params: {
      sessionId: "sess_abc123",
      content: [{ type: "text", text: "Hello, agent!" }],
    },
  });

  console.log("Request:", requestJson);

  const request = parseMessage(requestJson);
  const response = await handler.handleMessage(request);

  console.log("Response:", serializeMessage(response!));
}

// Example 2: Handle invalid session
async function example2() {
  console.log("\n=== Example 2: Invalid Session ===");

  const requestJson = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "session/prompt",
    params: {
      sessionId: "invalid",
      content: [{ type: "text", text: "Hello!" }],
    },
  });

  console.log("Request:", requestJson);

  const request = parseMessage(requestJson);
  const response = await handler.handleMessage(request);

  console.log("Response:", serializeMessage(response!));
}

// Example 3: Handle notification
async function example3() {
  console.log("\n=== Example 3: Notification ===");

  const notificationJson = JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId: "sess_abc123",
      type: "agent_message_chunk",
      data: { content: "Processing..." },
    },
  });

  console.log("Notification:", notificationJson);

  const notification = parseMessage(notificationJson);
  const response = await handler.handleMessage(notification);

  console.log("Response:", response === null ? "null (expected)" : response);
}

// Example 4: Method not found
async function example4() {
  console.log("\n=== Example 4: Method Not Found ===");

  const requestJson = JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "unknown/method",
    params: {},
  });

  console.log("Request:", requestJson);

  const request = parseMessage(requestJson);
  const response = await handler.handleMessage(request);

  console.log("Response:", serializeMessage(response!));
}

// Run all examples
async function main() {
  console.log("Protocol Handler Demo\n");

  try {
    await example1();
    await example2();
    await example3();
    await example4();

    console.log("\n=== Demo Complete ===");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
