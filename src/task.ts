type OutputOf<T extends Task<any, any>> = T extends Task<any, infer Output> ? Output : never;

type OutputsOf<Tasks extends readonly Task<any, any>[]> = {
  [K in keyof Tasks]: Tasks[K] extends Task<any, any> ? OutputOf<Tasks[K]> : never;
};

/**
 * A context that is meant to be extensible.
 * It is passed from the runWorkflow function to each task
 *
 * Extend this interface to add your data to it
 */
export interface WorkflowContext {}

export interface Task<Deps extends readonly Task<any, any>[], TOutput = any> {
  name: string;
  run: (input: OutputsOf<Deps>, context?: WorkflowContext) => Promise<TOutput>;
  deps?: Deps;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export function defineTask<Deps extends readonly Task<any, unknown>[], Output = unknown>(
  options: Task<Deps, Output>
): Task<Deps, Output> {
  return {
    name: options.name,
    deps: options.deps,
    inputSchema: options.inputSchema,
    outputSchema: options.outputSchema,
    run: options.run,
  };
}
