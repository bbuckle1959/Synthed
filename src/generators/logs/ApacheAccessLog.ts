import { FieldProvider } from "../../core/FieldProvider.js";
import type { GeneratorOptions, IGenerator } from "../../core/interfaces.js";
import { RNG } from "../../core/RNG.js";

export class ApacheAccessLogGenerator implements IGenerator {
  readonly id = "apache-access-log";
  readonly description = "Apache combined access logs";
  readonly defaultOptions = { locale: "en", corrupt: false, corruptRate: 0 };
  async *generate(options: GeneratorOptions): AsyncGenerator<string> {
    const rng = new RNG(options.seed);
    const fp = new FieldProvider(rng);
    const sessionPool = Array.from({ length: Math.max(10, Math.floor(options.recordCount / 10)) }, () => ({
      ip: rng.bool(0.12) ? fp.ipv6() : fp.ipv4(),
      ua: fp.userAgent(),
    }));
    const paths = ["/", "/api/v1/users", "/search%20query", "/oauth/callback?next=%2Fdashboard", "//api//v1//users"];
    const probes = ["/.env", "/wp-admin", "/etc/passwd"];
    for (let i = 0; i < options.recordCount; i += 1) {
      const status = rng.weightedPick([
        { value: 200, weight: 73 }, { value: 304, weight: 6 }, { value: 301, weight: 3 }, { value: 302, weight: 2 },
        { value: 404, weight: 10 }, { value: 400, weight: 2 }, { value: 401, weight: 1 }, { value: 403, weight: 1 }, { value: 429, weight: 1 }, { value: 500, weight: 0.4 }, { value: 502, weight: 0.2 }, { value: 503, weight: 0.2 },
      ]);
      const bytes = status === 304 ? 0 : fp.responseBytes(status);
      const session = rng.pick(sessionPool);
      const path = rng.bool(0.02)
        ? rng.pick(probes)
        : (rng.bool(0.01) ? `/redirect?next=${"a".repeat(2200)}` : rng.pick(paths));
      yield `${session.ip} - - [10/Oct/2000:13:55:36 +0000] "${fp.httpMethod()} ${path} HTTP/1.1" ${status} ${bytes} "-" "${session.ua}"\n`;
    }
  }
}

