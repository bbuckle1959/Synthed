import { RNG } from "./RNG.js";
import { luhnCheckDigit } from "./luhn.js";

const FIRST = ["James", "Maria", "Aisha", "Noah", "Liam", "Olivia", "Ava", "Emma"];
const LAST = ["Smith", "Patel", "Nguyen", "Garcia", "Jones", "Brown", "Wilson", "Lee"];
const ICD10 = ["E11.9", "I10", "J06.9", "M54.5", "F32.9", "K21.9", "N39.0", "L20.9", "R07.9", "Z00.0"];
const CPT = ["99213", "99214", "93000", "80053", "85025", "36415", "81003", "71046", "12001", "97530"];
const SNOMED = ["44054006", "22298006", "195967001", "386661006", "38341003"];
const RXNORM = ["1049630", "860975", "617320", "313782", "198440"];
const AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/126.0",
  "curl/8.8.0",
  "PostmanRuntime/7.43.0",
  "python-requests/2.32.3",
  "Go-http-client/2.0",
];

export class FieldProvider {
  private controlCounter = 0;
  constructor(private readonly rng: RNG) {}
  firstName(): string { return this.rng.pick(FIRST); }
  lastName(): string { return this.rng.pick(LAST); }
  fullName(): string { return `${this.firstName()} ${this.lastName()}`; }
  dob(minAge = 18, maxAge = 90): string {
    const age = this.rng.int(minAge, maxAge);
    const year = new Date().getUTCFullYear() - age;
    return `${year}-${String(this.rng.int(1, 12)).padStart(2, "0")}-${String(this.rng.int(1, 28)).padStart(2, "0")}`;
  }
  sex(): string { return this.rng.pick(["M", "F", "O", "U", "A", "N", "C"]); }
  phone(): string { return `+1${this.rng.int(2000000000, 9999999999)}`; }
  ipv4(): string { return `${this.rng.int(1, 255)}.${this.rng.int(0, 255)}.${this.rng.int(0, 255)}.${this.rng.int(0, 255)}`; }
  ipv4Private(): string { return `10.${this.rng.int(0, 255)}.${this.rng.int(0, 255)}.${this.rng.int(1, 254)}`; }
  ipv6(): string { return Array.from({ length: 8 }, () => this.rng.int(0, 65535).toString(16)).join(":"); }
  macAddress(): string { return Array.from({ length: 6 }, () => this.rng.int(0, 255).toString(16).padStart(2, "0")).join(":"); }
  port(): number { return this.rng.int(1, 65535); }
  userAgent(): string { return this.rng.pick(AGENTS); }
  httpMethod(): string { return this.rng.pick(["GET", "POST", "PUT", "PATCH", "DELETE"]); }
  httpPath(): string { return this.rng.pick(["/", "/api/v1/users", "/search?q=test", "/healthz"]); }
  httpStatusCode(errorRate = 0.2): number { return this.rng.bool(1 - errorRate) ? 200 : this.rng.pick([400, 401, 403, 404, 429, 500, 503]); }
  responseBytes(statusCode: number): number { return statusCode === 304 ? 0 : this.rng.int(64, 32768); }
  npi(): string { const base = `1${this.rng.int(10000000, 99999999)}`; return `${base}${luhnCheckDigit(`80840${base}`)}`; }
  mrn(): string { return `MRN${this.rng.int(100000, 999999)}`; }
  icd10Code(): string { return this.rng.pick(ICD10); }
  cptCode(): string { return this.rng.pick(CPT); }
  snomedCode(): string { return this.rng.pick(SNOMED); }
  rxNormCode(): string { return this.rng.pick(RXNORM); }
  loincObservation(): { code: string; display: string; unit: string; low: number; high: number } {
    return this.rng.pick([{ code: "4544-3", display: "Hematocrit", unit: "%", low: 36, high: 52 }, { code: "718-7", display: "Hemoglobin", unit: "g/dL", low: 12, high: 18 }]);
  }
  labResult(obs: { low: number; high: number }): number { return parseFloat(this.rng.float(obs.low - 3, obs.high + 3).toFixed(this.rng.int(1, 4))); }
  hl7SendingApp(): string { return this.rng.pick(["EPIC", "CERNER", "MEDITECH"]); }
  hl7Facility(): string { return this.rng.pick(["MEMORIAL_HOSP", "CITY_CLINIC", "GENERAL_MED"]); }
  equitySymbol(): string { return this.rng.pick(["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]); }
  fxPair(): string { return this.rng.pick(["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"]); }
  equityPrice(): number { return parseFloat(this.rng.float(10, 500).toFixed(2)); }
  fxRate(): number { return parseFloat(this.rng.float(0.5, 2).toFixed(5)); }
  orderQty(): number { return this.rng.int(1, 10000); }
  swiftBic(): string { return this.rng.pick(["BARCGB22", "BNPAFRPP", "DEUTDEFF", "CHASUS33"]); }
  iban(countryCode = "DE"): string { return `${countryCode}${this.rng.int(10, 99)}${this.rng.int(10000000, 99999999)}${this.rng.int(10000000, 99999999)}`; }
  claimId(): string { return `CLM-${this.rng.int(100000, 999999)}`; }
  e164Phone(countryCode = "+1"): string { return `${countryCode}${this.rng.int(2000000000, 9999999999)}`; }
  imei(): string { const base = `${this.rng.int(10000000000000, 99999999999999)}`.slice(0, 14); return `${base}${luhnCheckDigit(base)}`; }
  imsi(mcc = "234", mnc = "10"): string { return `${mcc}${mnc}${this.rng.int(1000000000, 9999999999)}`; }
  callDurationSeconds(): number { return Math.max(0, Math.round(this.rng.logNormal(4.5, 1.1))); }
  callDisposition(durationSeconds: number): string { return durationSeconds > 0 ? "ANSWERED" : this.rng.pick(["NO ANSWER", "FAILED", "BUSY"]); }
  controlNumber(digits: number): string { return `${this.rng.int(10 ** (digits - 1), 10 ** digits - 1)}`; }
  messageControlId(): string {
    this.controlCounter += 1;
    return `${this.rng.seed}-${String(this.controlCounter).padStart(8, "0")}-${this.rng.int(1000, 9999)}`;
  }
}

