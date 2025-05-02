import { Task } from '../../task';
import { CephloError, ERROR_CODES } from '../../errors';
import { getWorkflowEngineConfig, WorkflowSpan } from '../../config';
import { TaskExecutionContext } from '../types';
import { executeTask } from './task';

export function getReadyTasks<T extends Task<any, any>[]>(
  uniqueTasks: Map<keyof T[number]['name'], Task<any, any>>,
  outputs: Map<string, unknown>,
  attempts: Map<string, number>,
  retryPolicy: { maxAttempts: number }
): Task<any, any>[] {
  const readyTasks: Task<any, any>[] = [];

  for (const task of uniqueTasks.values()) {
    if (
      !outputs.has(task.name) &&
      (!task.deps || task.deps.every((dep: Task<any, any>) => outputs.has(dep.name)))
    ) {
      if ((attempts.get(task.name) ?? 0) >= retryPolicy.maxAttempts) {
        throw new CephloError(
          ERROR_CODES.TASK_RETRY_LIMIT_REACHED,
          `Task retry limit reached for task: ${task.name}`
        );
      }
      readyTasks.push(task);
    }
  }

  return readyTasks;
}

export async function processTick<T extends Task<any, any>[]>(
  tickCount: number,
  ctx: TaskExecutionContext<T>,
  tickSpan?: WorkflowSpan
): Promise<void> {
  const { workflow, uniqueTasks, outputs, attempts } = ctx;
  const { logger, retryPolicy, tracer } = getWorkflowEngineConfig();

  logger?.debug(`Processing tick ${tickCount}`);

  const readyTasks = getReadyTasks(uniqueTasks, outputs, attempts, retryPolicy);

  if (readyTasks.length === 0 && uniqueTasks.size !== outputs.size) {
    const remainingTasks = Array.from(uniqueTasks.values())
      .filter(task => !outputs.has(task.name))
      .map(task => task.name);

    logger?.error(`No tasks ready to run. Remaining tasks: ${remainingTasks.join(', ')}`);
    tickSpan?.addEvent('no_ready_tasks', {
      remaining_tasks: remainingTasks,
      total_tasks: uniqueTasks.size,
      completed_tasks: outputs.size,
    });
    tickSpan?.end();

    throw new CephloError(
      ERROR_CODES.NO_READY_TASKS,
      `No tasks ready to run for workflow: ${workflow.name}, but there are ${
        remainingTasks.length
      } tasks remaining. Task names: ${remainingTasks.join(', ')}`
    );
  }

  logger?.info(`Executing ${readyTasks.length} tasks in parallel`);
  tickSpan?.setAttribute('parallel_tasks', readyTasks.length);

  const promises = readyTasks.map(async task => {
    const taskSpan = tracer?.startSpan(`task:${task.name}`, {
      'task.name': task.name,
      'task.attempt': (attempts.get(task.name) ?? 0) + 1,
      'task.max_attempts': retryPolicy.maxAttempts,
      'task.dependencies': task.deps?.map((d: Task<any, any>) => d.name).join(',') || 'none',
      parent: tickSpan,
    });

    const result = await executeTask(task, ctx, taskSpan);
    if (
      (!result.success || result.error) &&
      (attempts.get(task.name) ?? 0) > retryPolicy.maxAttempts
    ) {
      throw result.error;
    }
    return result;
  });

  await Promise.all(promises);
  tickSpan?.end();
}
