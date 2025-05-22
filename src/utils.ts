import { CephloError, ERROR_CODES } from './errors';
import { Task } from './task';

export const uniqueTaskMap = <T extends Task<any, any>[]>(
  tasks: T
): Map<keyof T[number]['name'], Task<any, any>> => {
  const uniqueTasks = new Map<string, Task<any, any>>();

  function collect(task: T[number]) {
    if (!task) {
      throw new CephloError(
        ERROR_CODES.TASK_UNDEFINED,
        'Task is undefined. There may be a circular dependency'
      );
    }

    if (uniqueTasks.has(task.name)) return;
    uniqueTasks.set(task.name, task);
    for (const dep of task.deps ?? []) {
      collect(dep);
    }
  }

  for (const root of tasks) {
    collect(root);
  }

  return uniqueTasks as Map<keyof T[number]['name'], Task<any, any>>;
};
