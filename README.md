# Cephlo

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-text--dark.png" alt="Cephlo logo">
  <source media="(prefers-color-scheme: light)" srcset="assets/logo-text--light.png" alt="Cephlo logo">
  <img alt="Cephlo logo" src="default-image.png">
</picture>

A TypeScript workflow management tool for composable task execution. Cephlo helps you build and manage complex workflows by breaking them down into smaller, reusable tasks.

## Features

- 🧩 Composable task-based workflows
- 🔄 Automatic retry handling
- 🎯 Input and output validation
- 📊 Built-in logging and tracing
- 🎭 Customizable hooks for workflow events
- ⚡ Parallel task execution
- 🛡️ Type-safe task definitions

## Installation

```bash
npm install cephlo
# or
yarn add cephlo
# or
pnpm add cephlo
```

## Quick Start

```typescript
import { defineTask, createWorkflow, runWorkflow } from 'cephlo';

// Define tasks
const fetchData = defineTask({
  name: 'fetchData',
  run: async (input: string) => {
    const response = await fetch(input);
    return response.json();
  },
  inputSchema: { type: 'string' },
  outputSchema: { type: 'object' },
});

const processData = defineTask({
  name: 'processData',
  run: async (data: any) => {
    // Process the data
    return { processed: true, ...data };
  },
  deps: [fetchData],
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
});

// Create a workflow
const workflow = createWorkflow({
  name: 'dataProcessing',
  tasks: [fetchData, processData],
});

// Run the workflow
const result = await runWorkflow(workflow, 'https://api.example.com/data');

if (result.status === 'completed') {
  console.log('Workflow completed successfully!');
  console.log('Processed data:', result.outputs.get('processData'));
} else {
  console.error('Workflow failed:', result.error);
}
```

## Task Definition

Tasks are the building blocks of workflows. Each task can:

- Accept inputs
- Return outputs
- Depend on other tasks
- Define input and output schemas
- Handle errors

```typescript
const task = defineTask({
  name: 'myTask',
  run: async (input: any, context?: WorkflowContext) => {
    // Task implementation
    return result;
  },
  deps: [
    /* dependent tasks */
  ],
  inputSchema: {
    /* JSON Schema */
  },
  outputSchema: {
    /* JSON Schema */
  },
});
```

## Workflow Configuration

Configure the workflow engine with custom settings:

```typescript
import { configureWorkflowEngine } from 'cephlo';

configureWorkflowEngine({
  defaultTaskTimeoutMs: 5000,
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 1000,
  },
  logger: {
    info: console.info,
    debug: console.debug,
    error: console.error,
    warn: console.warn,
  },
  validator: {
    validate: (data, schema) => {
      // Custom validation logic
      return true;
    },
    sanitize: (data, schema) => {
      // Custom sanitization logic
      return data;
    },
  },
});
```

## Error Handling

Cephlo provides robust error handling with automatic retries:

```typescript
const workflow = createWorkflow({
  name: 'errorHandling',
  tasks: [task1, task2],
  hooks: {
    onTaskError: (error, context) => {
      // Custom error handling
      // Return true to skip retry, false to allow retry
      return false;
    },
    onWorkflowError: (error, context) => {
      // Handle workflow-level errors
    },
  },
});
```

## Hooks

Customize workflow behavior with hooks:

```typescript
const workflow = createWorkflow({
  name: 'withHooks',
  tasks: [task1, task2],
  hooks: {
    onWorkflowStart: context => {
      console.log('Workflow started');
    },
    onWorkflowEnd: context => {
      console.log('Workflow ended');
    },
    onTaskStart: context => {
      console.log('Task started:', context.task.name);
    },
    onTaskEnd: (error, result, context) => {
      console.log('Task ended:', context.task.name);
    },
    onTaskSuccess: (result, context) => {
      console.log('Task succeeded:', context.task.name);
    },
    onTaskError: (error, context) => {
      console.error('Task failed:', context.task.name);
      return false; // Allow retry
    },
    onTaskRetry: context => {
      console.log('Retrying task:', context.task.name);
    },
  },
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage

# Lint the code
pnpm run lint

# Format the code
pnpm run format
```

## License

MIT © [Tj Simons](https://github.com/tjsimons)
