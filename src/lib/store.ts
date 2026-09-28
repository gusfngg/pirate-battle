import { useSyncExternalStore } from "react";

export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  replace(next: T): void;
  subscribe(listener: () => void): () => void;
}

// store externo minúsculo, o jogo escreve e o react lê com um seletor
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  function publish(next: T) {
    state = next;
    for (const listener of listeners) listener();
  }

  return {
    get: () => state,
    set(patch) {
      const changed = (Object.keys(patch) as (keyof T)[]).some((key) => !Object.is(state[key], patch[key]));
      if (changed) publish({ ...state, ...patch });
    },
    replace: publish,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T extends object, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
