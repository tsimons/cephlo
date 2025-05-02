export const ERROR_CODES = {
  INVALID_INPUTS: 'INVALID_INPUTS',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  WORKFLOW_ERROR: 'WORKFLOW_ERROR',
  NO_READY_TASKS: 'NO_READY_TASKS',
  TASK_ERROR: 'TASK_ERROR',
  TASK_RETRY: 'TASK_RETRY',
  TASK_RETRY_LIMIT_REACHED: 'TASK_RETRY_LIMIT_REACHED',
  TASK_TIMEOUT: 'TASK_TIMEOUT',
} as const;

export const UNRETRYABLE_ERROR_CODES = [
  ERROR_CODES.INVALID_INPUTS,
  ERROR_CODES.INVALID_OUTPUT,
] as (typeof ERROR_CODES)[keyof typeof ERROR_CODES][];

export class CephloError extends Error {
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
  name: string;
  innerError?: Error | CephloError | unknown;
  constructor(
    code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
    message: string,
    innerError?: Error | CephloError | unknown
  ) {
    super(message);
    this.name = 'CephloError';
    this.code = code;
    this.innerError = innerError;
  }
}
