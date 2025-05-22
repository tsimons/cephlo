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
- 🎯 Input and output validation, BYO framework
- 📊 Pluggable logging and tracing
- 🎭 Hooks for workflow events
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
  run: async (apiUrl: string): Promise<{ foo: string }> => {
    const response = await fetch(apiUrl);
    return response.json();
  },
  inputSchema: z.string(),
  outputSchema: z.object({
    foo: z.string(),
  }),
});

const processData = defineTask({
  name: 'processData',
  // return types from dependent tasks map to run arguments
  run: async ([fetchDataResponse]) => {
    // Process the data
    return { processed: true, foo: fetchDataResponse.foo };
  },
  deps: [fetchData] as const,
  // typebox example
  outputSchema: ajv.compile(
    Type.Object({
      processed: Type.Boolean(),
      foo: Type.String(),
    })
  ),
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
  - Input schema only runs when the task has no deps
- Handle errors

```typescript
const task = defineTask({
  name: 'myTask',
  run: async (input: unknown, context?: WorkflowContext) => {
    // Task implementation
    return result;
  },
  deps: [
    /* dependent tasks */
  ],
  inputSchema: {
    /* Your favorite schema flavor */
  },
  outputSchema: {
    /* Your favorite schema flavor */
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
  validate: (data, schema) => {
    // zod
    const result = schema.safeParse(data);
    if (!result.success) throw new Error('Validation failed');
    return result.data; // Already validated + sanitized

    // typebox
    // ajv.compile called as schema definition
    const validateFn = schema;
    if (!validateFn(data)) throw new Error('Validation failed');
    return data; // stripped and validated
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
