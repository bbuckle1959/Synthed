import { describe, expect, it } from "vitest";
import { ApacheAccessLogGenerator } from "../../src/generators/logs/ApacheAccessLog.js";
import { HL7v2Generator } from "../../src/generators/healthcare/HL7v2.js";
import { FIXProtocolGenerator } from "../../src/generators/finance/FIXProtocol.js";

async function firstN(gen: AsyncGenerator<string>, n: number): Promise<string> {
  const chunks: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const next = await gen.next();
    if (next.done) break;
    chunks.push(next.value);
  }
  return chunks.join("");
}

describe("Deterministic golden behavior", () => {
  it("apache is deterministic for same seed", async () => {
    const g = new ApacheAccessLogGenerator();
    const a = await firstN(g.generate({ seed: 7, recordCount: 5, corrupt: false, corruptRate: 0, locale: "en", extras: {} }), 5);
    const b = await firstN(g.generate({ seed: 7, recordCount: 5, corrupt: false, corruptRate: 0, locale: "en", extras: {} }), 5);
    expect(a).toBe(b);
  });

  it("hl7 and fix deterministic for same seed", async () => {
    const hl7 = new HL7v2Generator();
    const fix = new FIXProtocolGenerator();
    const h1 = await firstN(hl7.generate({ seed: 9, recordCount: 3, corrupt: false, corruptRate: 0, locale: "en", extras: {} }), 3);
    const h2 = await firstN(hl7.generate({ seed: 9, recordCount: 3, corrupt: false, corruptRate: 0, locale: "en", extras: {} }), 3);
    const f1 = await firstN(fix.generate({ seed: 9, recordCount: 3, corrupt: false, corruptRate: 0, locale: "en", extras: {} }), 3);
    const f2 = await firstN(fix.generate({ seed: 9, recordCount: 3, corrupt: false, corruptRate: 0, locale: "en", extras: {} }), 3);
    expect(h1).toBe(h2);
    expect(f1).toBe(f2);
  });
});

