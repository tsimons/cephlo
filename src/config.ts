export type WorkflowValidator = {
  validate(value: unknown, schema: unknown): Boolean;
  sanitize<T>(value: T, schema: unknown): T;
};

export interface WorkflowLogger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
}

export interface WorkflowTracer {
  startSpan(name: string, attributes?: Record<string, unknown>): WorkflowSpan;
  getCurrentSpan(): WorkflowSpan | undefined;
}

export interface WorkflowSpan {
  setAttribute(key: string, value: unknown): void;
  setAttributes(attributes: Record<string, unknown>): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  end(): void;
  getTraceId(): string;
  getSpanId(): string;
}

export interface WorkflowEngineConfig {
  defaultTaskTimeoutMs: number;
  validator?: WorkflowValidator;
  logger?: WorkflowLogger;
  tracer?: WorkflowTracer;

  retryPolicy: {
    maxAttempts: number;
    backoffMs?: number;
  };
}

let workflowEngineConfig: WorkflowEngineConfig = {
  defaultTaskTimeoutMs: 5000,
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 1000,
  },
  logger: {
    info: console.info,
    debug: console.debug,
    error: console.error,
    warn: console.warn,
    log: console.log,
  },
  validator: {
    validate: () => true,
    sanitize: data => data,
  },
};

export function configureWorkflowEngine(config: Partial<WorkflowEngineConfig>) {
  workflowEngineConfig = {
    ...workflowEngineConfig,
    ...config,
    retryPolicy: {
      ...workflowEngineConfig.retryPolicy,
      ...config.retryPolicy,
    },
  };
}

export function getWorkflowEngineConfig(): WorkflowEngineConfig {
  return workflowEngineConfig;
}
