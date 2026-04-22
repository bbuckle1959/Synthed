import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";

export class WindowsEventLogGenerator implements IGenerator {
  readonly id = "windows-evtx";
  readonly description = "Windows event log XML snippets";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0 };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const eventIds = [4624, 4625, 4688, 7045, 4768, 4769, 4776];
    const domainSidBase = "S-1-5-21-1111111111-2222222222-3333333333";
    const eventFields: Record<number, string[]> = {
      4624: ["SubjectUserName", "SubjectDomainName", "TargetUserName", "TargetDomainName", "LogonType"],
      4625: ["SubjectUserName", "SubjectDomainName", "TargetUserName", "TargetDomainName", "LogonType", "FailureReason", "Status", "SubStatus"],
      4688: ["NewProcessName", "CommandLine", "SubjectUserName"],
      7045: ["ServiceName", "ServiceFileName", "ServiceType", "ServiceStartType"],
      4768: ["ClientName", "ClientDomain", "ServiceName", "TicketOptions", "Status"],
      4769: ["ClientName", "ServiceName", "TicketOptions"],
      4776: ["TargetUserName", "Workstation", "Status"],
    };
    for (let i = 0; i < options.recordCount; i += 1) {
      const id = eventIds[i % eventIds.length];
      const data = eventFields[id]!.map((f) => {
        const v = f === "LogonType"
          ? String([2, 3, 4, 5, 7, 10][i % 6])
          : f.includes("Status")
            ? "0x0"
            : `${f.toLowerCase()}${i}`;
        return `<Data Name="${f}">${v}</Data>`;
      }).join("");
      const sid = `${domainSidBase}-${1000 + i}`;
      yield `<Event><System><EventID>${id}</EventID><Computer>WORKSTATION01</Computer><Security UserID="${sid}"/></System><EventData>${data}</EventData></Event>\n`;
    }
  }
}

