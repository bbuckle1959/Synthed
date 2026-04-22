import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";

export class EDIFACTGenerator implements IGenerator {
  readonly id = "edifact";
  readonly description = "EDIFACT ORDERS/INVOIC/DESADV/IFTMIN";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0 };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const includeUna = options.extras.includeUNA !== false;
    const unbEncoding = String(options.extras.encoding ?? "UNOC");
    const withEscapes = options.extras.withEscapes !== false;
    const delimiters = (options.extras.delimiters as { component?: string; element?: string; decimal?: string; release?: string; segment?: string } | undefined) ?? {};
    const component = delimiters.component ?? ":";
    const element = delimiters.element ?? "+";
    const decimal = delimiters.decimal ?? ".";
    const release = delimiters.release ?? "?";
    const segment = delimiters.segment ?? "'";
    for (let i = 0; i < options.recordCount; i += 1) {
      const ref = withEscapes ? `REF${release}${element}${1000 + i}` : `REF${1000 + i}`;
      const rawName = withEscapes ? `O${release}${segment}BRIEN` : "OBRIEN";
      const name = unbEncoding === "UNOA" ? rawName.toUpperCase() : rawName;
      const una = includeUna ? `UNA${component}${element}${decimal}${release} ${segment}` : "";
      const sender = unbEncoding === "UNOA" ? "SENDER" : "Sender";
      const recv = unbEncoding === "UNOA" ? "RECV" : "Recv";
      yield `${una}UNB${element}${unbEncoding}${component}3${element}${sender}${element}${recv}${element}260421${component}1200${element}${i + 1}${segment}UNH${element}1${element}ORDERS${component}D${component}96A${component}UN${segment}BGM${element}220${element}PO${1000 + i}${element}9${segment}RFF${element}ON${component}${ref}${segment}NAD${element}BY${element}12345${component}${component}9${element}${element}${name}${segment}UNT${element}5${element}1${segment}UNZ${element}1${element}${i + 1}${segment}\n`;
    }
  }
}

