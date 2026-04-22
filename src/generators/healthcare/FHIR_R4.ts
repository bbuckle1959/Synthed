import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";
import { RNG } from "../../core/RNG.js";

export class FHIRR4Generator implements IGenerator {
  readonly id = "fhir-r4";
  readonly description = "FHIR R4 bundle generator";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0, extras: { bundleType: "collection" } };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const rng = new RNG(options.seed);
    const bundleType = String(options.extras.bundleType ?? "collection");
    const profile = String(options.extras.profile ?? "base");
    for (let i = 0; i < options.recordCount; i += 1) {
      const pid = rng.uuid();
      const oid = rng.uuid();
      const partialDates = ["2024", "2024-03", "2024-03-15", "2024-03-15T09:30:00+00:00"];
      const patient: Record<string, unknown> = { resourceType: "Patient", id: pid };
      if (profile === "us-core") {
        patient.extension = [
          { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", extension: [{ url: "ombCategory", valueCoding: { code: "2106-3", system: "urn:oid:2.16.840.1.113883.6.238" } }] },
          { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", extension: [{ url: "ombCategory", valueCoding: { code: "2135-2", system: "urn:oid:2.16.840.1.113883.6.238" } }] },
          { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", valueCode: "F" },
        ];
      }
      const bundle: Record<string, unknown> = {
        resourceType: "Bundle",
        type: bundleType,
        entry: [
          { fullUrl: `urn:uuid:${pid}`, resource: patient },
          {
            fullUrl: `urn:uuid:${oid}`,
            resource: {
              resourceType: "Observation",
              id: oid,
              status: "final",
              category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
              code: { coding: [{ system: "http://loinc.org", code: "4544-3", display: "Hematocrit" }] },
              effectiveDateTime: partialDates[i % partialDates.length],
              subject: { reference: `urn:uuid:${pid}` },
              text: { status: "generated", div: "<div xmlns=\"http://www.w3.org/1999/xhtml\"><p>Synthetic observation</p></div>" },
            },
          },
          {
            fullUrl: `urn:uuid:${rng.uuid()}`,
            resource: {
              resourceType: "Condition",
              id: rng.uuid(),
              subject: { reference: `urn:uuid:${pid}` },
              code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code: "I10" }] },
              clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
              verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
            },
          },
        ],
      };
      if (bundleType === "searchset") {
        bundle.link = [
          { relation: "self", url: `${String(options.extras.baseUrl ?? "https://example.org/fhir")}/Bundle?page=${i + 1}` },
          ...(i < options.recordCount - 1 ? [{ relation: "next", url: `${String(options.extras.baseUrl ?? "https://example.org/fhir")}/Bundle?page=${i + 2}` }] : []),
        ];
      }
      yield JSON.stringify(bundle) + "\n";
    }
  }
}

