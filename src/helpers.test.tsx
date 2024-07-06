import { z, type ZodTypeAny } from 'zod';
import { describe, expect, it } from "vitest";
import { createUndoRedoManager, get, isEqual, set, isFieldRequired, type NullOrOptional } from "./helpers";

describe("isEqual", () => {
  it("should return true for identical primitives", () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual("hello", "hello")).toBe(true);
    expect(isEqual(true, true)).toBe(true);
    expect(isEqual(null, null)).toBe(true);
    expect(isEqual(undefined, undefined)).toBe(true);
  });

  it("should return false for different primitives", () => {
    expect(isEqual(1, 2)).toBe(false);
    expect(isEqual("hello", "world")).toBe(false);
    expect(isEqual(true, false)).toBe(false);
    expect(isEqual(null, undefined)).toBe(false);
  });

  it("should handle null and undefined", () => {
    expect(isEqual(null, undefined)).toBe(false);
    expect(isEqual(undefined, null)).toBe(false);
    expect(isEqual(null, {})).toBe(false);
    expect(isEqual(undefined, {})).toBe(false);
  });

  it("should compare dates correctly", () => {
    const date1 = new Date("2023-01-01");
    const date2 = new Date("2023-01-01");
    const date3 = new Date("2023-01-02");
    expect(isEqual(date1, date2)).toBe(true);
    expect(isEqual(date1, date3)).toBe(false);
  });

  it("should compare regular expressions correctly", () => {
    expect(isEqual(/hello/, /hello/)).toBe(true);
    expect(isEqual(/hello/i, /hello/i)).toBe(true);
    expect(isEqual(/hello/, /world/)).toBe(false);
    expect(isEqual(/hello/i, /hello/g)).toBe(false);
  });

  it("should compare arrays correctly", () => {
    expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isEqual([1, 2, 3], [1, 2, 3, 4])).toBe(false);
    expect(isEqual([1, 2, [3, 4]], [1, 2, [3, 4]])).toBe(true);
    expect(isEqual([1, 2, [3, 4]], [1, 2, [3, 5]])).toBe(false);
  });

  it("should compare objects correctly", () => {
    expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(isEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    expect(isEqual({ a: 1, b: { c: 3 } }, { a: 1, b: { c: 3 } })).toBe(true);
    expect(isEqual({ a: 1, b: { c: 3 } }, { a: 1, b: { c: 4 } })).toBe(false);
  });

  it("should handle nested structures", () => {
    const obj1 = { a: [1, { b: 2 }], c: { d: new Date("2023-01-01") } };
    const obj2 = { a: [1, { b: 2 }], c: { d: new Date("2023-01-01") } };
    const obj3 = { a: [1, { b: 3 }], c: { d: new Date("2023-01-01") } };
    expect(isEqual(obj1, obj2)).toBe(true);
    expect(isEqual(obj1, obj3)).toBe(false);
  });

  it("should return false for different types", () => {
    expect(isEqual(1, "1")).toBe(false);
    expect(isEqual([], {})).toBe(false);
    expect(isEqual(new Date(), "2023-01-01")).toBe(false);
    expect(isEqual(/hello/, "hello")).toBe(false);
  });
});

describe("get", () => {
  it("should return the value at the specified path in an object", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(get(obj, "a.b.c")).toBe(42);
  });

  it("should return undefined for non-existent paths", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(get(obj, "a.b.d")).toBeUndefined();
    expect(get(obj, "x.y.z")).toBeUndefined();
  });

  it("should handle arrays", () => {
    const obj = { a: [{ b: 1 }, { b: 2 }, { b: 3 }] };
    expect(get(obj, "a.1.b")).toBe(2);
  });

  it("should handle mixed object and array paths", () => {
    const obj = {
      users: [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 40 },
      ],
    };
    expect(get(obj, "users.0.name")).toBe("Alice");
    expect(get(obj, "users.1.age")).toBe(40);
  });

  it("should return the entire object if path is empty", () => {
    const obj = { a: 1, b: 2 };
    expect(get(obj, "")).toEqual(obj);
  });

  it("should handle null and undefined", () => {
    expect(get(null, "a.b.c")).toBeUndefined();
    expect(get(undefined, "a.b.c")).toBeUndefined();
  });

  it("should handle numbers in path for accessing array indices", () => {
    const obj = { a: [10, 20, 30] };
    expect(get(obj, "a.0")).toBe(10);
    expect(get(obj, "a.2")).toBe(30);
  });

  it("should return undefined for out-of-bounds array indices", () => {
    const obj = { a: [10, 20, 30] };
    expect(get(obj, "a.3")).toBeUndefined();
    expect(get(obj, "a.-1")).toBeUndefined();
  });

  it("should handle deeply nested structures", () => {
    const obj = { a: { b: { c: [{ d: { e: "found" } }] } } };
    expect(get(obj, "a.b.c.0.d.e")).toBe("found");
  });

  it("should return the correct type", () => {
    const obj = { a: { b: { c: 42 } } };
    const result: number | undefined = get(obj, "a.b.c");
    expect(typeof result).toBe("number");
  });
});

describe("set", () => {
  it("should set a value on a simple object", () => {
    const obj = { a: 1 };
    const result = set(obj, "b", 2);
    expect(result).toEqual({ a: 1, b: 2 });
    expect(obj).toEqual({ a: 1 });
  });

  it("should update an existing value", () => {
    const obj = { a: 1, b: 2 };
    const result = set(obj, "b", 3);
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it("should set a nested value", () => {
    const obj = { a: { b: 1 } };
    const result = set(obj, "a.c", 2);
    expect(result).toEqual({ a: { b: 1, c: 2 } });
  });

  it("should create nested objects if they don't exist", () => {
    const obj = {};
    const result = set(obj, "a.b.c", 1);
    expect(result).toEqual({ a: { b: { c: 1 } } });
  });

  it("should work with arrays", () => {
    const obj = { users: ["Alice", "Bob"] };
    const result = set(obj, "users.1", "Charlie");
    expect(result).toEqual({ users: ["Alice", "Charlie"] });
  });

  it("should create arrays if necessary", () => {
    const obj = {};
    const result = set(obj, "users.0", "Alice");
    expect(result).toEqual({ users: ["Alice"] });
  });

  it("should return the same object if path is empty", () => {
    const obj = { a: 1 };
    const result = set(obj, "", 2);
    expect(result).toEqual({ a: 1 });
  });

  it("should return the same object if key is undefined", () => {
    const obj = { a: 1 };
    const result = set(obj, ".", 2);
    expect(result).toEqual({ a: 1 });
  });

  it("should handle non-object values", () => {
    const value = 42;
    const result = set(value, "a.b", 2);
    expect(result).toBe(42);
  });

  it("should throw an error for path with empty segment", () => {
    const obj = { a: 1 };
    expect(() => set(obj, "a..b", 2)).toThrow(
      "@gapu/formix: failed to update nested property, empty segment at index 1",
    );
  });

  it("should throw an error for path starting with a dot", () => {
    const obj = { a: 1 };
    expect(() => set(obj, ".a.b", 2)).toThrow(
      "@gapu/formix: failed to update nested property, empty segment at index 0",
    );
  });

  it("should throw an error for path ending with a dot", () => {
    const obj = { a: 1 };
    expect(() => set(obj, "a.b.", 2)).toThrow(
      "@gapu/formix: failed to update nested property, empty segment at index 2",
    );
  });

  it("should throw an error for path with consecutive dots", () => {
    const obj = { a: 1 };
    expect(() => set(obj, "a...b", 2)).toThrow(
      "@gapu/formix: failed to update nested property, empty segment at index 1",
    );
  });

  it("should not throw an error for valid paths", () => {
    const obj = { a: 1 };
    expect(() => set(obj, "a.b", 2)).not.toThrow();
    expect(() => set(obj, "c", 3)).not.toThrow();
    expect(() => set(obj, "d.1", 3)).not.toThrow();
  });

  it("should set a value in a root array", () => {
    const arr = [1, 2, 3];
    const result = set(arr, "1", 4);
    expect(result).toEqual([1, 4, 3]);
    expect(arr).toEqual([1, 2, 3]);
  });

  it("should add a value to a root array", () => {
    const arr = [1, 2, 3];
    const result = set(arr, "3", 4);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it("should create nested objects in a root array", () => {
    const arr = [1, 2, 3];
    const result = set(arr, "3.a.b", 4);
    expect(result).toEqual([1, 2, 3, { a: { b: 4 } }]);
  });

  it("should update nested values in a root array", () => {
    const arr = [1, { a: 2 }, 3];
    const result = set(arr, "1.a", 4);
    expect(result).toEqual([1, { a: 4 }, 3]);
  });

  it("should handle out-of-bounds indices in a root array", () => {
    const arr = [1, 2, 3];
    const result = set(arr, "5", 4);
    expect(result).toEqual([1, 2, 3, undefined, undefined, 4]);
  });

  it("should create a nested array in a root array", () => {
    const arr = [1, 2, 3];
    const result = set(arr, "3.0", 4);
    expect(result).toEqual([1, 2, 3, [4]]);
  });
});

describe("createUndoRedoManager", () => {
  it("should initialize with the initial state", () => {
    const manager = createUndoRedoManager(0);
    expect(manager.getCurrentState()).toBe(0);
  });

  it("should update state and allow undo/redo", () => {
    const manager = createUndoRedoManager(0);
    manager.setState(1);
    manager.setState(2);
    expect(manager.getCurrentState()).toBe(2);
    expect(manager.undo()).toBe(1);
    expect(manager.redo()).toBe(2);
  });

  it("should respect maxHistorySize", () => {
    const manager = createUndoRedoManager(0, 3);
    manager.setState(1);
    manager.setState(2);
    manager.setState(3);
    manager.setState(4);
    expect(manager.getCurrentState()).toBe(4);
    expect(manager.undo()).toBe(3);
    expect(manager.undo()).toBe(2);
    expect(manager.undo()).toBe(2);
  });

  it("should handle multiple undo/redo steps", () => {
    const manager = createUndoRedoManager(0);
    manager.setState(1);
    manager.setState(2);
    manager.setState(3);
    expect(manager.undo(2)).toBe(1);
    expect(manager.redo(2)).toBe(3);
  });

  it("should correctly report canUndo/canRedo", () => {
    const manager = createUndoRedoManager(0);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);

    manager.setState(1);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    manager.undo();
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);
  });

  it("should handle undo after new states", () => {
    const manager = createUndoRedoManager(0);
    manager.setState(1);
    manager.setState(2);
    manager.undo();
    manager.setState(3);
    expect(manager.getCurrentState()).toBe(3);
    expect(manager.undo()).toBe(1);
    expect(manager.redo()).toBe(3);
  });
});

describe('isFieldRequired', () => {
  it('should return true for required fields', () => {
    const schema = z.object({ field: z.string() });
    expect(isFieldRequired(schema, 'field')).toBe(true);
  });

  it('should return false for optional fields', () => {
    const schema = z.object({ field: z.string().optional() });
    expect(isFieldRequired(schema, 'field')).toBe(false);
  });

  it('should return false for nullable fields', () => {
    const schema = z.object({ field: z.string().nullable() });
    expect(isFieldRequired(schema, 'field')).toBe(false);
  });

  it('should return false for optional and nullable fields', () => {
    const schema = z.object({ field: z.string().optional().nullable() });
    expect(isFieldRequired(schema, 'field')).toBe(false);
  });

  const nestedSchema = z.object({
    level1: z.object({
      level2: z.object({
        field: z.string()
      })
    })
  });

  it('should handle nested required fields', () => {
    expect(isFieldRequired(nestedSchema, 'level1.level2.field')).toBe(true);
  });

  it('should handle nested optional fields', () => {
    const schema = nestedSchema.extend({
      level1: z.object({
        level2: z.object({
          field: z.string().optional(),
          field2: z.string().nullable()
        })
      })
    });
    expect(isFieldRequired(schema, 'level1.level2.field')).toBe(false);
    expect(isFieldRequired(schema, 'level1.level2.field2')).toBe(false);
  });

  it('should handle array of primitives', () => {
    const schema = z.object({ arr: z.array(z.string()) });
    expect(isFieldRequired(schema, 'arr.0')).toBe(true);
    expect(isFieldRequired(schema, 'arr.1')).toBe(true);
    expect(isFieldRequired(schema, 'arr.2')).toBe(true);
  });

  it('should handle array of objects', () => {
    const schema = z.object({
      arr: z.array(z.object({ field: z.string() }))
    });
    expect(isFieldRequired(schema, 'arr.0.field')).toBe(true);
  });

  it('should handle optional array items', () => {
    const schema = z.object({
      arr: z.array(z.object({ field: z.string().optional(), field2: z.string().nullable() }))
    });
    expect(isFieldRequired(schema, 'arr.0.field')).toBe(false);
    expect(isFieldRequired(schema, 'arr.1.field2')).toBe(false);
  });

  const mixedSchema = z.object({
    obj: z.object({
      arr: z.array(z.object({
        nested: z.object({
          field: z.string()
        })
      }))
    })
  });

  it('should handle deep nested fields in mixed schemas', () => {
    expect(isFieldRequired(mixedSchema, 'obj.arr.0.nested.field')).toBe(true);
  });

  it('should handle optional fields in mixed schemas', () => {
    const schema = mixedSchema.extend({
      obj: z.object({
        arr: z.array(z.object({
          nested: z.object({
            field: z.string().optional()
          })
        }))
      })
    });
    expect(isFieldRequired(schema, 'obj.arr.0.nested.field')).toBe(false);
  });

  it('should throw error for non-existent path', () => {
    const schema = z.object({ field: z.string() });
    expect(() => isFieldRequired(schema, 'nonexistent')).toThrow();
  });

  it('should throw error for invalid array index', () => {
    const schema = z.object({ arr: z.array(z.string()) });
    expect(() => isFieldRequired(schema, 'arr.invalid')).toThrow();
  });

  it('should throw error for accessing primitive as object', () => {
    const schema = z.object({ field: z.string() });
    expect(() => isFieldRequired(schema, 'field.invalid')).toThrow();
  });

  it('should handle empty path', () => {
    const schema = z.string();
    expect(isFieldRequired(schema, '')).toBe(true);
  });

  it('should handle root level optional schema', () => {
    const schema = z.string().optional();
    expect(isFieldRequired(schema, '')).toBe(false);
  });

  it('should respect custom nullable variant', () => {
    const schema = z.object({ field: z.string().nullable() });
    expect(isFieldRequired(schema, 'field', ['optional'])).toBe(true);
  });

  it('should respect custom optional variant', () => {
    const schema = z.object({ field: z.string().optional() });
    expect(isFieldRequired(schema, 'field', ['nullable'])).toBe(true);
  });

  it('should handle empty variant array', () => {
    const schema = z.object({ field: z.string().optional().nullable() });
    expect(isFieldRequired(schema, 'field', [])).toBe(true);
  });
});
