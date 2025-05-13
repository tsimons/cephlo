import { Task } from './task';

export function deps<Tasks extends Task<unknown, unknown>[]>(...tasks: Tasks): readonly [...Tasks] {
  return tasks;
}
