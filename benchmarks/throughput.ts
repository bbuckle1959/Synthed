import { performance } from "node:perf_hooks";
import { createDefaultRegistry } from "../src/orchestrator/defaultRegistry.js";

async function runOne(id: string, count: number): Promise<void> {
  const reg = createDefaultRegistry();
  const gen = reg.getGenerator(id);
  const t0 = performance.now();
  let records = 0;
  let bytes = 0;
  for await (const chunk of gen.generate({ seed: 42, recordCount: count, corrupt: false, corruptRate: 0, locale: "en", extras: {} })) {
    records += 1;
    bytes += Buffer.byteLength(chunk, "utf8");
  }
  const elapsedMs = performance.now() - t0;
  const rps = (records / elapsedMs) * 1000;
  const mbps = ((bytes / 1024 / 1024) / elapsedMs) * 1000;
  console.log(`${id}\trecords=${records}\telapsed_ms=${elapsedMs.toFixed(1)}\trec_per_s=${rps.toFixed(1)}\tMBps=${mbps.toFixed(2)}`);
}

const count = Number(process.argv[2] ?? "10000");
const generators = ["apache-access-log", "hl7v2", "fix", "ofx", "x12", "edifact", "swift-mt", "cdr", "syslog-rfc5424", "windows-evtx", "fhir-r4"];
for (const id of generators) {
  await runOne(id, count);
}

