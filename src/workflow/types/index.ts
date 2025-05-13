import { Task, WorkflowContext } from '../../task';
import { WorkflowSpan } from '../../config';

export interface HookContext<T extends Task<unknown, unknown>[]> {
  workflow: Workflow<T>;
  task?: Task<unknown, unknown>;
  inputs: unknown | undefined;
  output: unknown | undefined;
  attempts: number | undefined;
}

export interface WorkflowHooks<T extends Task<unknown, unknown>[]> {
  onWorkflowStart?: (context: HookContext<T>) => void;
  onWorkflowEnd?: (context: HookContext<T>) => void;
  onWorkflowError?: (error: unknown, context: HookContext<T>) => void;

  onTaskStart?: (context: HookContext<T>) => void;
  onTaskEnd?: (
    error: unknown | undefined,
    result: unknown | undefined,
    context: HookContext<T>
  ) => void;
  /**
   * Return true if the error means we should skip retrying the task
   */
  onTaskError?: (error: unknown, context: HookContext<T>) => boolean;
  onTaskSuccess?: (result: unknown, context: HookContext<T>) => void;
  onTaskRetry?: (context: HookContext<T>) => void;
}

export interface Workflow<T extends Task<unknown, unknown>[]> {
  name: string;
  uniqueTasks: Map<keyof T[number]['name'], Task<unknown, unknown>>;
  hooks?: WorkflowHooks<T>;
}

export interface TaskExecutionContext<T extends Task<unknown, unknown>[]> {
  workflow: Workflow<T>;
  outputs: Map<string, unknown>;
  attempts: Map<string, number>;
  initialData: unknown;
  context?: WorkflowContext;
  uniqueTasks: Map<keyof T[number]['name'], Task<unknown, unknown>>;
}

export interface TaskExecutionResult {
  success: boolean;
  result?: unknown;
  error?: unknown;
}
