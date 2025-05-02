import { Task } from '../task';
import { uniqueTaskMap } from '../utils';
import { Workflow, WorkflowHooks } from './types';
import { runWorkflow } from './execution';

interface WorkflowOptions<T extends Task<any, any>[]> {
  name: string;
  tasks: T;
  hooks?: WorkflowHooks<T>;
}

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
