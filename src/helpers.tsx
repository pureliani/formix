import { type ZodIssue, type ZodTypeAny, ZodObject, ZodArray, ZodOptional, ZodNullable } from "zod";
import type { FormixError, Update } from ".";

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
  if (emptyKeyIndex !== -1) {
    throw new Error(`@gapu/formix: failed to update nested property, empty key at index ${emptyKeyIndex}`);
  }

  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = result;
  let parent: any = undefined;
  let lastKey: string | undefined = undefined;

  for (let i = 0; i < keys.length; i++) {
    const segment = keys[i];

    if (segment === undefined) {
      throw new Error(`@gapu/formix: undefined segment at index ${i}`);
    }

    if (i === keys.length - 1) {
      if (Array.isArray(current) && isNaN(Number(segment))) {
        throw new Error(`@gapu/formix: cannot use non-numeric index on array`);
      }
      if (parent && lastKey !== undefined) {
        parent[lastKey] = Array.isArray(current) ? [...current] : { ...current };
        current = parent[lastKey];
      }
      current[segment] = value;
    } else {
      if (!(segment in current)) {
        current[segment] = keys[i + 1] !== undefined && !isNaN(Number(keys[i + 1])) ? [] : {};
      } else if (typeof current[segment] !== 'object') {
        current[segment] = {};
      } else {
        current[segment] = Array.isArray(current[segment]) ? [...current[segment]] : { ...current[segment] };
      }
      parent = current;
      lastKey = segment;
      current = current[segment];
    }
  }

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
