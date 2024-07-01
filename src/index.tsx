import { z } from "zod"
import { createContext, createSignal, useContext, type JSXElement } from "solid-js"

  // TODO: add error handling
  // TODO: add asynchronous loading states for field setValue and field  setMeta

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

export type Update<T> = T | ((prev: T) => T) | ((prev: T) => Promise<T>)

export const getUpdatedValue = async <T,>(prev: T, update: Update<T>): Promise<T> => {
  if (update instanceof Function) {
    const result = update(prev);
    return result instanceof Promise ? await result : result;
  }
  return update;
}

export type Initializer<T> = T | (() => T) | (() => Promise<T>) 

export type FieldMetaState = {
  errors: string[]
  touched: boolean
  dirty: boolean
  loading: boolean
  validating: boolean
  disabled: boolean
  readOnly: boolean
}

export type FieldUpdatingState = {
  isSettingMeta: boolean 
  isSettingValue: boolean
}

export const defaultFieldMetaState: FieldMetaState = {
  dirty: false,
  errors: [],
  loading: false,
  touched: false,
  disabled: false,
  readOnly: false,
  validating: false
}

export type FieldState<T> = { 
  value: T,
  setValue: (update: Update<T>) => Promise<void>,
  isSettingValue: () => boolean
  meta: FieldMetaState
  setMeta: (update: Update<FieldMetaState>) => Promise<void>,
  isSettingMeta: () => boolean
}

export type Errors = {
  fieldErrors: {
    [x: string]: string[] | undefined;
    [x: number]: string[] | undefined;
    [x: symbol]: string[] | undefined;
  }

  formErrors: string[]
}

export type FormState<State = any> = {
  state: () => State
  setState: (update: Update<State>) => Promise<void>
  isSettingState: () => boolean
  meta: () => Record<string, FieldMetaState>
  setMeta: (update: Update<Record<string, FieldMetaState>>) => Promise<void>
  isSettingMeta: () => boolean
  errors: () => Errors,
  setErrors: (update: Update<Errors>) => void,
  reset: () => void
  initializing: () => boolean
  submitting: () => boolean
  validating: () => boolean
}

const context = createContext<FormState>()

export type FormProps<
  Schema extends z.ZodTypeAny, 
  State extends z.infer<Schema>
> = {
  schema: Schema
  initialState: Initializer<State> 
  onSubmit: (state: State) => void | Promise<void>,
  children: JSXElement
}

export const Form = <
  Schema extends z.ZodTypeAny,
  State extends z.infer<Schema>
>(props: FormProps<Schema, State>) => {
  const [state, setInternalState] = createSignal<State | undefined>(undefined)
  const [meta, setInternalMeta] = createSignal<Record<string, FieldMetaState>>({})
  const [fieldUpdatingStates, setFieldUpdatingState] = createSignal<Record<string, FieldUpdatingState>>({})
  const [initializing, setInitializing] = createSignal(false)
  const [submitting, setSubmitting] = createSignal(false)
  const [validating, setValidating] = createSignal(false)
  const [isSettingState, setIsSettingState] = createSignal(false)
  const [isSettingMeta, setIsSettingMeta] = createSignal(false)
  const [errors, setErrors] = createSignal<Errors>({
    fieldErrors: {},
    formErrors: []
  })

  let initialState: State
  if (props.initialState instanceof Function) {
    const result = props.initialState();
    if(result instanceof Promise) {
      setInitializing(true)
      result
        .then((response) => { 
          initialState = response
          setInternalState(response) 
        })
        .finally(() => { setInitializing(false) })
    } else {
      initialState = result
      setInternalState(result)
    }
  } else {
    initialState = props.initialState
    setInternalState(props.initialState)
  }

  const setState = async (update: Update<State>) => {
    const currentState = state();
    if (currentState === undefined && update instanceof Function) {
      throw new Error("@gapu/formix: Cannot call 'setState' with an update callback if the state is not initialized yet");
    }
    try {
      setIsSettingState(true)
      const next = await getUpdatedValue(currentState as State, update);
      setInternalState(next)

      setValidating(true)
      const validationResult = await props.schema.safeParseAsync(state())
      setValidating(false)

      if(!validationResult.success) {
        const errors = validationResult.error.flatten()
        
      }
    } finally {
      setIsSettingState(false)
    }
  }

  const setMeta = async (update: Update<Record<string, FieldMetaState>>) => {
    try {
      setIsSettingMeta(true)
      const next = await getUpdatedValue(meta(), update)
      setInternalMeta(next)
    } finally {
      setIsSettingMeta(false)
    }
  }

  const reset = () => setState(initialState)


  return (
    <context.Provider value={{
      state,
      setState,
      isSettingState,
      meta,
      setMeta,
      isSettingMeta,
      errors,
      setErrors,
      initializing,
      submitting,
      validating,
      reset
    }}>
      <form onSubmit={async (e) => {
        e.preventDefault();

        setValidating(true)
        const validationResult = await props.schema.safeParseAsync(state())
        setValidating(false)

        if(!validationResult.success) return
        try {
          setSubmitting(true)
          await props.onSubmit(validationResult.data)
        } finally {
          setSubmitting(false)
        }
      }}>
        {props.children}
      </form>
    </context.Provider>
  )
}


export const useField = <T,>(path: string): (() => FieldState<T>)  => {
  const f = useForm()

  const getMeta = () => {
    const meta = f.meta()[path] 
    if(!meta) {
      f.setMeta((prev) => ({
        ...prev,
        [path]: defaultFieldMetaState
      }))
      return defaultFieldMetaState
    } 
    return meta
  } 

  const setValue = async (update: Update<T>) => {
    const next = await getUpdatedValue(get(f.state(), path), update)
    const state = f.state()
    const nextState = set(state, path, next)
    f.setState(nextState)
  }

  const setMeta = async (update: Update<FieldMetaState>) => {
    const next = await getUpdatedValue(getMeta(), update)
    f.setMeta(prev => ({
      ...prev,
      [path]: next
    }))
  }

  return () => ({
      value: get(f.state(), path),
      setValue,
      meta: getMeta(),
      setMeta
  })
}

export const useForm = <T = any,>(): FormState<T> => {
  const c = useContext(context)
  if(!c) {
    throw new Error("@gapu/formix: useForm/useField should be used under the 'Form' provider")
  }
  return c
}
