import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Task } from '../../task';
import { executeTask } from '../execution/task';
import { TaskExecutionContext } from '../types';
import { configureWorkflowEngine, WorkflowLogger, WorkflowValidator } from '../../config';

describe('Task Execution', () => {
  let mockTask: Task<any, any>;
  let mockContext: TaskExecutionContext<any>;
  let mockLogger: WorkflowLogger;
  let mockValidator: WorkflowValidator;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a mock task
    mockTask = {
      name: 'test-task',
      run: vi.fn().mockResolvedValue('task-result'),
      deps: [],
      inputSchema: {},
      outputSchema: {},
    };

    // Create mock context
    mockContext = {
      workflow: {
        name: 'test-workflow',
        uniqueTasks: new Map(),
        hooks: {
          onTaskStart: vi.fn(),
          onTaskEnd: vi.fn(),
          onTaskError: vi.fn(),
          onTaskSuccess: vi.fn(),
          onTaskRetry: vi.fn(),
          onWorkflowStart: vi.fn(),
          onWorkflowEnd: vi.fn(),
          onWorkflowError: vi.fn(),
        },
      },
      outputs: new Map(),
      attempts: new Map(),
      initialData: 'initial-data',
      uniqueTasks: new Map(),
    };

    // Mock logger and validator
    mockLogger = {
      log: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockValidator = {
      validate: vi.fn().mockReturnValue(true),
      sanitize: vi.fn().mockImplementation(x => x),
    };

    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    configureWorkflowEngine({
      logger: mockLogger,
      validator: mockValidator,
    });
  });

  test('should execute task successfully', async () => {
    const result = await executeTask(mockTask, mockContext);

    expect(result.success).toBe(true);
    expect(result.result).toBe('task-result');
    expect(mockTask.run).toHaveBeenCalledWith('initial-data', undefined);
    expect(mockContext.outputs.get('test-task')).toBe('task-result');
    expect(mockContext.attempts.get('test-task')).toBe(1);
  });

  test('should handle task dependencies', async () => {
    const depTask = {
      name: 'dep-task',
      run: vi.fn().mockResolvedValue('dep-result'),
      deps: [],
      inputSchema: {},
      outputSchema: {},
    };

    mockTask.deps = [depTask];
    mockContext.outputs.set('dep-task', 'dep-result');

    const result = await executeTask(mockTask, mockContext);

    expect(result.success).toBe(true);
    expect(mockTask.run).toHaveBeenCalledWith(['dep-result'], undefined);
  });

  test('should handle task failure', async () => {
    const error = new Error('Task failed');
    mockTask.run = vi.fn().mockRejectedValue(error);

    const result = await executeTask(mockTask, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockContext.attempts.get('test-task')).toBe(1);
    expect(mockContext.workflow.hooks?.onTaskError).toHaveBeenCalled();
  });

  test('should handle input validation failure', async () => {
    mockValidator.validate = vi.fn().mockReturnValue(false);
    mockTask.deps = [];

    await expect(executeTask(mockTask, mockContext)).rejects.toThrow();
    expect(mockValidator.validate).toHaveBeenCalled();
  });

  test('should handle output validation failure', async () => {
    mockValidator.validate = vi
      .fn()
      .mockReturnValueOnce(true) // Input validation passes
      .mockReturnValueOnce(false); // Output validation fails

    await expect(executeTask(mockTask, mockContext)).rejects.toThrow();
    expect(mockValidator.validate).toHaveBeenCalledTimes(2);
  });

  test('should handle retries', async () => {
    const error = new Error('Task failed');
    mockTask.run = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('retry-success');

    // First attempt
    let result = await executeTask(mockTask, mockContext);
    expect(result.success).toBe(false);
    expect(mockContext.attempts.get('test-task')).toBe(1);

    // Second attempt
    result = await executeTask(mockTask, mockContext);
    expect(result.success).toBe(true);
    expect(result.result).toBe('retry-success');
    expect(mockContext.attempts.get('test-task')).toBe(2);
    expect(mockContext.workflow.hooks?.onTaskRetry).toHaveBeenCalled();
  });
});
