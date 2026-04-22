import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";

export class SWIFTMTGenerator implements IGenerator {
  readonly id = "swift-mt";
  readonly description = "SWIFT MT messages";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0 };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const types = ["103", "202", "940", "942", "950"];
    for (let i = 0; i < options.recordCount; i += 1) {
      const mt = types[i % types.length]!;
      const line61 = `:61:2403150315CR1500,00NTRFREF${String(i).padStart(3, "0")}//BANKREF${String(i).padStart(3, "0")}`;
      yield `{1:F01BARCGB22AXXX0000000000}{2:I${mt}BNPAFRPPXXXXN}{3:{108:REF${String(i).padStart(3, "0")}}}{4:\n:20:TXREF${i}\n:23B:CRED\n:32A:240315EUR125000,50\n:50K:/GB29NWBK60161331926819\nJOHN SMITH\n123 HIGH STREET\nLONDON EC1A 1BB\n:59:/DE89370400440532013000\nHANS MULLER\nHAUPTSTRASSE 1\nBERLIN\n${line61}\n:70:PAYMENT FOR INVOICE 2024-001\n:71A:OUR\n-}\n`;
    }
  }
}

