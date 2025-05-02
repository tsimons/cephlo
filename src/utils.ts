import { Task } from './task';

export const uniqueTaskMap = <T extends Task<any, any>[]>(
  tasks: T
): Map<keyof T[number]['name'], Task<any, any>> => {
  const uniqueTasks = new Map<string, Task<any, any>>();

  function collect(task: T[number]) {
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
