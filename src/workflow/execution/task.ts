import { Task } from '../../task';
import { CephloError, ERROR_CODES, UNRETRYABLE_ERROR_CODES } from '../../errors';
import { getWorkflowEngineConfig, WorkflowSpan } from '../../config';
import { TaskExecutionContext, TaskExecutionResult, HookContext } from '../types';

export async function executeTask<T extends Task<unknown, unknown>[]>(
  task: Task<unknown, unknown>,
  ctx: TaskExecutionContext<T>,
  taskSpan?: WorkflowSpan
): Promise<TaskExecutionResult> {
  const { workflow, outputs, attempts, initialData, context } = ctx;
  const { logger, retryPolicy, validator } = getWorkflowEngineConfig();
  const { hooks } = workflow;

  const getContext = (inputs: unknown[] = []): HookContext<T> => ({
    workflow,
    task,
    inputs,
    output: outputs.get(task.name),
    attempts: attempts.get(task.name),
  });

  try {
    const attempt = attempts.get(task.name) ?? 0;
    attempts.set(task.name, attempt + 1);

    const inputs = task.deps?.length
      ? task.deps.map((dep: Task<unknown, unknown>) => outputs.get(dep.name))
      : initialData;

    logger?.debug(`Task ${task.name} attempt ${attempt + 1}/${retryPolicy.maxAttempts}`);
    logger?.debug(`Task ${task.name} inputs: ${JSON.stringify(inputs)}`);

    taskSpan?.setAttributes({
      'task.attempt': attempt + 1,
    });

    // Validate input if needed
    if (task.deps.length === 0 && validator?.validate) {
      logger?.debug(`Validating input for task ${task.name}`);

      const isValid = validator?.validate(inputs, task.inputSchema);
      if (!isValid) {
        const err = new CephloError(
          ERROR_CODES.INVALID_INPUTS,
          `Invalid inputs for task: ${task.name}`
        );
        logger?.error(`Input validation failed for task ${task.name}`);
        taskSpan?.addEvent('input_validation_failed', {
          'error.message': err.message,
          'error.code': err.code,
        });

        throw err;
      }
      taskSpan?.addEvent('input_validation_success');
    }

    hooks?.onTaskStart?.(getContext(inputs));

    if (attempt > 0) {
      logger?.warn(`Retrying task ${task.name} (attempt ${attempt + 1})`);
      taskSpan?.addEvent('task_retry', {
        attempt: attempt + 1,
        max_attempts: retryPolicy.maxAttempts,
      });
      hooks?.onTaskRetry?.(getContext(inputs));
    }

    // Execute task
    logger?.info(`Starting execution of task ${task.name}`);
    taskSpan?.addEvent('task_execution_start');

    const result = await task.run(inputs, context);

    taskSpan?.addEvent('task_execution_end');
    logger?.debug(`Task ${task.name} completed with result: ${JSON.stringify(result)}`);

    // Sanitize and validate output
    let sanitizedResult =
      validator?.sanitize && task.outputSchema
        ? validator?.sanitize(result, task.outputSchema)
        : result;

    if (validator?.validate && task.outputSchema) {
      logger?.debug(`Validating outputs for task ${task.name}`);
      taskSpan?.addEvent('output_validation_start');

      const isValid = validator?.validate(result, task.outputSchema);
      if (!isValid) {
        const err = new CephloError(ERROR_CODES.INVALID_OUTPUT, 'Invalid output');
        logger?.error(`Output validation failed for task ${task.name}`);
        taskSpan?.addEvent('output_validation_failed', {
          'error.message': err.message,
          'error.code': err.code,
        });

        throw err;
      }
      taskSpan?.addEvent('output_validation_success');
    }

    outputs.set(task.name, sanitizedResult);

    hooks?.onTaskSuccess?.(sanitizedResult, getContext(inputs));
    hooks?.onTaskEnd?.(undefined, sanitizedResult, getContext(inputs));

    logger?.info(`Task ${task.name} completed successfully`);
    taskSpan?.setAttribute('task.result', JSON.stringify(sanitizedResult));
    taskSpan?.end();

    return { success: true, result: sanitizedResult };
  } catch (err) {
    let skipRetry = false;
    let error = err;
    if (err instanceof CephloError) {
      skipRetry =
        (UNRETRYABLE_ERROR_CODES.includes(err.code) || hooks?.onTaskError?.(err, getContext())) ??
        false;
    } else {
      error = new CephloError(ERROR_CODES.TASK_ERROR, 'Task failed', err);
      skipRetry = hooks?.onTaskError?.(error, getContext()) ?? false;
    }

    if (skipRetry) {
      logger?.error(
        `Task ${task.name} failed, skipping retry: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      taskSpan?.addEvent('task_failed_no_retry', {
        'error.message': error instanceof Error ? error.message : 'Unknown error',
        'error.code': error instanceof CephloError ? error.code : 'UNKNOWN',
      });
    } else {
      logger?.warn(
        `Task ${task.name} failed, will retry: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      taskSpan?.addEvent('task_failed_will_retry', {
        'error.message': error instanceof Error ? error.message : 'Unknown error',
        'error.code': error instanceof CephloError ? error.code : 'UNKNOWN',
        next_attempt: (attempts.get(task.name) ?? 0) + 1,
      });
    }

    taskSpan?.end();
    hooks?.onTaskEnd?.(error, undefined, getContext());

    if (skipRetry) {
      throw error;
    }

    return { success: false, error };
  }
}
