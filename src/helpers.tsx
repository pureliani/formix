import { type ZodIssue, type ZodTypeAny, ZodObject, ZodArray, ZodOptional, ZodNullable } from "zod";
import type { FormixError, Initializer, Update } from ".";

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

  if (
    Object.prototype.toString.call(a) === "[object Object]" &&
    Object.prototype.toString.call(b) === "[object Object]"
  ) {
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

export function createUndoRedoManager<T>(
  initialState: T,
  maxHistorySize = 500,
) {
  let state: UndoRedoState<T> = {
    history: [initialState],
    currentIndex: 0,
  };

  const setState = (newState: T) => {
    state = {
      history: [
        ...state.history.slice(0, state.currentIndex + 1),
        newState,
      ].slice(-maxHistorySize),
      currentIndex: Math.min(state.currentIndex + 1, maxHistorySize - 1),
    };
  };

  const undo = (steps = 1): T => {
    state.currentIndex = Math.max(0, state.currentIndex - steps);
    return state.history[state.currentIndex] as T;
  };

  const redo = (steps = 1): T => {
    state.currentIndex = Math.min(
      state.history.length - 1,
      state.currentIndex + steps,
    );
    return state.history[state.currentIndex] as T;
  };

  const canUndo = (steps = 1): boolean => state.currentIndex >= steps;
  const canRedo = (steps = 1): boolean =>
    state.currentIndex + steps < state.history.length;
  const getCurrentState = (): T => state.history[state.currentIndex] as T;

  return { setState, undo, redo, canUndo, canRedo, getCurrentState };
}

export function get<T = any>(obj: any, path: string): T | undefined {
  if (path === "") return obj;
  const keys = path.split(".");
  const lastKey = keys.pop();
  if (!lastKey) return obj;
  let result = obj;

  for (const key of keys) {
    if (Array.isArray(result) && /^\d+$/.test(key)) {
      const index = Number.parseInt(key, 10);
      result = result?.[index];
    } else if (Object.prototype.toString.call(result) === "[object Object]") {
      result = result?.[key];
    } else {
      return undefined;
    }
  }

  return result?.[lastKey];
}

export function set(obj: any, path: string, value: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (path === '') {
    return obj;
  }

  const keys = path.split('.');

  const emptyKeyIndex = keys.findIndex(key => key === '');
  if (emptyKeyIndex != -1) {
    throw new Error(`@gapu/formix: failed to update nested property, empty key at index ${emptyKeyIndex}`);
  }

  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const segment = keys[i];
    const nextSegment = keys[i + 1];

    if (segment === undefined) {
      throw new Error(`@gapu/formix: undefined segment at index ${i}`);
    }

    if (!(segment in current)) {
      current[segment] = nextSegment !== undefined && !isNaN(Number(nextSegment)) ? [] : {};
    } else if (typeof current[segment] !== 'object') {
      current[segment] = {};
    }

    current = current[segment];
  }

  const lastSegment = keys[keys.length - 1];
  if (lastSegment === undefined) {
    throw new Error(`@gapu/formix: undefined last segment`);
  }

  if (Array.isArray(current) && isNaN(Number(lastSegment))) {
    throw new Error(`@gapu/formix: cannot use non-numeric index on array`);
  }

  current[lastSegment] = value;

  return result;
}

export async function getUpdatedValue<T, R>(
  prev: T,
  update: Update<T, R>,
): Promise<R> {
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

export const formatZodIssues = (errors: ZodIssue[]): FormixError[] => {
  return errors.map((e) => ({
    path: e.path.join("."),
    message: e.message,
  }));
};

const isFieldRequiredCheck = (currentSchema: ZodTypeAny, variant: NullOrOptional[]) => {
  const checkNullable = variant.includes("nullable")
  const checkOptional = variant.includes("optional")

  if (checkNullable && checkOptional) {
    return !(currentSchema instanceof ZodOptional || currentSchema instanceof ZodNullable)
  }

  if (checkNullable) {
    return !(currentSchema instanceof ZodNullable)
  }

  if (checkOptional) {
    return !(currentSchema instanceof ZodOptional)
  }

  return true
}

export type NullOrOptional = "nullable" | "optional"
export function isFieldRequired(
  schema: ZodTypeAny,
  path: string,
  variant: NullOrOptional[] = ["nullable", "optional"]
): boolean {
  if (path === '') {
    return isFieldRequiredCheck(schema, variant);
  }

  const parts = path.split('.');
  let currentSchema: ZodTypeAny = schema;

  for (const part of parts) {
    if (currentSchema instanceof ZodObject) {
      const shape = currentSchema.shape;
      if (!(part in shape)) {
        throw new Error(`@gapu/formix: Invalid path: ${path}. Property "${part}" does not exist.`);
      }
      currentSchema = shape[part];
    } else if (currentSchema instanceof ZodArray) {
      const index = parseInt(part, 10);
      if (isNaN(index)) {
        throw new Error(`@gapu/formix: Invalid array index: ${part} in path: ${path}`);
      }
      currentSchema = currentSchema.element;
    } else {
      throw new Error(`@gapu/formix: Invalid path: ${path}. "${part}" is not an object or array.`);
    }
  }

  return isFieldRequiredCheck(currentSchema, variant)
}
