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
  initialState: () => Readonly<State>;
  state: () => Readonly<State>;
  setState: (update: Update<State>) => void;
  fieldMetas: () => Readonly<Record<string, FieldMetaState>>;
  isFieldRequired: (path: string, variant?: NullOrOptional[]) => boolean
  formSchema: z.ZodTypeAny
  setFieldMetas: (update: Update<Record<string, FieldMetaState>>) => void;
  setFieldMeta: (path: string, update: Update<FieldMetaState>) => void;
  setFieldValue: <FV>(path: string, update: Update<FV>) => void;
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
  pushToUndoHistoryDebounce?: number
};

export function createForm<
  Schema extends z.ZodTypeAny,
  State extends z.infer<Schema>,
>(props: CreateFormProps<Schema, State>): FormContextProps<State> {
  const [state, setStateInternal] = createSignal(props.initialState);
  const [fieldMetas, setFieldMetas] = createSignal<
    Record<string, FieldMetaState>
  >({});
  const undoRedoManager = createUndoRedoManager<State>(props.initialState, props.undoLimit, props.pushToUndoHistoryDebounce)
  const [isValidating, setIsValidating] = createSignal(false)
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [errors, setErrors] = createSignal<FormixError[]>([]);

  const revalidate = async () => {
    setIsValidating(true)
    const validationResult = await props.schema.safeParseAsync(state());
    setIsValidating(false)
    return validationResult;
  };

  revalidate().then((r) => {
    if (!r.success) {
      setErrors(formatZodIssues(r.error.issues));
    } else {
      setErrors([])
    }
  })

  let setStateCalledByUndoRedoFn = false;
  const setState = (update: Update<State>) => {
    const next = getUpdatedValue(state(), update);
    setStateInternal(next);
    if (!setStateCalledByUndoRedoFn) {
      undoRedoManager.setState(next);
    }

    revalidate().then((r) => {
      if (!r.success) {
        setErrors(formatZodIssues(r.error.issues));
      } else {
        setErrors([])
      }
    })
  };

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

  const undo = (steps = 1) => {
    setStateCalledByUndoRedoFn = true;
    undoRedoManager.undo(steps);
    setState(undoRedoManager.getState());
    setStateCalledByUndoRedoFn = false;
  };

  const redo = (steps = 1) => {
    setStateCalledByUndoRedoFn = true;
    undoRedoManager.redo(steps);
    setState(undoRedoManager.getState());
    setStateCalledByUndoRedoFn = false;
  };

  const reset = () => setState(props.initialState);

  const wasModified = () => !isEqual(state(), props.initialState);

  const setFieldValue = <F,>(path: string, update: Update<F>) => {
    setState((currentState) => {
      const updatedValue = getUpdatedValue(
        get(currentState, path),
        update,
      );
      const nextState = set(currentState, path, updatedValue);
      return nextState;
    });
  };

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

  const initialState = () => props.initialState

  return {
    initialState,
    formSchema: props.schema,
    isFieldRequired,
    setFieldMeta,
    setFieldValue,
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
    canUndo: undoRedoManager.canUndo,
    canRedo: undoRedoManager.canRedo,
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
    const initialState = get(form.initialState(), path);

    return !isEqual(currentState, initialState);
  });

  const reset = () => {
    const initialValue = get(form.initialState(), path);
    if (!initialValue) return;
    form.setFieldValue(path, initialValue);
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
