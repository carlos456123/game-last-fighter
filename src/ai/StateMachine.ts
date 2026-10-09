/** Generic finite state machine used by the enemy AI. */
export interface MachineState<Id extends string, Ctx> {
  enter?(ctx: Ctx): void;
  /** Returns the next state id to switch to, or null to stay. */
  update(ctx: Ctx, framesInState: number): Id | null;
  exit?(ctx: Ctx): void;
}

export class StateMachine<Id extends string, Ctx> {
  private currentId: Id;
  private frames = 0;

  constructor(
    private readonly states: Record<Id, MachineState<Id, Ctx>>,
    initial: Id,
    private readonly ctx: Ctx,
  ) {
    this.currentId = initial;
    this.states[initial].enter?.(ctx);
  }

  get current(): Id {
    return this.currentId;
  }

  get framesInState(): number {
    return this.frames;
  }

  change(next: Id): void {
    if (next === this.currentId) return;
    this.states[this.currentId].exit?.(this.ctx);
    this.currentId = next;
    this.frames = 0;
    this.states[next].enter?.(this.ctx);
  }

  update(): void {
    const next = this.states[this.currentId].update(this.ctx, this.frames);
    this.frames++;
    if (next !== null) this.change(next);
  }
}
