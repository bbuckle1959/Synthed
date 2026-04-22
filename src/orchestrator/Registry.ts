import type { IGenerator, IValidator } from "../core/interfaces.js";

export class Registry {
  private generators = new Map<string, IGenerator>();
  private validators = new Map<string, IValidator>();

  registerGenerator(generator: IGenerator): void {
    this.generators.set(generator.id, generator);
  }

  registerValidator(validator: IValidator): void {
    this.validators.set(validator.id, validator);
  }

  getGenerator(id: string): IGenerator {
    const gen = this.generators.get(id);
    if (!gen) throw new Error(`Unknown generator: ${id}`);
    return gen;
  }

  getValidator(id: string): IValidator {
    const val = this.validators.get(id);
    if (!val) throw new Error(`Unknown validator: ${id}`);
    return val;
  }

  listGenerators(): IGenerator[] {
    return [...this.generators.values()];
  }
}

