import type { Initializer, Update } from ".";

export function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Object.prototype.toString.call(a) === '[object Object]' &&
    Object.prototype.toString.call(b) === '[object Object]') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!isEqual(a[key], b[key])) return false;
    }

    return true;
  }

  return false;
}

type UndoRedoState<T> = {
  history: T[];
  currentIndex: number;
};

export function createUndoRedoManager<T>(initialState: T, maxHistorySize: number = 350) {
  let state: UndoRedoState<T> = {
    history: [initialState],
    currentIndex: 0,
  };

  const setState = (newState: T) => {
    state = {
      history: [
        ...state.history.slice(0, state.currentIndex + 1),
        newState
      ].slice(-maxHistorySize),
      currentIndex: Math.min(state.currentIndex + 1, maxHistorySize - 1),
    };
  };

  const undo = (steps: number = 1): T => {
    state.currentIndex = Math.max(0, state.currentIndex - steps);
    return state.history[state.currentIndex]!;
  };

  const redo = (steps: number = 1): T => {
    state.currentIndex = Math.min(state.history.length - 1, state.currentIndex + steps);
    return state.history[state.currentIndex]!;
  };

  const canUndo = (steps: number = 1): boolean => state.currentIndex >= steps;
  const canRedo = (steps: number = 1): boolean => state.currentIndex + steps < state.history.length;
  const getCurrentState = (): T => state.history[state.currentIndex]!;

  return { setState, undo, redo, canUndo, canRedo, getCurrentState };
}

export function get<T = any>(obj: any, path: string): T | undefined {
  if (path === '') return obj;
  const keys = path.split('.');
  const lastKey = keys.pop()
  if (!lastKey) return obj;
  let result = obj;


  for (const key of keys) {
    if (Array.isArray(result) && /^\d+$/.test(key)) {
      const index = parseInt(key, 10);
      result = result?.[index];
    } else if (Object.prototype.toString.call(result) === '[object Object]') {
      result = result?.[key];
    } else {
      return undefined
    }
  }

  return result?.[lastKey];
}

export function set<T>(obj: T, path: string, value: any): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (path === '' || path === '.') {
    return obj;
  }

  const keys = path.split('.');
  const result = { ...obj };
  let current: any = result;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]?.trim();
    if (key === undefined || key === '') {
      throw new Error(`@gapu/formix: failed to update nested property, empty segment at index ${i}`);
    }

    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      if (!(key in current)) {
        current[key] = /^\d+$/.test(keys[i + 1] || '') ? [] : {};
      } else {
        current[key] = Array.isArray(current[key])
          ? [...current[key]]
          : { ...current[key] };
      }
      current = current[key];
    }
  }

  return result;
}

export async function getUpdatedValue<T, R>(prev: T, update: Update<T, R>): Promise<R> {
  if (update instanceof Function) {
    const result = update(prev);
    return result instanceof Promise ? await result : result;
  }
  return update;
}

export async function getInitialValue<T>(init: Initializer<T>): Promise<T> {
  if (init instanceof Function) {
    const result = init();
    return result instanceof Promise ? await result : result;
  }
  return init;
}
