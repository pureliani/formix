import type { z } from "zod";

import {
  batch,
  createContext,
  createMemo,
  createSignal,
  useContext,
  type JSXElement,
} from "solid-js";

import {
  formatZodIssues,
  get,
  getUpdatedValue,
  isEqual,
  isFieldRequired as _isFieldRequired,
  set,
  type NullOrOptional,
} from "./helpers";

export type { NullOrOptional }
export type Update<T, R = T> = R | ((prev: T) => R);
export type SyncUpdate<T, R = T> = R | ((prev: T) => R);

export type FieldMetaState = Readonly<{
  touched: boolean;
  dirty: boolean;
  loading: boolean;
  disabled: boolean;
  readOnly: boolean;
  show: boolean;
}>;

export const defaultFieldMetaState: FieldMetaState = {
  dirty: false,
  disabled: false,
  loading: false,
  readOnly: false,
  show: true,
  touched: false,
};

export type FieldStatus = Readonly<{
  isSettingValue: boolean;
  isSettingMeta: boolean;
}>;

export type FieldContext<T> = Readonly<{
  value: () => T;
  setValue: (update: Update<T>) => void;
  meta: () => FieldMetaState;
  setMeta: (update: Update<FieldMetaState>) => void;
  isRequired: (variant?: NullOrOptional[]) => boolean,
  errors: () => FormixError[];
  reset: () => void;
  wasModified: () => boolean;
}>;

export type FormixError = {
  path: string;
  message: string;
};

export type FormStatus = Readonly<{
  initializing: boolean;
  submitting: boolean;
  validating: boolean;
  settingState: boolean;
  settingMeta: boolean;
}>;

export type FormContextProps<State> = Readonly<{
  initialState: Readonly<State>;
  formSchema: z.ZodTypeAny
  state: () => Readonly<State>;
  setState: (path: string, update: Update<unknown>) => void;
  fieldMetas: () => Readonly<Record<string, FieldMetaState>>;
  isFieldRequired: (path: string, variant?: NullOrOptional[]) => boolean
  setFieldMetas: (update: Update<Record<string, FieldMetaState>>) => void;
  setFieldMeta: (path: string, update: Update<FieldMetaState>) => void;
  errors: () => Readonly<FormixError[]>;
  isValidating: () => boolean
  isSubmitting: () => boolean
  reset: () => void;
  submit: () => Promise<void>;
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  canUndo: (steps?: number) => boolean;
  canRedo: (steps?: number) => boolean;
  wasModified: () => boolean;
}>;

const FormContext = createContext<FormContextProps<any>>();

export type CreateFormProps<
  Schema extends z.ZodTypeAny,
  State extends z.infer<Schema>,
> = {
  schema: Schema;
  initialState: State;
  onSubmit: (state: State) => void | Promise<void>;
  undoLimit?: number;
};

type HistoryEntry = {
  path: string;
  value: any;
  prevValue: any;
};

export const defaultUndoLimit = 500

export function createForm<
  Schema extends z.ZodTypeAny,
  State extends z.infer<Schema>,
>(props: CreateFormProps<Schema, State>): FormContextProps<State> {
  const undoLimit = props.undoLimit ?? defaultUndoLimit

  const [fieldMetas, setFieldMetas] = createSignal<
    Record<string, FieldMetaState>
  >({});

  const [state, setInternalState] = createSignal(props.initialState);
  const [undoStack, setUndoStack] = createSignal<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = createSignal<HistoryEntry[]>([]);
  const [errors, setErrors] = createSignal<FormixError[]>([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [isValidating, setIsValidating] = createSignal(false)

  const revalidate = async () => {
    setIsValidating(true)
    const validationResult = await props.schema.safeParseAsync(state());
    if (!validationResult.success) {
      setErrors(formatZodIssues(validationResult.error.issues));
    } else {
      setErrors([])
    }
    setIsValidating(false)
    return validationResult;
  };
  revalidate()

  const setState = (path: string, update: Update<unknown>) => {
    const currentState = state();
    const currentValue = path.trim() === "" ? currentState : get(currentState, path);
    const nextValue = getUpdatedValue(currentValue, update)
    if (nextValue === currentValue) return;

    const entry: HistoryEntry = {
      path,
      value: nextValue,
      prevValue: currentValue,
    };

    batch(() => {
      setUndoStack(prev => {
        const newStack = [...prev, entry];
        return newStack.slice(-undoLimit);
      });
      setRedoStack([]);
      setInternalState(prevState =>
        path.trim() === "" ? nextValue as State : set(prevState, path, nextValue)
      );
    })

    revalidate()
  };

  const undo = (steps = 1) => {
    const entries = undoStack().slice(-steps);
    if (entries.length === 0) return;

    batch(() => {
      let newState = state();
      entries.reverse().forEach(entry => {
        newState = entry.path.trim() === ""
          ? entry.prevValue as State
          : set(newState, entry.path, entry.prevValue);
      });
      setInternalState(newState);
      setUndoStack(prev => prev.slice(0, -steps));
      setRedoStack(prev => {
        const newStack = [...entries.reverse(), ...prev];
        return newStack.slice(0, undoLimit);
      });
    });

    revalidate();
  };

  const redo = (steps = 1) => {
    const entries = redoStack().slice(0, steps);
    if (entries.length === 0) return;

    batch(() => {
      let newState = state();
      entries.forEach(entry => {
        newState = entry.path.trim() === ""
          ? entry.value as State
          : set(newState, entry.path, entry.value);
      });
      setInternalState(newState);
      setRedoStack(prev => prev.slice(steps));
      setUndoStack(prev => {
        const newStack = [...prev, ...entries];
        return newStack.slice(-undoLimit);
      });
    });

    revalidate();
  };

  const canUndo = (steps = 1) => undoStack().length >= steps;
  const canRedo = (steps = 1) => redoStack().length >= steps;

  const submit = async () => {
    const validationResult = await revalidate();
    if (!validationResult.success) return;

    try {
      setIsSubmitting(true)
      await props.onSubmit(validationResult.data);
    } finally {
      setIsSubmitting(false)
    }
  };

  const reset = () => setState("", props.initialState);

  const wasModified = () => !isEqual(state(), props.initialState);

  const setFieldMeta = (path: string, update: Update<FieldMetaState>) => {
    const currentMeta = fieldMetas()[path] ?? defaultFieldMetaState;
    const next = getUpdatedValue(currentMeta, update);
    setFieldMetas((prev) => ({
      ...prev,
      [path]: next,
    }));
  };

  const isFieldRequired = (path: string, variant?: NullOrOptional[]) => {
    return _isFieldRequired(props.schema, path, variant)
  }

  return {
    initialState: props.initialState,
    formSchema: props.schema,
    isFieldRequired,
    setFieldMeta,
    state,
    setState,
    isValidating,
    isSubmitting,
    fieldMetas,
    setFieldMetas,
    errors,
    reset,
    submit,
    undo,
    redo,
    canUndo,
    canRedo,
    wasModified,
  };
}

export type FormProps<State> = {
  context: FormContextProps<State>;
  children: JSXElement;
};

export function Form<T = unknown>(props: FormProps<T>) {
  return (
    <FormContext.Provider value={props.context}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await props.context.submit();
        }}
      >
        {props.children}
      </form>
    </FormContext.Provider>
  );
}

export function useForm<State = unknown>(): FormContextProps<State> {
  const c = useContext(FormContext);
  if (!c) {
    throw new Error(
      "@gapu/formix: useField, useArrayField and useForm can only be used under the 'Form' provider",
    );
  }
  return c;
}

export function useField<T>(path: string): FieldContext<T> {
  const form = useForm();

  const getMeta = createMemo(
    () =>
      form.fieldMetas()[path] ?? {
        dirty: false,
        disabled: false,
        loading: false,
        readOnly: false,
        touched: false,
        show: true,
      },
  );

  const value = () => get(form.state(), path) as T;

  const errors = () => form.errors().filter((e) => e.path.startsWith(path));

  const wasModified = createMemo(() => {
    const currentState = get(form.state(), path);
    const initialState = get(form.initialState, path);

    return !isEqual(currentState, initialState);
  });

  const reset = () => {
    const initialValue = get(form.initialState, path);
    if (!initialValue) return;
    form.setState(path, initialValue);
  };

  const setValue = (update: Update<T>) => form.setState(path, update);
  const setMeta = (update: Update<FieldMetaState>) =>
    form.setFieldMeta(path, update);

  const isRequired = (variant?: NullOrOptional[]) => form.isFieldRequired(path, variant)

  return {
    value,
    setValue,
    isRequired,
    meta: getMeta,
    setMeta,
    errors,
    reset,
    wasModified,
  };
}

export type ArrayFieldState<T> = FieldContext<T[]> &
  Readonly<{
    push: (item: T) => void;
    remove: (index: number) => void;
    move: (from: number, to: number) => void;
    insert: (index: number, item: T) => void;
    replace: (index: number, item: T) => void;
    empty: () => void;
    swap: (indexA: number, indexB: number) => void;
  }>;

export function useArrayField<T>(path: string): ArrayFieldState<T> {
  const baseField = useField<T[]>(path);

  const push = (item: T) => {
    baseField.setValue((prev) => [
      ...prev,
      item,
    ]);
  };

  const remove = (index: number) => {
    baseField.setValue((prev) => {
      return prev.filter((_, i) => i !== index);
    });
  };

  const move = (from: number, to: number) => {
    baseField.setValue((prev) => {
      const newArray = [...prev];
      const [removed] = newArray.splice(from, 1);
      if (removed) {
        newArray.splice(to, 0, removed);
      }
      return newArray;
    });
  };

  const insert = (index: number, item: T) => {
    baseField.setValue((prev) => {
      const newArray = [...prev];
      newArray.splice(index, 0, item);
      return newArray;
    });
  };

  const replace = (index: number, item: T) => {
    baseField.setValue((prev) => {
      const newArray = [...prev];
      newArray[index] = item;
      return newArray;
    });
  };

  const empty = () => baseField.setValue([]);

  const swap = (
    indexA: number,
    indexB: number,
  ) => {
    baseField.setValue((prev) => {
      const newArray = [...prev];
      const temp = newArray[indexA];
      newArray[indexA] = newArray[indexB] as T;
      newArray[indexB] = temp as T;
      return newArray;
    });
  };

  return {
    ...baseField,
    push,
    remove,
    move,
    insert,
    replace,
    empty,
    swap,
  };
}
