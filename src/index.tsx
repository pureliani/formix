import { z } from "zod"
import { createContext, createSignal, useContext, type JSXElement } from "solid-js"

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

function createUndoRedoManager<T>(initialState: T, maxHistorySize: number = 350) {
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

function get<T = any>(obj: any, path: string): T {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (Array.isArray(result) && /^\d+$/.test(key)) {
      result = result[parseInt(key, 10)];
    } else {
      result = result[key];
    }
  }

  return result;
}

function set(obj: any, path: string, value: any): any {
  if (path === '') {
    return obj;
  }

  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((acc, key) => acc[key], obj);
  target[lastKey] = value;
  return obj;
}

export type Update<T, R = T> = R | ((prev: T) => R) | ((prev: T) => Promise<R>)
export type SyncUpdate<T, R = T> = R | ((prev: T) => R)
export type Initializer<T> = T | (() => T) | (() => Promise<T>) 

export async function getUpdatedValue <T, R>(prev: T, update: Update<T, R>): Promise<R> {
  if (update instanceof Function) {
    const result = update(prev);
    return result instanceof Promise ? await result : result;
  }
  return update;
}

export async function getInitialValue <T>(init: Initializer<T>): Promise<T> {
  if (init instanceof Function) {
    const result = init();
    return result instanceof Promise ? await result : result;
  }
  return init;
}

export type FieldMetaState = Readonly<{
  touched: boolean
  dirty: boolean
  loading: boolean
  disabled: boolean
  readOnly: boolean
}>

export type FieldStatus = Readonly<{
  isSettingValue: boolean;
  isSettingMeta: boolean;
}>

export type FieldState<T> = Readonly<{ 
  value: T,
  setValue: (update: Update<T>) => Promise<void>,
  meta: FieldMetaState
  setMeta: (update: Update<FieldMetaState>) => Promise<void>,
  errors: string[]
  status: FieldStatus
  reset: () => Promise<void>
  wasModified: () => boolean
}>

export type FormErrors = Readonly<{
  fieldErrors: Readonly<{
    [x: string]: string[] | undefined;
    [x: number]: string[] | undefined;
    [x: symbol]: string[] | undefined;
  }>
  formErrors: string[]
}>

export type FormStatus = Readonly<{
  initializing: boolean;
  submitting: boolean;
  validating: boolean;
  settingState: boolean;
  settingMeta: boolean;
}>

export type FormContext<State = any> = Readonly<{
  initialState: () => Readonly<State | null>
  state: () => Readonly<State | null>
  setState: (update: Update<State>) => Promise<void>
  fieldMetas: () => Readonly<Record<string, FieldMetaState>>
  setFieldMetas: (update: Update<Record<string, FieldMetaState>>) => Promise<void>
  errors: () => Readonly<FormErrors>
  reset: () => Promise<void>
  submit: () => Promise<void>
  formStatus: () => Readonly<FormStatus>
  fieldStatuses: () => Readonly<Record<string, FieldStatus>>
  undo: (steps?: number) => Promise<void>
  redo: (steps?: number) => Promise<void>
  canUndo: (steps?: number) => boolean
  canRedo: (steps?: number) => boolean
  wasModified: () => boolean
}>

type FieldStatusesContext = Readonly<{
  fieldStatuses: () => Record<string, FieldStatus>
  setFieldStatuses: (update: Update<Record<string, FieldStatus>>) => void
}>

const formContext = createContext<FormContext>()
const fieldStatusesContext = createContext<FieldStatusesContext>(undefined)

export type FormProps<
  Schema extends z.ZodTypeAny, 
  State extends z.infer<Schema>
> = {
  schema: Schema
  initialState: Initializer<State> 
  onSubmit: <T>(state: State) => T | Promise<T>,
  children: JSXElement
}

export function Form<
  Schema extends z.ZodTypeAny,
  State extends z.infer<Schema>
>(props: FormProps<Schema, State>) {
  const [state, setStateInternal] = createSignal<State | null>(null)
  const [fieldMetas, setFieldMetasInternal] = createSignal<Record<string, FieldMetaState>>({})
  const [undoRedoManager, setUndoRedoManager] = createSignal<ReturnType<typeof createUndoRedoManager<State>> | undefined>(undefined)

  const [errors, setErrors] = createSignal<FormErrors>({
    fieldErrors: {},
    formErrors: []
  })

  const [formStatus, setFormStatus] = createSignal<FormStatus>({
    initializing: false,
    submitting: false,
    validating: false,
    settingState: false,
    settingMeta: false,
  });

  const [fieldStatuses, setFieldStatuses] = createSignal<Record<string, FieldStatus>>({});

  const revalidate = async () => {
    setFormStatus(prev => ({ ...prev, validating: true }))
    const validationResult = await props.schema.safeParseAsync(state())
    setFormStatus(prev => ({ ...prev, validating: false }))
    return validationResult
  }

  let initialState: State | null = null
  const initializeState = async () => {
    setFormStatus(prev => ({ ...prev, initializing: true }))
    try {
      const result = await getInitialValue(props.initialState)
      initialState = result
      setStateInternal(result)
      setUndoRedoManager(createUndoRedoManager<State>(result))

      const validationResult = await revalidate()
      if(!validationResult.success) {
        setErrors(validationResult.error.flatten())
      }
    } finally {
      setFormStatus(prev => ({ ...prev, initializing: false }))
    }
  }
  initializeState()

  const setState = async (update: Update<State | null, State>) => {
    try {
      setFormStatus(prev => ({ ...prev, isSettingState: true }))
      const next = await getUpdatedValue(state(), update);
      setStateInternal(next)
      undoRedoManager()?.setState(next);

      const validationResult = await revalidate()
      if(!validationResult.success) {
        setErrors(validationResult.error.flatten())
      }
    } finally {
      setFormStatus(prev => ({ ...prev, isSettingState: false }))
    }
  }

  const setFieldMetas = async (update: Update<Record<string, FieldMetaState>>) => {
    try {
      setFormStatus(prev => ({ ...prev, isSettingMeta: true }))
      const next = await getUpdatedValue(fieldMetas(), update)
      setFieldMetasInternal(next)
    } finally {
      setFormStatus(prev => ({ ...prev, isSettingMeta: false }))
    }
  }


  const _initialState = () => initialState

  const submit = async () => {
    const validationResult = await revalidate()
    if(!validationResult.success) return

    try {
      setFormStatus(prev => ({ ...prev, submitting: true }))
      await props.onSubmit(validationResult.data)
    } finally {
      setFormStatus(prev => ({ ...prev, submitting: false }))
    }
  }

  const undo = async (steps: number = 1) => {
    const manager = undoRedoManager()
    if (manager) {
      const previousState = manager.undo(steps);
      await setState(previousState);
    }
  }

  const redo = async (steps: number = 1) => {
    const manager = undoRedoManager()
    if (manager) {
      const nextState = manager.redo(steps);
      await setState(nextState);
    }
  }

  const canUndo = (steps: number = 1) => undoRedoManager()?.canUndo(steps) ?? false;
  const canRedo = (steps: number = 1) => undoRedoManager()?.canRedo(steps) ?? false;

  const reset = async () => {
    const initialState = await getInitialValue(props.initialState)
    await setState(initialState);
  }

  const wasModified = () => {
    const currentState = state();
    return currentState !== null && !isEqual(currentState, initialState);
  };

  return (
    <formContext.Provider value={{
      initialState: _initialState,
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
      wasModified
    }}>
      <fieldStatusesContext.Provider value={{
        fieldStatuses,
        setFieldStatuses
      }}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          await submit();
        }}>
          {props.children}
        </form>
      </fieldStatusesContext.Provider>
    </formContext.Provider>
  )
}


export function useField<T>(path: string): (() => FieldState<T>) {
  const form = useForm()
  const statuses = useContext(fieldStatusesContext)!

  const getStatus = () => statuses.fieldStatuses()[path] ?? {
    isSettingMeta: false,
    isSettingValue: false
  }

  const getMeta = () =>  form.fieldMetas()[path] ?? {
    dirty: false,
    disabled: false,
    loading: false,
    readOnly: false,
    touched: false
  }

  const wasModified = () => {
    const currentState = get(form.state(), path);
    const initialState = get(form.initialState(), path);
    return currentState !== null && !isEqual(currentState, initialState);
  };

  const setStatus = (key: keyof FieldStatus, value: boolean) => {
    statuses.setFieldStatuses((prev) => ({
      ...prev,
      [path]: {
        ...prev[path] ?? {
          isSettingMeta: false, 
          isSettingValue: false,
        },
        [key]: value
      }
    }))
  }

  const setValue = async (update: Update<T>) => {
    try {
      setStatus("isSettingValue", true)
      const next = await getUpdatedValue(get(form.state(), path), update)
      const state = form.state()
      const nextState = set(state, path, next)
      form.setState(nextState)
    } finally {
      setStatus("isSettingValue", false)
    }
  }

  const setMeta = async (update: Update<FieldMetaState>) => {
    try {
      setStatus("isSettingMeta", true)
      const next = await getUpdatedValue(getMeta(), update)
      form.setFieldMetas(prev => ({
        ...prev,
        [path]: next
      }))
    } catch {
      setStatus("isSettingMeta", false)
    }
  }

  const reset = () => setValue(get(form.initialState(), path))

  return () => ({
      value: get(form.state(), path),
      setValue,
      meta: getMeta(),
      setMeta,
      errors: form.errors().fieldErrors[path] ?? [],
      status: getStatus(),
      reset,
      wasModified
  })
}

export type ArrayFieldState<T> = FieldState<T[]> & Readonly<{
 push: (item: Initializer<T>) => Promise<void>,
 remove: (index: Initializer<number>) => Promise<void>,
 move: (from: Initializer<number>, to: Initializer<number>) => Promise<void>,
 insert: (index: Initializer<number>, item: Initializer<T>) => Promise<void>,
 replace: (index: Initializer<number>, item: Initializer<T>) => Promise<void>,
 clear: () => Promise<void>,
 swap: (indexA: Initializer<number>, indexB: Initializer<number>) => Promise<void>
}>

export function useArrayField<T>(path: string): (() => ArrayFieldState<T>) {
  const field = useField<T[]>(path);

  return () => {
    const baseField = field();

    const push = async (item: Initializer<T>) => {
      await baseField.setValue(async prev => [
        ...prev, 
        await getInitialValue(item)
      ]);
    };

    const remove = async (index: Initializer<number>) => {
      await baseField.setValue(async prev => {
        const _index = await getInitialValue(index)
        return prev.filter((_, i) => i !== _index)
      });
    };

    const move = async (from: Initializer<number>, to: Initializer<number>) => {
      await baseField.setValue(async prev => {
        const [_from, _to] = await Promise.all([
          getInitialValue(from), 
          getInitialValue(to)
        ] as const)
        
        const newArray = [...prev];
        const [removed] = newArray.splice(_from, 1);
        newArray.splice(_to, 0, removed!);
        return newArray;
      });
    };

    const insert = async (index: Initializer<number>, item: Initializer<T>) => {
      await baseField.setValue(async prev => {
        const [_index, _item] = await Promise.all([
          getInitialValue(index), 
          getInitialValue(item)
        ] as const)

        const newArray = [...prev];
        newArray.splice(_index, 0, _item);
        return newArray;
      });
    };

    const replace = async (index: Initializer<number>, item: Initializer<T>) => {
      await baseField.setValue(async prev => {
        const [_index, _item] = await Promise.all([
          getInitialValue(index), 
          getInitialValue(item)
        ] as const)
        
        const newArray = [...prev];
        newArray[_index] = _item;
        return newArray;
      });
    };

    const clear = async () => {
      await baseField.setValue([]);
    };

    const swap = async (indexA: Initializer<number>, indexB: Initializer<number>) => {
      await baseField.setValue(async prev => {
        const [_indexA, _indexB] = await Promise.all([
          getInitialValue(indexA), 
          getInitialValue(indexB)
        ] as const)

        const newArray = [...prev];
        const temp = newArray[_indexA]!;
        newArray[_indexA] = newArray[_indexB]!;
        newArray[_indexB] = temp;
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
      clear,
      swap
    };
  };
};

export function useForm<T = any,>(): FormContext<T> {
  const c = useContext(formContext)
  if(!c) {
    throw new Error("@gapu/formix: useForm/useField should be used under the 'Form' provider")
  }
  return c
}
