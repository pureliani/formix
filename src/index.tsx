import type { z } from "zod";

import {
  createContext,
  createMemo,
  createSignal,
  useContext,
  type JSXElement,
} from "solid-js";

import {
  createUndoRedoManager,
  formatZodIssues,
  get,
  getInitialValue,
  getUpdatedValue,
  isEqual,
  isFieldRequired as _isFieldRequired,
  set,
  type NullOrOptional,
} from "./helpers";
import { For } from "solid-js/web";

export type { NullOrOptional }
export type Update<T, R = T> = R | ((prev: T) => R) | ((prev: T) => Promise<R>);
export type SyncUpdate<T, R = T> = R | ((prev: T) => R);
export type Initializer<T> = T | (() => T) | (() => Promise<T>);

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
  setValue: (update: Update<T>) => Promise<void>;
  meta: () => FieldMetaState;
  setMeta: (update: Update<FieldMetaState>) => Promise<void>;
  isRequired: (variant?: NullOrOptional[]) => boolean,
  errors: () => FormixError[];
  status: () => FieldStatus;
  reset: () => Promise<void>;
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
  initialState: () => Readonly<State | null>;
  state: () => Readonly<State | null>;
  setState: (update: Update<State, State>) => Promise<void>;
  fieldMetas: () => Readonly<Record<string, FieldMetaState>>;
  isFieldRequired: (path: string, variant?: NullOrOptional[]) => boolean
  formSchema: () => z.ZodTypeAny
  setFieldMetas: (update: Update<Record<string, FieldMetaState>>) => Promise<void>;
  setFieldMeta: (path: string, update: Update<FieldMetaState>) => Promise<void>;
  setFieldValue: <FV>(path: string, update: Update<FV>) => Promise<void>;
  errors: () => Readonly<FormixError[]>;
  reset: () => Promise<void>;
  submit: () => Promise<void>;
  formStatus: () => Readonly<FormStatus>;
  fieldStatuses: () => Readonly<Record<string, FieldStatus>>;
  undo: (steps?: number) => Promise<void>;
  redo: (steps?: number) => Promise<void>;
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
  initialState: Initializer<State>;
  onSubmit: (state: State) => void | Promise<void>;
  undoLimit?: number;
};

export function createForm<
  Schema extends z.ZodTypeAny,
  State extends z.infer<Schema>,
>(props: CreateFormProps<Schema, State>): FormContextProps<State> {
  const [state, setStateInternal] = createSignal<State | null>(null);
  const [fieldMetas, setFieldMetasInternal] = createSignal<
    Record<string, FieldMetaState>
  >({});
  const [undoRedoManager, setUndoRedoManager] = createSignal<
    ReturnType<typeof createUndoRedoManager<State>> | undefined
  >(undefined);
  const [errors, setErrors] = createSignal<FormixError[]>([]);

  const [formStatus, setFormStatus] = createSignal<FormStatus>({
    initializing: false,
    submitting: false,
    validating: false,
    settingState: false,
    settingMeta: false,
  });

  const [fieldStatuses, setFieldStatuses] = createSignal<
    Record<string, FieldStatus>
  >({});

  const revalidate = async () => {
    await initPromise;
    setFormStatus((prev) => ({ ...prev, validating: true }));
    const validationResult = await props.schema.safeParseAsync(state());
    setFormStatus((prev) => ({ ...prev, validating: false }));
    return validationResult;
  };

  let initialState: State | null = null;
  const initializeState = async () => {
    setFormStatus((prev) => ({ ...prev, initializing: true }));
    try {
      const result = await getInitialValue(props.initialState);
      initialState = result;
      setStateInternal(result);
      setUndoRedoManager(createUndoRedoManager<State>(result, props.undoLimit));

      setFormStatus((prev) => ({ ...prev, validating: true }));
      const validationResult = await props.schema.safeParseAsync(state());
      setFormStatus((prev) => ({ ...prev, validating: false }));
      if (!validationResult.success) {
        setErrors(formatZodIssues(validationResult.error.issues));
      } else {
        setErrors([]);
      }
    } finally {
      setFormStatus((prev) => ({ ...prev, initializing: false }));
    }
  };
  const initPromise = initializeState();

  let setStateCalledByUndoRedoFn = false;
  const setState = async (update: Update<State, State>) => {
    try {
      await initPromise;
      setFormStatus((prev) => ({ ...prev, isSettingState: true }));
      const next = await getUpdatedValue(state() as State, update);
      setStateInternal(next);
      if (!setStateCalledByUndoRedoFn) {
        undoRedoManager()?.setState(next);
      }

      const validationResult = await revalidate();
      if (!validationResult.success) {
        setErrors(formatZodIssues(validationResult.error.issues));
      } else {
        setErrors([]);
      }
    } finally {
      setFormStatus((prev) => ({ ...prev, isSettingState: false }));
    }
  };

  const setFieldMetas = async (
    update: Update<Record<string, FieldMetaState>>,
  ) => {
    try {
      setFormStatus((prev) => ({ ...prev, isSettingMeta: true }));
      const next = await getUpdatedValue(fieldMetas(), update);
      setFieldMetasInternal(next);
    } finally {
      setFormStatus((prev) => ({ ...prev, isSettingMeta: false }));
    }
  };

  const _initialState = () => initialState;

  const submit = async () => {
    const validationResult = await revalidate();
    if (!validationResult.success) return;

    try {
      setFormStatus((prev) => ({ ...prev, submitting: true }));
      await props.onSubmit(validationResult.data);
    } finally {
      setFormStatus((prev) => ({ ...prev, submitting: false }));
    }
  };

  const undo = async (steps = 1) => {
    const manager = undoRedoManager();
    if (manager) {
      const previousState = manager.undo(steps);
      try {
        setStateCalledByUndoRedoFn = true;
        await setState(previousState);
      } finally {
        setStateCalledByUndoRedoFn = false;
      }
    }
  };

  const redo = async (steps = 1) => {
    const manager = undoRedoManager();
    if (manager) {
      const nextState = manager.redo(steps);
      try {
        setStateCalledByUndoRedoFn = true;
        await setState(nextState);
      } finally {
        setStateCalledByUndoRedoFn = false;
      }
    }
  };

  const canUndo = (steps = 1) => undoRedoManager()?.canUndo(steps) ?? false;
  const canRedo = (steps = 1) => undoRedoManager()?.canRedo(steps) ?? false;

  const reset = async () => {
    const initialState = await getInitialValue(props.initialState);
    await setState(initialState);
  };

  const wasModified = () => !isEqual(state(), initialState);

  const _setFieldStatus = (
    path: string,
    key: keyof FieldStatus,
    value: boolean,
  ) => {
    setFieldStatuses((prev) => ({
      ...prev,
      [path]: {
        ...(prev[path] ?? {
          isSettingMeta: false,
          isSettingValue: false,
        }),
        [key]: value,
      },
    }));
  };

  const setFieldValue = async <F,>(path: string, update: Update<F>) => {
    try {
      await initPromise;
      _setFieldStatus(path, "isSettingValue", true);
      await setState(async (currentState) => {
        const updatedValue = await getUpdatedValue(
          get(currentState, path),
          update,
        );
        const nextState = set(currentState, path, updatedValue);
        return nextState;
      });
    } finally {
      _setFieldStatus(path, "isSettingValue", false);
    }
  };

  const setFieldMeta = async (path: string, update: Update<FieldMetaState>) => {
    try {
      _setFieldStatus(path, "isSettingMeta", true);
      const currentMeta = fieldMetas()[path] ?? defaultFieldMetaState;
      const next = await getUpdatedValue(currentMeta, update);
      setFieldMetas((prev) => ({
        ...prev,
        [path]: next,
      }));
    } finally {
      _setFieldStatus(path, "isSettingMeta", false);
    }
  };

  const formSchema = () => props.schema

  const isFieldRequired = (path: string, variant?: NullOrOptional[]) => {
    return _isFieldRequired(formSchema(), path, variant)
  }

  return {
    initialState: _initialState,
    formSchema,
    isFieldRequired,
    setFieldMeta,
    setFieldValue,
    state,
    setState,
    formStatus,
    fieldStatuses,
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

  const getStatus = createMemo(
    () =>
      form.fieldStatuses()[path] ?? {
        isSettingMeta: false,
        isSettingValue: false,
      },
  );

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
    const initialState = get(form.initialState(), path);

    return !isEqual(currentState, initialState);
  });

  const reset = async () => {
    const initialValue = get(form.initialState(), path);
    if (!initialValue) return;
    await form.setFieldValue(path, initialValue);
  };

  const setValue = (update: Update<T>) => form.setFieldValue(path, update);
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
    status: getStatus,
    reset,
    wasModified,
  };
}

export type ArrayFieldState<T> = FieldContext<T[]> &
  Readonly<{
    push: (item: Initializer<T>) => Promise<void>;
    remove: (index: Initializer<number>) => Promise<void>;
    move: (from: Initializer<number>, to: Initializer<number>) => Promise<void>;
    insert: (index: Initializer<number>, item: Initializer<T>) => Promise<void>;
    replace: (
      index: Initializer<number>,
      item: Initializer<T>,
    ) => Promise<void>;
    empty: () => Promise<void>;
    swap: (
      indexA: Initializer<number>,
      indexB: Initializer<number>,
    ) => Promise<void>;
  }>;

export function useArrayField<T>(path: string): ArrayFieldState<T> {
  const baseField = useField<T[]>(path);

  const push = async (item: Initializer<T>) => {
    await baseField.setValue(async (prev) => [
      ...prev,
      await getInitialValue(item),
    ]);
  };

  const remove = async (index: Initializer<number>) => {
    await baseField.setValue(async (prev) => {
      const _index = await getInitialValue(index);
      return prev.filter((_, i) => i !== _index);
    });
  };

  const move = async (from: Initializer<number>, to: Initializer<number>) => {
    await baseField.setValue(async (prev) => {
      const [_from, _to] = await Promise.all([
        getInitialValue(from),
        getInitialValue(to),
      ] as const);

      const newArray = [...prev];
      const [removed] = newArray.splice(_from, 1);
      if (removed) {
        newArray.splice(_to, 0, removed);
      }
      return newArray;
    });
  };

  const insert = async (index: Initializer<number>, item: Initializer<T>) => {
    await baseField.setValue(async (prev) => {
      const [_index, _item] = await Promise.all([
        getInitialValue(index),
        getInitialValue(item),
      ] as const);

      const newArray = [...prev];
      newArray.splice(_index, 0, _item);
      return newArray;
    });
  };

  const replace = async (index: Initializer<number>, item: Initializer<T>) => {
    await baseField.setValue(async (prev) => {
      const [_index, _item] = await Promise.all([
        getInitialValue(index),
        getInitialValue(item),
      ] as const);

      const newArray = [...prev];
      newArray[_index] = _item;
      return newArray;
    });
  };

  const empty = async () => {
    await baseField.setValue([]);
  };

  const swap = async (
    indexA: Initializer<number>,
    indexB: Initializer<number>,
  ) => {
    await baseField.setValue(async (prev) => {
      const [_indexA, _indexB] = await Promise.all([
        getInitialValue(indexA),
        getInitialValue(indexB),
      ] as const);

      const newArray = [...prev];
      const temp = newArray[_indexA];
      newArray[_indexA] = newArray[_indexB] as T;
      newArray[_indexB] = temp as T;
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
