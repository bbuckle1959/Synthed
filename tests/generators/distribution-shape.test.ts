import { describe, expect, it } from "vitest";
import { ApacheAccessLogGenerator } from "../../src/generators/logs/ApacheAccessLog.js";
import { CDRGenerator } from "../../src/generators/telecom/CDR.js";

describe("Distribution shape checks", () => {
  it("apache status distribution roughly matches expected profile", async () => {
    const g = new ApacheAccessLogGenerator();
    const counts = new Map<number, number>();
    let total = 0;
    for await (const line of g.generate({ seed: 99, recordCount: 2000, corrupt: false, corruptRate: 0, locale: "en", extras: {} })) {
      const status = Number(line.match(/"\s(\d{3})\s/)?.[1] ?? "0");
      counts.set(status, (counts.get(status) ?? 0) + 1);
      total += 1;
    }
    const p200 = (counts.get(200) ?? 0) / total;
    const p404 = (counts.get(404) ?? 0) / total;
    expect(p200).toBeGreaterThan(0.65);
    expect(p200).toBeLessThan(0.8);
    expect(p404).toBeGreaterThan(0.06);
    expect(p404).toBeLessThan(0.15);
  });

  it("cdr hour profile is not flat and favors business/evening", async () => {
    const g = new CDRGenerator();
    const buckets = Array.from({ length: 24 }, () => 0);
    let total = 0;
    for await (const line of g.generate({ seed: 100, recordCount: 2000, corrupt: false, corruptRate: 0, locale: "en", extras: {} })) {
      if (line.startsWith("calldate,")) continue;
      const hour = Number(line.slice(11, 13));
      if (!Number.isNaN(hour)) buckets[hour] += 1;
      total += 1;
    }
    const businessEvening = buckets.slice(9, 22).reduce((a, b) => a + b, 0) / total;
    const overnight = [...buckets.slice(0, 6), ...buckets.slice(22)].reduce((a, b) => a + b, 0) / total;
    expect(businessEvening).toBeGreaterThan(0.65);
    expect(overnight).toBeLessThan(0.2);
  });
});

