import { samePosition, type Position } from './position';

export class NoteSession {
  returnPoint?: Position;
  readonly back: Position[] = [];
  readonly forward: Position[] = [];
  constructor(readonly limit = 50) {}

  private push(stack: Position[], point: Position) {
    if (!stack.length || !samePosition(stack[stack.length - 1], point)) stack.push(point);
    if (stack.length > this.limit) stack.splice(0, stack.length - this.limit);
  }

  depart(point: Position) {
    this.push(this.back, point);
    this.forward.length = 0;
  }

  /** Peek first; mutate only after the adapter successfully restores the target. */
  target(direction: 'back' | 'forward', current: Position): Position | undefined {
    return [...this[direction]].reverse().find(point => !samePosition(point, current));
  }

  commit(direction: 'back' | 'forward', target: Position, current: Position) {
    const stack = this[direction];
    const index = stack.lastIndexOf(target);
    if (index < 0) return;
    stack.splice(index);
    this.push(direction === 'back' ? this.forward : this.back, current);
  }
}

/** LRU bound prevents long sessions from accumulating unlimited note state. */
export class SessionStore {
  private notes = new Map<string, NoteSession>();
  constructor(readonly limit = 100) {}
  get(path: string): NoteSession {
    const note = this.notes.get(path) ?? new NoteSession();
    this.notes.delete(path);
    this.notes.set(path, note);
    if (this.notes.size > this.limit) this.notes.delete(this.notes.keys().next().value!);
    return note;
  }
  rename(oldPath: string, newPath: string) {
    for (const [path, note] of [...this.notes]) {
      if (path === oldPath || path.startsWith(oldPath + '/')) {
        this.notes.delete(path);
        this.notes.set(newPath + path.slice(oldPath.length), note);
      }
    }
  }
  delete(path: string) {
    for (const key of this.notes.keys()) if (key === path || key.startsWith(path + '/')) this.notes.delete(key);
  }
  clear() { this.notes.clear(); }
}
