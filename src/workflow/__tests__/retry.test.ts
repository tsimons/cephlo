import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Task } from '../../task';
import { createWorkflow, runWorkflow } from '../index';
import { WorkflowContext } from '../../task';
import { configureWorkflowEngine, WorkflowLogger, WorkflowValidator } from '../../config';

describe('Workflow Retry Logic', () => {
  let task1: Task<any[], any>;
  let task2: Task<any[], any>;
  let task3: Task<any[], any>;
  let mockContext: WorkflowContext;
  let mockValidator: WorkflowValidator;
  let mockLogger: WorkflowLogger;
  beforeEach(() => {
    vi.resetAllMocks();

    // Create mock tasks
    task1 = {
      name: 'task1',
      run: vi.fn().mockResolvedValue('result1'),
      deps: [],
      inputSchema: {},
      outputSchema: {},
    };

    task2 = {
      name: 'task2',
      run: vi.fn().mockResolvedValue('result2'),
      deps: [task1],
      inputSchema: {},
      outputSchema: {},
    };

    task3 = {
      name: 'task3',
      run: vi.fn().mockResolvedValue('result3'),
      deps: [task2],
      inputSchema: {},
      outputSchema: {},
    };

    // Create mock context
    mockContext = {};

    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    mockValidator = {
      validate: vi.fn().mockReturnValue(true),
      sanitize: vi.fn().mockImplementation(result => result),
    };
    configureWorkflowEngine({
      validator: mockValidator,
      logger: mockLogger,
    });
  });

  test('should retry failed task in workflow and continue', async () => {
    const error = new Error('Task failed');
    task2.run = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('result2');

    const workflow = createWorkflow({
      name: 'test-retry-workflow-success',
      tasks: [task1, task2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data', mockContext);

    expect(result.status).toBe('completed');
    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBe('result2');
    expect(result.outputs.get('task3')).toBe('result3');
    expect(task2.run).toHaveBeenCalledTimes(3);
    expect(result.attempts.get('task2')).toBe(3);
  });

  test('should fail workflow if task exceeds max retries', async () => {
    const error = new Error('Task failed');
    task2.run = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error); // Fourth attempt should not be made

    const workflow = createWorkflow({
      name: 'test-retry-workflow-failure',
      tasks: [task1, task2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data', mockContext);

    expect(result.status).toBe('failed');
    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBeUndefined();
    expect(result.outputs.get('task3')).toBeUndefined();
    expect(task2.run).toHaveBeenCalledTimes(3);
    expect(result.attempts.get('task2')).toBe(3);
  });

  test('should not retry task if error indicates no retry', async () => {
    const error = new Error('Fatal error - no retry');
    task2.run = vi.fn().mockRejectedValueOnce(error);

    const workflow = createWorkflow({
      name: 'test-workflow-force-failure',
      tasks: [task1, task2, task3],
      hooks: {
        onTaskError: () => true, // Indicates no retry
      },
    });

    const result = await runWorkflow(workflow, 'initial-data', mockContext);

    expect(result.status).toBe('failed');
    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBeUndefined();
    expect(result.outputs.get('task3')).toBeUndefined();
    expect(task2.run).toHaveBeenCalledTimes(1);
    expect(result.attempts.get('task2')).toBe(1);
  });

  test('should handle parallel task retries', async () => {
    const parallelTask1 = {
      name: 'parallel1',
      run: vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('parallel1-result'),
      deps: [task1],
      inputSchema: {},
      outputSchema: {},
    };

    const parallelTask2 = {
      name: 'parallel2',
      run: vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('parallel2-result'),
      deps: [task1],
      inputSchema: {},
      outputSchema: {},
    };

    const workflow = createWorkflow({
      name: 'test-workflow-parallel-retry',
      tasks: [task1, parallelTask1, parallelTask2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data', mockContext);

    expect(result.status).toBe('completed');
    expect(result.outputs.get('parallel1')).toBe('parallel1-result');
    expect(result.outputs.get('parallel2')).toBe('parallel2-result');
    expect(result.outputs.get('task3')).toBe('result3');
    expect(parallelTask1.run).toHaveBeenCalledTimes(3);
    expect(parallelTask2.run).toHaveBeenCalledTimes(2);
    expect(result.attempts.get('parallel1')).toBe(3);
    expect(result.attempts.get('parallel2')).toBe(2);
  });

  test('should maintain workflow state during retries', async () => {
    let callCount = 0;
    task2.run = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Failed');
      }
      return 'result2';
    });

    const workflow = createWorkflow({
      name: 'test-workflow-state-retry',
      tasks: [task1, task2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data', mockContext);

    expect(result.status).toBe('completed');
    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBe('result2');
    expect(result.outputs.get('task3')).toBe('result3');
    expect(task2.run).toHaveBeenCalledTimes(3);
    expect(result.attempts.get('task2')).toBe(3);
  });

  test('should handle different error types in workflow', async () => {
    const errors = [
      new Error('Network error'),
      new TypeError('Invalid type'),
      new RangeError('Out of range'),
    ];
    task2.run = vi
      .fn()
      .mockRejectedValueOnce(errors[0])
      .mockRejectedValueOnce(errors[1])
      .mockResolvedValueOnce('result2');

    const workflow = createWorkflow({
      name: 'test-workflow-error-types',
      tasks: [task1, task2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data', mockContext);

    expect(result.status).toBe('completed');
    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBe('result2');
    expect(result.outputs.get('task3')).toBe('result3');
    expect(task2.run).toHaveBeenCalledTimes(3);
    expect(result.attempts.get('task2')).toBe(3);
  });

  test.only('should not retry task if output validation fails', async () => {
    mockValidator.validate = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const workflow = createWorkflow({
      name: 'test-workflow-force-failure',
      tasks: [task1, task2, task3],
    });

    const result = await runWorkflow(workflow, 'initial-data', mockContext);

    expect(result.status).toBe('failed');
    expect(result.outputs.get('task1')).toBe('result1');
    expect(result.outputs.get('task2')).toBeUndefined();
    expect(result.outputs.get('task3')).toBeUndefined();
    expect(task2.run).toHaveBeenCalledTimes(1);
    expect(result.attempts.get('task2')).toBe(1);
  });
});
