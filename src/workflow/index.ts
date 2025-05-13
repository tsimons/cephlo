import type { Task } from '../task';
import { uniqueTaskMap } from '../utils';
import type { Workflow, WorkflowHooks } from './types';
import { runWorkflow } from './execution';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface WorkflowOptions<T extends Task<any, any>[]> {
  name: string;
  tasks: T;
  hooks?: WorkflowHooks<T>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWorkflow<T extends Task<any, any>[]>({
  tasks,
  hooks,
  name,
}: WorkflowOptions<T>): Workflow<T> {
  return {
    name,
    uniqueTasks: uniqueTaskMap(tasks),
    hooks,
  };
}
export { runWorkflow };
