#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { Command } from "commander";
import { loadConfig } from "../orchestrator/config.js";
import { createDefaultRegistry } from "../orchestrator/defaultRegistry.js";
import { JobOrchestrator } from "../orchestrator/JobOrchestrator.js";
import { runSelfTest } from "../orchestrator/selftest.js";
import { matchManifest } from "../validators/manifestMatcher.js";

const program = new Command().name("synthed");
const registry = createDefaultRegistry();
const orchestrator = new JobOrchestrator(registry);

program.command("run").requiredOption("--config <path>").action(async (opts) => {
  const cfg = await loadConfig(opts.config);
  await orchestrator.runConfig(cfg);
});

program.command("generate <generator>").option("--count <count>", "record count", "100").option("--seed <seed>", "seed", "42").option("--output <output>").option("--corrupt").option("--corrupt-rate <rate>", "corrupt rate", "0").action(async (generator, opts) => {
  const count = Number(opts.count);
  if (!Number.isInteger(count) || count < 1 || count > 100_000) {
    console.error(`--count must be an integer between 1 and 100,000 (got: ${opts.count})`);
    process.exit(2);
  }
  await orchestrator.runJob({
    id: `quick-${generator}`,
    generator,
    recordCount: count,
    seed: Number(opts.seed),
    corrupt: Boolean(opts.corrupt),
    corruptRate: Number(opts.corruptRate),
    output: opts.output ? { type: "file", path: opts.output } : { type: "stdout" },
  });
});

program.command("list").action(() => registry.listGenerators().forEach((g) => console.log(`${g.id}\t${g.description}`)));
program.command("describe <generator>").action((id) => {
  const g = registry.getGenerator(id);
  console.log(JSON.stringify({ id: g.id, description: g.description, defaultOptions: g.defaultOptions }, null, 2));
});

program.command("validate").requiredOption("--generator <id>").requiredOption("--input <path>").option("--format <format>", "text|json|junit", "text").option("--output <output>").option("--strict").option("--suppress <rules>").action(async (opts) => {
  const input = await readFile(opts.input, "utf8");
  const report = await registry.getValidator(opts.generator).validate(input, { suppressRules: opts.suppress?.split(",").filter(Boolean) ?? [] });
  let rendered = "";
  if (opts.format === "json") rendered = JSON.stringify(report, null, 2);
  else if (opts.format === "junit") rendered = `<testsuite name="${opts.generator}" tests="${report.recordsValidated}" failures="${report.errors.length}"></testsuite>`;
  else rendered = `passed=${report.passed} errors=${report.errors.length} warnings=${report.warnings.length}`;
  if (opts.output) await writeFile(opts.output, rendered, "utf8"); else console.log(rendered);
  if (opts.strict && !report.passed) process.exit(1);
});

program.command("selftest [generator]").option("--format <format>", "text|json|junit", "text").action(async (generator, opts) => {
  const result = await runSelfTest(generator);
  if (opts.format === "json") console.log(JSON.stringify(result, null, 2));
  else if (opts.format === "junit") {
    const failures = result.filter((r) => !r.passed).length;
    const cases = result
      .map((r) => `<testcase classname="synthed.selftest" name="${r.generatorId}">${r.passed ? "" : `<failure message="selftest failed for ${r.generatorId}"/>`}</testcase>`)
      .join("");
    console.log(`<testsuite name="synthed-selftest" tests="${result.length}" failures="${failures}">${cases}</testsuite>`);
  }
  else result.forEach((r) => console.log(`${r.generatorId}: ${r.passed ? "PASS" : "FAIL"}`));
});

program.command("manifest-check").requiredOption("--manifest <path>").requiredOption("--report <path>").action(async (opts) => {
  const manifest = JSON.parse(await readFile(opts.manifest, "utf8"));
  const report = JSON.parse(await readFile(opts.report, "utf8"));
  console.log(JSON.stringify(matchManifest(manifest.errors, report.errors ?? []), null, 2));
});

program.parseAsync(process.argv).catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
});

