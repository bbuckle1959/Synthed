import { describe, expect, it } from "vitest";
import { FIXProtocolGenerator } from "../../src/generators/finance/FIXProtocol.js";

describe("FIX generator", () => {
  it("contains tag 8, 9, 10", async () => {
    const g = new FIXProtocolGenerator();
    const arr: string[] = [];
    for await (const x of g.generate({ seed: 1, recordCount: 1, corrupt: false, corruptRate: 0, locale: "en", extras: {} })) arr.push(x);
    expect(arr[0]).toContain("8=FIX");
    expect(arr[0]).toContain("9=");
    expect(arr[0]).toContain("10=");
  });

  it("can emit 35=G messages when requested", async () => {
    const g = new FIXProtocolGenerator();
    const arr: string[] = [];
    for await (const x of g.generate({ seed: 3, recordCount: 20, corrupt: false, corruptRate: 0, locale: "en", extras: { messageTypes: ["D", "8", "F", "G"] } })) arr.push(x);
    expect(arr.some((m) => m.includes("\x0135=G\x01"))).toBe(true);
  });
});

