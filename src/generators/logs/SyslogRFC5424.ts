import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";

export class SyslogRFC5424Generator implements IGenerator {
  readonly id = "syslog-rfc5424";
  readonly description = "RFC5424 syslog";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0 };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const pri = [134, 35, 28];
    const offsets = ["+00:00", "+05:30", "-05:00", "+05:45"];
    const sd = [
      `[timeQuality tzKnown="1" isSynced="1"]`,
      `[origin ip="10.1.2.3" enterpriseId="32473"][meta sequenceId="42"]`,
      `[audit@32473 actor="svc-auth" action="login"]`,
    ];
    for (let i = 0; i < options.recordCount; i += 1) {
      const procid = i % 3 === 0 ? "-" : String(1000 + i);
      const msgid = i % 4 === 0 ? "-" : `MSG${i}`;
      const ts = `2026-04-21T12:00:00${offsets[i % offsets.length]}`;
      yield `<${pri[i % pri.length]}>1 ${ts} HOST APP ${procid} ${msgid} ${sd[i % sd.length]} sample message ${i}\n`;
    }
  }
}

