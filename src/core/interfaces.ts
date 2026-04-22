import type { RNG } from "./RNG.js";

export interface GeneratorOptions {
  seed: number;
  recordCount: number;
  corrupt: boolean;
  corruptRate: number;
  corruptStrategies?: Record<string, number>;
  locale: string;
  extras: Record<string, unknown>;
}

export interface IGenerator {
  readonly id: string;
  readonly description: string;
  readonly defaultOptions: Partial<GeneratorOptions>;
  generate(options: GeneratorOptions): AsyncGenerator<string>;
}

export type Severity = "error" | "warning" | "info";

export interface ValidationError {
  severity: Severity;
  recordIndex: number;
  byteOffset?: number;
  fieldPath: string;
  rule: string;
  message: string;
  actual: string;
  expected: string;
}

export interface ValidationReport {
  generatorId: string;
  recordsValidated: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  durationMs: number;
  passed: boolean;
}

export interface IValidator {
  readonly id: string;
  validate(input: string, options?: { suppressRules?: string[] }): Promise<ValidationReport>;
}

export interface InjectedError {
  recordIndex: number;
  byteOffset: number;
  strategy: string;
  fieldPath: string;
  originalValue: string;
  injectedValue: string;
  description: string;
}

export interface ErrorManifest {
  generatorId: string;
  seed: number;
  totalRecords: number;
  generatedAt: string;
  errors: InjectedError[];
}

export interface MutationResult {
  mutated: string;
  error: Omit<InjectedError, "recordIndex" | "byteOffset">;
}

export interface CorruptionStrategyDef {
  id: string;
  description: string;
  applicableTo: string[];
  defaultWeight: number;
  mutate(record: string, rng: RNG, context?: Record<string, unknown>): MutationResult | null;
}

export interface IOutputSink {
  write(chunk: string): Promise<void>;
  close(): Promise<void>;
}

export interface JobOutputConfig {
  type: "stdout" | "file";
  path?: string;
  compress?: boolean;
}

export interface ManifestConfig {
  type: "file";
  path: string;
}

export interface JobConfig {
  id: string;
  generator: string;
  recordCount?: number;
  seed?: number;
  corrupt?: boolean;
  corruptRate?: number;
  corruptStrategies?: Record<string, number>;
  locale?: string;
  extras?: Record<string, unknown>;
  output: JobOutputConfig;
  manifest?: ManifestConfig;
}

export interface RootConfig {
  version: string;
  seed?: number;
  jobs: JobConfig[];
}

