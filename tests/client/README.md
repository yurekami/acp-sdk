# Client Module Tests

Comprehensive test suite for the ACP SDK client module.

## Test Files

### 1. ACPClient.simple.test.ts (13 tests)
Tests for the main ACPClient class:
- Constructor with various options
- Session management (create, load, getSession)
- Handler registration (file system, terminal, permission)
- Event handling (errors, updates)
- Incoming request handling (fs/read_text_file, terminal/create, permission requests)
- Transport close handling

### 2. Session.test.ts (38 tests)
Tests for the Session class:
- Constructor initialization
- prompt() - sending prompts to agent
- cancel() - cancelling operations
- setMode() - changing session modes
- setConfigOption() - setting configuration
- Event handling (update, modeChange, configChange, commandsChange)
- handleUpdate() for all update types
- Getters (currentMode, availableModes, configOptions, availableCommands, isActive)
- deactivate() - session lifecycle
- Internal methods (setAvailableModes, setConfigOptions)

### 3. handlers.test.ts (40 tests)
Tests for default handler implementations:

**createNodeFileSystemHandler:**
- readTextFile() - full file, absolute paths, line ranges
- writeTextFile() - new files, existing files, directory creation, error handling

**createNodeTerminalHandler:**
- create() - spawning processes with options
- output() - retrieving stdout/stderr
- waitForExit() - exit status and timeouts
- kill() - terminating processes
- release() - cleaning up resources

**createConsolePermissionHandler:**
- User prompts for various responses (y/n/always/never)
- Permission options display

**createAutoApproveHandler:**
- Always grants permission

**createAutoDenyHandler:**
- Always denies with custom reason

## Known Issues

### ACPClient.connect() Bug

**Location:** `src/client/ACPClient.ts` lines 163-197

**Issue:** The `connect()` method calls `sendRequest('initialize')` at line 172, but `sendRequest()` calls `ensureConnected()` at line 457, which throws "Client is not connected" because `_connected` is still false during initialization. This creates a chicken-and-egg problem.

**Impact:** The client cannot actually connect as currently implemented.

**Reproduction:**
```bash
npm run example:echo
# Error: Client is not connected
```

**Proposed Fixes:**
1. Skip `ensureConnected()` check when method === "initialize"
2. Set `_connected = true` immediately after `transport.start()` (line 169)
3. Add `_initializing` flag to bypass the check during initialization

**Test Workaround:** Tests use a `simulateConnect()` helper that manually sets `_connected = true` and `_agentInfo` to bypass this bug.

## Running Tests

```bash
# Run all client tests
npm test -- tests/client/

# Run specific test file
npm test -- tests/client/Session.test.ts

# Run with coverage
npm run test:coverage -- tests/client/
```

## Test Coverage

- **ACPClient:** Constructor, session management, handlers, events, request handling
- **Session:** All operations, events, lifecycle, getters
- **Handlers:** File system (read/write), terminal (create/kill/release), permissions (approve/deny)

All tests use proper mocking with vitest to avoid external dependencies.

## Notes

- Tests use mock transports and handlers to isolate functionality
- File system tests mock `fs/promises` module
- Terminal tests mock `child_process` module
- Permission tests mock `readline` module for user input simulation
