import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";
import { RNG } from "../../core/RNG.js";
import { toFIXDateTime } from "../../core/TemporalEngine.js";

const soh = "\x01";

function bodyLength(msg: string): number { return Buffer.byteLength(msg, "utf8"); }
function checksum(msg: string): string {
  const sum = Buffer.from(msg, "utf8").reduce((a, b) => a + b, 0);
  return String(sum % 256).padStart(3, "0");
}

export class FIXProtocolGenerator implements IGenerator {
  readonly id = "fix";
  readonly description = "FIX protocol stream";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0, extras: { version: "4.4", messageTypes: ["D"] } };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const rng = new RNG(options.seed);
    const generateFilledSeries = Boolean(options.extras.generateFilledSeries ?? true);
    const symbols = (options.extras.symbols as string[] | undefined) ?? ["AAPL", "MSFT", "GOOGL"];
    const requestedTypes = (options.extras.messageTypes as string[] | undefined) ?? ["D", "8", "F", "G"];
    let seq = 1;
    for (let i = 0; i < options.recordCount; i += 1) {
      const ordQty = rng.int(10, 200);
      const clOrdId = `ORD${options.seed}-${i + 1}`;
      const orderId = `OID${options.seed}-${i + 1}`;
      const symbol = symbols[i % symbols.length]!;

      const emit = (msgType: string, fields: string): string => {
        const base = `35=${msgType}${soh}34=${seq}${soh}49=SENDER${soh}56=TARGET${soh}52=${toFIXDateTime(new Date(Date.UTC(2026, 0, 1, 0, 0, seq % 60)))}${soh}11=${clOrdId}${soh}54=1${soh}55=${symbol}${soh}`;
        const core = `${base}${fields}`;
        const header = `8=FIX.4.4${soh}9=${bodyLength(core)}${soh}`;
        const full = `${header}${core}10=${checksum(`${header}${core}`)}${soh}`;
        seq += 1;
        return full;
      };

      yield emit("D", `21=1${soh}38=${ordQty}${soh}40=2${soh}`);
      if (!generateFilledSeries) continue;

      const fate = rng.weightedPick([
        { value: "full", weight: 40 },
        { value: "partialThenFull", weight: 30 },
        { value: "cancel", weight: 20 },
        { value: "reject", weight: 10 },
      ]);

      if (fate === "full") {
        const px = Number(rng.float(100, 120).toFixed(2));
        yield emit("8", `6=${px.toFixed(2)}${soh}14=${ordQty}${soh}17=EX${seq}${soh}37=${orderId}${soh}39=2${soh}150=2${soh}151=0${soh}38=${ordQty}${soh}`);
      } else if (fate === "partialThenFull") {
        const q1 = rng.int(1, ordQty - 1);
        const q2 = ordQty - q1;
        const p1 = Number(rng.float(100, 110).toFixed(2));
        const p2 = Number(rng.float(110, 120).toFixed(2));
        const avg = ((p1 * q1) + (p2 * q2)) / ordQty;
        yield emit("8", `6=${p1.toFixed(2)}${soh}14=${q1}${soh}17=EX${seq}${soh}37=${orderId}${soh}39=1${soh}150=1${soh}151=${q2}${soh}38=${ordQty}${soh}`);
        yield emit("8", `6=${avg.toFixed(2)}${soh}14=${ordQty}${soh}17=EX${seq}${soh}37=${orderId}${soh}39=2${soh}150=2${soh}151=0${soh}38=${ordQty}${soh}`);
      } else if (fate === "cancel") {
        yield emit("F", `38=${ordQty}${soh}41=${clOrdId}${soh}60=${toFIXDateTime(new Date(Date.UTC(2026, 0, 1, 0, 1, seq % 60)))}${soh}`);
        yield emit("8", `6=0.00${soh}14=0${soh}17=EX${seq}${soh}37=${orderId}${soh}39=4${soh}150=4${soh}151=${ordQty}${soh}38=${ordQty}${soh}`);
      } else {
        yield emit("8", `6=0.00${soh}14=0${soh}17=EX${seq}${soh}37=${orderId}${soh}39=8${soh}150=8${soh}151=${ordQty}${soh}38=${ordQty}${soh}`);
      }
      if (requestedTypes.includes("G") && rng.bool(0.2)) {
        yield emit("G", `38=${ordQty}${soh}41=${clOrdId}${soh}40=2${soh}`);
      }
    }
  }
}

