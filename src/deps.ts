import { Task } from './task';

export function deps<Tasks extends Task<any, any>[]>(...tasks: Tasks): readonly [...Tasks] {
  return tasks;
}
