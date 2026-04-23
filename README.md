# Synthed Documentation

Synthed is a TypeScript toolkit for generating deterministic synthetic test data across finance, healthcare, EDI, telecom, and logging formats. It includes:

- A CLI for local and CI pipelines
- An API server for service-to-service generation and validation
- A registry/orchestrator model for composing repeatable generation jobs
- Optional corruption and manifests for "bad data" test suites

This document is designed as a practical, implementation-level guide for repository users and contributors.

## 1) What Synthed Is For

Use Synthed when you need test fixtures that are:

- Safe: no production data exposure
- Repeatable: same `seed` produces same data
- Domain-shaped: output resembles real format conventions
- Stress-ready: corruption support for validator/parser testing

Typical use cases:

- Integration testing against HL7/FIX/OFX/X12 payloads
- ETL test fixture generation
- Parser hardening and negative testing
- Validator regression checks using manifests

| Feature | AI Generators | Synthed |
| --- | --- | --- |
| Requires Real Data | Yes (Training) | No (Schema-based) |
| Deterministic Output | Rare | Always (via Seed) |
| Intentional Corruption | No | Yes (Chaos Mode) |
| Cost | High $$$ | Free (MIT) |

## 2) Supported Generators and Validators

Registered generators include:

- `apache-access-log`
- `hl7v2`
- `fix`
- `ofx`
- `x12`
- `edifact`
- `swift-mt`
- `cdr`
- `syslog-rfc5424`
- `windows-evtx`
- `fhir-r4`

Registered validators include:

- `hl7v2`
- `fix`
- `ofx`
- `x12`
- `swift-mt`
- `cdr`

List available generators at runtime:

```bash
npm run dev -- list
```

## 3) Installation and Setup

### Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

### Install dependencies

```bash
npm ci
```

### Build

```bash
npm run build
```

### Development CLI invocation

```bash
npm run dev -- list
```

## 4) CLI Commands

The CLI entrypoint is `src/cli/index.ts`.

### `generate`

Generate one dataset quickly from a single generator.

```bash
npm run dev -- generate <generator> --count <N> --seed <S> --output <path>
```

Key options:

- `--count`: record count (default `100`)
- `--seed`: deterministic seed (default `42`)
- `--output`: output file path; omitted means stdout
- `--corrupt`: enable corruption injection
- `--corrupt-rate`: fraction to corrupt (0 to 1)

Examples:

```bash
npm run dev -- generate hl7v2 --count 100 --seed 42 --output output/hl7-clean.hl7
npm run dev -- generate fix --count 100 --seed 42 --corrupt --corrupt-rate 0.15 --output output/fix-bad.fix
```

### `run --config`

Run one or more jobs from YAML.

```bash
npm run dev -- run --config examples/jobs/full-suite.yaml
```

This is the best approach for repeatable suites in CI.

### `validate`

Validate a generated/input file using a matching validator.

```bash
npm run dev -- validate --generator hl7v2 --input output/hl7-clean.hl7 --format json --output output/hl7.validation.json
```

Options:

- `--format text|json|junit` (default `text`)
- `--strict` exits with code `1` when validation fails
- `--suppress <RULE1,RULE2,...>` suppresses selected rules

### `selftest`

Run built-in self-tests.

```bash
npm run dev -- selftest
npm run dev -- selftest fix --format json
```

### `manifest-check`

Compare corruption manifest results with validator report output.

```bash
npm run dev -- manifest-check --manifest output/hl7-bad.manifest.json --report output/hl7.validation.json
```

## 5) YAML Job Configuration

YAML configs are parsed and validated with Zod (`src/orchestrator/config.ts`).

Job fields:

- `id`: unique job name
- `generator`: generator id
- `recordCount`, `seed`, `locale`, `extras`
- `corrupt`, `corruptRate`, optional `corruptStrategies`
- `output`:
  - `type`: `stdout` or `file`
  - `path`: file path when using `file`
  - `compress`: optional gzip output
- `manifest`:
  - `type`: currently `file`
  - `path`: where injected corruption metadata is written

Minimal example:

```yaml
version: "1"
seed: 42
jobs:
  - id: hl7-clean
    generator: hl7v2
    recordCount: 100
    output:
      type: file
      path: ./output/hl7-clean.hl7
```

Bad-data example:

```yaml
version: "1"
seed: 42
jobs:
  - id: ofx-bad
    generator: ofx
    recordCount: 60
    corrupt: true
    corruptRate: 0.2
    output:
      type: file
      path: ./output/ofx-bad.ofx
    manifest:
      type: file
      path: ./output/ofx-bad.manifest.json
```

## 6) Generating "Bad" Data

Corruption is applied by the orchestrator corruption layer during streaming generation.

Two ways to enable:

1. CLI: `--corrupt --corrupt-rate <0..1>`
2. YAML job: `corrupt: true` + `corruptRate: <0..1>`

Recommended rates:

- Smoke tests: `0.05`
- Validator stress: `0.1` to `0.2`
- Fuzz-like scenarios: `0.25+` (expect high parse failure rates)

Current repository includes a multi-format bad-data config:

- `examples/jobs/bad-data.yaml`

Run all bad-data jobs:

```bash
npm run dev -- run --config examples/jobs/bad-data.yaml
```

## 7) Output Files and Where to Inspect

By convention, generated files are stored under `output/`.

Examples:

- Healthcare: `output/hl7-bad.hl7`, `output/fhir-bad.json`
- Financial: `output/fix-bad.fix`, `output/ofx-bad.ofx`
- Manifests: `output/*-bad.manifest.json`

Inspect quickly:

```bash
# PowerShell
Get-ChildItem .\output
Get-Content .\output\hl7-bad.hl7 -TotalCount 30
Get-Content .\output\ofx-bad.ofx -TotalCount 30
```

Note on FIX readability: FIX uses SOH (`0x01`) delimiters, so output appears compact in plain text viewers.

## 8) REST API Usage

Server implementation lives at `src/api/server.ts`.

### Start server

```bash
npm run build
node dist/api/server.js --start
```

Default listener:

- Host: `0.0.0.0`
- Port: `3000`

### Endpoints

- `GET /api/v1/generators`
- `GET /api/v1/generators/:id`
- `POST /api/v1/generate`
- `POST /api/v1/validate/:id`
- `POST /api/v1/selftest/:id`

### Generate example (API)

```bash
curl -X POST http://localhost:3000/api/v1/generate \
  -H "content-type: application/json" \
  -d '{"generator":"hl7v2","options":{"seed":42,"recordCount":10}}'
```

### Validate example (API)

```bash
curl -X POST http://localhost:3000/api/v1/validate/hl7v2 \
  -H "content-type: text/plain" \
  --data-binary @output/hl7-bad.hl7
```

Error semantics:

- `400`: payload validation error (Zod)
- `404`: unknown generator/validator
- `500`: internal server error

## 9) Determinism and Reproducibility

Determinism depends on:

- same generator id
- same `seed`
- same `recordCount`
- same corruption configuration
- same library version

Best practice:

- Store YAML job configs in version control
- Fix seed values in CI
- Keep manifest artifacts for negative test investigations

## 10) CI and Quality Commands

```bash
npm run lint
npm run build
npm test
```

Optional benchmark:

```bash
npm run benchmark -- 10000
```

Suggested CI sequence:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm test`
5. Generate one clean and one bad-data fixture smoke set

## 11) Repository Structure

```text
src/
  api/            # Fastify HTTP server
  cli/            # CLI command definitions
  core/           # Shared interfaces, RNG, corruption, utility engines
  generators/     # Domain/format-specific generators
  orchestrator/   # Registry, config loading, run pipeline, sinks
  validators/     # Validator implementations and manifest matching
tests/            # Vitest suites
examples/jobs/    # Reusable YAML job configurations
benchmarks/       # Throughput/benchmark scripts
```

## 12) Troubleshooting

### "Unknown generator" or "Unknown validator"

- Run `npm run dev -- list`
- Confirm id matches exactly
- Confirm build artifacts are current (`npm run build`)

### No output file generated

- Check job `output.type` is `file`
- Verify output path exists or parent folder can be created
- Check command exited successfully

### Validation unexpectedly fails on generated file

- Confirm matching validator for format
- Check whether corruption was enabled
- Compare manifest (`*-manifest.json`) with validator report

### FIX file hard to inspect

- Convert SOH to a visible delimiter (`|`) in your editor or script

## 13) Security and Data Handling Notes

- Generated data is synthetic and intended for testing
- Do not assume clinical/financial standards certification completeness
- Validate assumptions before using outputs in compliance-sensitive workflows

## 14) Contribution Notes

When adding generators/validators:

- Register in `createDefaultRegistry()` (`src/orchestrator/defaultRegistry.ts`)
- Add tests under `tests/`
- Add at least one reproducible YAML sample job where relevant
- Document any new CLI/API option changes in this file

