import { type ZodIssue, type ZodTypeAny, ZodObject, ZodArray, ZodOptional, ZodNullable } from "zod";
import type { FormixError, Update } from ".";
import { createSignal } from 'solid-js';

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

export function createUndoRedoManager<T>(
  initialState: T,
  maxHistorySize = 500,
  historyPushDebounce = 500,
) {
  const [history, setHistory] = createSignal<T[]>([initialState]);
  const [index, setIndex] = createSignal(0);

  let timer: Timer | undefined = undefined
  const setState = (newState: T) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      setHistory(prev => {
        const newHistory = [...prev.slice(0, index() + 1), newState];
        return newHistory.slice(-maxHistorySize);
      });
      setIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
    }, historyPushDebounce)
  };

  const undo = (steps = 1) => {
    setIndex(prev => Math.max(prev - steps, 0));
  };

  const redo = (steps = 1) => {
    setIndex(prev => Math.min(prev + steps, history().length - 1));
  };

  const canUndo = (steps = 1) => index() >= steps;
  const canRedo = (steps = 1) => index() + steps < history().length;

  const getState = () => history()[index()]!;

  return {
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    getState,
  };
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

export function getUpdatedValue<T, R>(
  prev: T,
  update: Update<T, R>,
): R {
  return update instanceof Function ? update(prev) : update;
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
