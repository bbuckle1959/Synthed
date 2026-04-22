import { RNG } from "./RNG.js";

export class StateMachine<TState extends string> {
  #states: TState[];
  #transitions: Record<TState, Array<{ to: TState; weight: number }>>;
  #rng: RNG;
  #current: TState;

  constructor(states: TState[], transitions: Record<TState, Array<{ to: TState; weight: number }>>, rng: RNG) {
    this.#states = states;
    this.#transitions = transitions;
    this.#rng = rng;
    this.#current = states[0]!;
  }

  current(): TState {
    return this.#current;
  }

  advance(): TState {
    const options = this.#transitions[this.#current] ?? [{ to: this.#current, weight: 1 }];
    this.#current = this.#rng.weightedPick(options.map((x) => ({ value: x.to, weight: x.weight })));
    return this.#current;
  }

  path(steps: number): TState[] {
    const out: TState[] = [this.#current];
    for (let i = 0; i < steps; i += 1) out.push(this.advance());
    return out;
  }
}

