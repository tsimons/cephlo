import { Task, WorkflowContext } from '../../task';
import { getWorkflowEngineConfig, WorkflowSpan } from '../../config';
import { CephloError } from '../../errors';
import { Workflow, TaskExecutionContext, HookContext } from '../types';
import { processTick } from './tick';

interface WorkflowResult {
  outputs: Map<string, unknown>;
  attempts: Map<string, number>;
  tickCount: number;
  error?: unknown;
  status: 'completed' | 'failed';
  duration: number;
}

export async function runWorkflow<T extends Task<any, any>[]>(
  workflow: Workflow<T>,
  initialData: unknown,
  context?: WorkflowContext
): Promise<WorkflowResult> {
  const { uniqueTasks, hooks } = workflow;
  const { logger, tracer } = getWorkflowEngineConfig();
  const outputs = new Map<string, unknown>();
  const attempts = new Map<string, number>();
  const startTime = Date.now();
  const executionContext: TaskExecutionContext<T> = {
    workflow,
    outputs,
    attempts,
    initialData,
    context,
    uniqueTasks,
  };

  const getContext = (task?: Task<any, any>, inputs: unknown[] = []): HookContext<T> => ({
    workflow,
    task,
    inputs,
    output: task ? outputs.get(task?.name ?? '') : undefined,
    attempts: task ? attempts.get(task?.name ?? '') : undefined,
  });

  logger?.info(`Starting workflow execution: ${workflow.name}`);
  logger?.debug(`Initial data: ${JSON.stringify(initialData)}`);
  logger?.info(`Total tasks in workflow: ${uniqueTasks.size}`);

  const workflowSpan = tracer?.startSpan(`workflow:${workflow.name}`, {
    'workflow.name': workflow.name,
    'workflow.total_tasks': uniqueTasks.size,
    'workflow.initial_data': JSON.stringify(initialData),
  });

  hooks?.onWorkflowStart?.(getContext());

  let tickCount = 1;
  while (uniqueTasks.size > outputs.size) {
    try {
      logger?.info(`Starting workflow tick ${tickCount}`);
      const tickSpan = tracer?.startSpan(`workflow_tick:${tickCount}`, {
        'tick.number': tickCount,
        'workflow.name': workflow.name,
      });

      await processTick(tickCount, executionContext, tickSpan);

      logger?.info(`Completed workflow tick ${tickCount}`);
      logger?.debug(`Progress: ${outputs.size}/${uniqueTasks.size} tasks completed`);
      workflowSpan?.setAttribute('workflow.progress', `${outputs.size}/${uniqueTasks.size}`);
    } catch (err) {
      logger?.error(
        `Workflow ${workflow.name} failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      workflowSpan?.addEvent('workflow_failed', {
        'error.message': err instanceof Error ? err.message : 'Unknown error',
        'error.code': err instanceof CephloError ? err.code : 'UNKNOWN',
        'tick.count': tickCount,
        completed_tasks: outputs.size,
      });
      if (err instanceof CephloError) {
        hooks?.onWorkflowError?.(err, getContext());
      }
      workflowSpan?.end();

      return {
        outputs,
        attempts,
        tickCount,
        status: 'failed',
        duration: Date.now() - startTime,
      };
    }
    tickCount++;
  }

  logger?.info(`Workflow ${workflow.name} completed successfully`);
  logger?.info(`Total ticks: ${tickCount}`);
  logger?.info(`Total tasks completed: ${outputs.size}`);
  workflowSpan?.setAttributes({
    'workflow.total_ticks': tickCount,
    'workflow.completed_tasks': outputs.size,
    'workflow.status': 'completed',
  });
  workflowSpan?.end();
  hooks?.onWorkflowEnd?.(getContext());

  return {
    outputs,
    attempts,
    tickCount,
    status: 'completed',
    duration: Date.now() - startTime,
  };
}
