import { describe, test, expect, vi, beforeEach } from 'vitest';
import { defineTask, Task } from '../../task';
import { createWorkflow, runWorkflow } from '../index';
import { configureWorkflowEngine, WorkflowLogger } from '../../config';

describe('Workflow Execution', () => {
  let task1: Task<unknown, unknown>;
  let task2: Task<unknown, unknown>;
  let task3: Task<unknown, unknown>;
  let mockLogger: WorkflowLogger;
  beforeEach(() => {
    vi.resetAllMocks();

    // Create mock tasks
    task1 = defineTask({
      name: 'task1',
      run: vi.fn().mockResolvedValue('result1'),
      deps: [],
      inputSchema: {},
      outputSchema: {},
    });

    task2 = defineTask({
      name: 'task2',
      run: vi.fn().mockResolvedValue('result2'),
      deps: [task1],
      inputSchema: {},
      outputSchema: {},
    });

    task3 = defineTask({
      name: 'task3',
      run: vi.fn().mockResolvedValue('result3'),
      deps: [task2],
      inputSchema: {},
      outputSchema: {},
    });

    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    configureWorkflowEngine({
      logger: mockLogger,
    });
  });

  test('should execute workflow with multiple tasks', async () => {
    const workflow = createWorkflow({
      name: 'test-workflow',
      tasks: [task1, task2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data');

    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBe('result2');
    expect(result.outputs.get('task3')).toBe('result3');
    expect(result.status).toBe('completed');

    // Verify task execution order
    expect(task1.run).toHaveBeenCalledWith('initial-data', undefined);
    expect(task2.run).toHaveBeenCalledWith(['result1'], undefined);
    expect(task3.run).toHaveBeenCalledWith(['result2'], undefined);
  });

  test('should handle task failure in workflow', async () => {
    const error = new Error('Task failed');
    task2.run = vi.fn().mockRejectedValue(error);

    const workflowErrorHandler = vi.fn();
    const taskErrorHandler = vi.fn();

    const workflow = createWorkflow({
      name: 'test-workflow',
      tasks: [task1, task2, task3],
      hooks: {
        onWorkflowError: workflowErrorHandler,
        onTaskError: taskErrorHandler,
      },
    });
    const result = await runWorkflow(workflow, {});

    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBeUndefined();
    expect(result.outputs.get('task3')).toBeUndefined();
    expect(workflowErrorHandler).toHaveBeenCalled();
    expect(taskErrorHandler).toHaveBeenCalled();
    expect(result.status).toBe('failed');
  });

  test('should execute workflow with parallel tasks', async () => {
    const parallelTask1 = {
      name: 'parallel1',
      run: vi.fn().mockResolvedValue('parallel1-result'),
      deps: [task1],
      inputSchema: {},
      outputSchema: {},
    };

    const parallelTask2 = {
      name: 'parallel2',
      run: vi.fn().mockResolvedValue('parallel2-result'),
      deps: [task1],
      inputSchema: {},
      outputSchema: {},
    };

    const workflow = createWorkflow({
      name: 'test-workflow',
      tasks: [task1, parallelTask1, parallelTask2, task3],
    });
    const result = await runWorkflow(workflow, {});

    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('parallel1')).toBe('parallel1-result');
    expect(result.outputs.get('parallel2')).toBe('parallel2-result');
    expect(result.outputs.get('task3')).toBe('result3');
    expect(result.status).toBe('completed');
  });

  test('should call workflow hooks', async () => {
    const hooks = {
      onWorkflowStart: vi.fn(),
      onWorkflowEnd: vi.fn(),
      onWorkflowError: vi.fn(),
      onTaskStart: vi.fn(),
      onTaskEnd: vi.fn(),
      onTaskError: vi.fn(),
      onTaskSuccess: vi.fn(),
      onTaskRetry: vi.fn(),
    };

    const workflow = createWorkflow({
      name: 'test-workflow',
      tasks: [task1, task2, task3],
      hooks,
    });
    await runWorkflow(workflow, {});

    expect(hooks.onWorkflowStart).toHaveBeenCalled();
    expect(hooks.onWorkflowEnd).toHaveBeenCalled();
    expect(hooks.onTaskStart).toHaveBeenCalledTimes(3);
    expect(hooks.onTaskEnd).toHaveBeenCalledTimes(3);
    expect(hooks.onTaskSuccess).toHaveBeenCalledTimes(3);
  });
});
