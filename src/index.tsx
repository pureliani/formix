import { z } from "zod"
import { createContext, createSignal, useContext, type JSXElement } from "solid-js"

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

export type Update<T> = T | ((prev: T) => T) | ((prev: T) => Promise<T>) 

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

export const defaultFieldMetaState: FieldMetaState = {
  dirty: false,
  errors: [],
  loading: false,
  touched: false,
  disabled: false,
  readOnly: false,
  validating: false
}

export type FieldState<T> = FieldMetaState & { value: T }

export type FormState<State = any> = {
  state: () => State
  setState: (update: Update<State>) => void
  meta: () => Record<string, FieldMetaState>
  setMeta: (update: Update<Record<string, FieldMetaState>>) => void
  loading: () => boolean
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
  const [meta, setMeta] = createSignal<Record<string, FieldMetaState>>({})
  const [initializing, setInitializing] = createSignal(false)
  const [submitting, setSubmitting] = createSignal(false)
  const [validating, setValidating] = createSignal(false)

  const setState = async (update: Update<State>) => {
    const currentState = state()

    if(update instanceof Function) {
      if(!currentState) {
        throw new Error("@gapu/formix: Cannot call 'setState' with an update callback if the state is not initialized yet")
      }
      const _state = update(currentState)
      if(_state instanceof Promise) {
        setInitializing(true)
        _state.then((result) => {
          setInternalState(result)
        }).finally(() => {
          setInitializing(false)
        })
      } else {
        setInternalState(_state)
      }
    } else {
      setInternalState(update)
    }
  }

  if(props.initialState instanceof Function) {
    const _state = props.initialState()
    if(_state instanceof Promise) {
      setInitializing(true)
      _state.then((result) => {
        setInternalState(result)
      }).finally(() => {
        setInitializing(false)
      })
    } else {
      setInternalState(_state)
    }
  } else {
    setInternalState(props.initialState)
  }

  return (
    <context.Provider value={{
      state,
      setState,
      meta,
      setMeta,
      loading: initializing,
      submitting,
      validating
    }}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const validationResult = await props.schema.safeParseAsync(state())
        if(validationResult.success) {
          setSubmitting(true)
        }
      }}>
        {props.children}
      </form>
    </context.Provider>
  )
}


export const useField = <T,>(path: string): (() => FieldState<T>)  => {
  const f = useForm()

  const getPathMeta = (path: string) => {
    const value = f.meta()[path] 
    if(!value) {

      f.setMeta((prev) => ({
        ...prev,
        [path]: defaultFieldMetaState
      }))

      return defaultFieldMetaState
    } 
    
    return value
  } 

  return () => ({
      value: get(f.state(), path),
      ...getPathMeta(path)
  })
}

export const useForm = <T = any,>(): FormState<T> => {
  const c = useContext(context)
  if(!c) {
    throw new Error("@gapu/formix: useForm/useField should be used under the 'Form' provider")
  }
  return c
}
