import { describe, test, expect, vi, beforeEach } from 'vitest';
import { defineTask, Task } from '../../task';
import { createWorkflow, runWorkflow } from '../index';
import { configureWorkflowEngine, WorkflowLogger } from '../../config';
import { CephloError, ERROR_CODES } from '../../errors';

describe('Workflow Execution', () => {
  let task1: Task<any, any>;
  let task2: Task<any, any>;
  let task3: Task<any, any>;
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

  test('should error due to a circular dependency', () => {
    let task1: Task<any, any>;
    let task2: Task<any, any>;

    task1 = defineTask({
      name: 'task1',
      run: vi.fn().mockResolvedValue('result1'),
      // @ts-expect-error Circular dependency
      deps: [task2],
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

    expect(() =>
      createWorkflow({
        name: 'test-workflow',
        tasks: [task1, task2],
      })
    ).toThrow(CephloError);
  });

  test('should error when there are no tasks to run', async () => {
    task1.deps = [task2];

    const workflow = createWorkflow({
      name: 'test-workflow',
      tasks: [task1, task2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data');
    console.log(result);
    expect(result.status).toBe('failed');
    expect(result.error).toBeInstanceOf(CephloError);
    expect((result.error as CephloError)?.code).toBe(ERROR_CODES.NO_READY_TASKS);
  });
});
