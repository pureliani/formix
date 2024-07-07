# @gapu/formix

@gapu/formix is a powerful form management library for SolidJS. It provides a simple and flexible API for handling complex form state, validation, and submission.

### Table of contents
- [Form initialization](#form-initialization)
  - [Parameters](#parameters)
  - [Return Value:](#return-value)
  - [Example usage](#example-usage)
- [Form Component](#form-component)
  - [Usage](#usage)
  - [Parameters](#parameters-1)
  - [How it works](#how-it-works)
  - [Example](#example)
  - [Key Points](#key-points)
- [useForm Hook](#useform-hook)
  - [Purpose](#purpose)
  - [Usage](#usage-1)
  - [Return Value](#return-value-1)
  - [Example](#example-1)
  - [Key Points](#key-points-1)
- [useField Hook](#usefield-hook)
  - [Purpose](#purpose-1)
  - [Usage](#usage-2)
  - [Parameters](#parameters-2)
  - [Return Value](#return-value-2)
  - [Example](#example-2)
  - [Key Points](#key-points-2)
- [useArrayField Hook](#usearrayfield-hook)
  - [Purpose](#purpose-2)
  - [Usage](#usage-3)
  - [Parameters](#parameters-3)
  - [Return Value](#return-value-3)
  - [Example](#example-3)
  - [Key Points](#key-points-3)
  - [Advanced Usage](#advanced-usage)

## Form initialization
The `createForm` function is the entry point for creating and managing your form with the specified schema, initial state, and submission handler.  

```tsx
import { createForm } from '@gapu/formix';
import { z } from 'zod';

const formContext = createForm({
  schema: z.object({
    username: z.string().min(3),
    email: z.string().email(),
    age: z.number().min(18)
  }),
  initialState: {
    username: '',
    email: '',
    age: 18,
  },
  onSubmit: async (state) => {
    console.log('Form submitted:', state);
  },
});
```
### Parameters
`createForm` accepts an object with the following properties:

* `schema`: A Zod schema that defines the structure and validation rules for your form data.  
* `initialState`: The initial state of your form. This can be an object matching your schema, a function that returns such an object, or a function that returns a Promise resolving to such an object.  
* `onSubmit`: A function that will be called when the form is submitted successfully. It doesn't run if the form is invalid and it receives the validated form state as its argument. 
* `undoLimit` (optional, default = 500): The maximum number of undo steps to keep in history.

### Return Value:
`createForm` returns a form context object with various methods and properties for managing your form:

* `initialState`: A function that returns the initial state of the form.
* `formSchema`: A function that returns the Zod schema used for form validation.
* `isFieldRequired`: A function to check if a field is required, given its path and optional variant.
* `state`: A signal containing the current form state.
* `setState`: A function to update the form state.
* `formStatus`: A signal containing the current status of the form:
  * `initializing`: Whether the form is currently initializing.
  * `submitting`: Whether the form is currently being submitted.
  * `validating`: Whether the form is currently being validated.
  * `settingState`: Whether the form state is currently being updated.
  * `settingMeta`: Whether field metadata is currently being updated.
* `fieldStatuses`: A signal containing the status of individual fields.
  * `isSettingValue`: Whether the field's value is currently being updated asynchronously.
  * `isSettingMeta`: Whether the field's metadata is currently being updated asynchronously.
* `fieldMetas`: A signal containing metadata for all fields.
* `setFieldMetas`: A function to update metadata for all fields.
* `errors`: A signal containing any current validation errors.
* `reset`: A function to reset the form to its initial state.
* `submit`: A function to trigger form submission.
* `undo`: A function to undo the last change in the form state.
* `redo`: A function to redo the last undone change in the form state.
* `canUndo`: A function that returns whether an undo operation is possible.
* `canRedo`: A function that returns whether a redo operation is possible.
* `wasModified`: A function that returns whether the form state has been modified from its initial state.
* `setFieldMeta`: A function to update metadata for a specific field.
* `setFieldValue`: A function to update the value of a specific field.

### Example usage
```ts
const formContext = createForm({
  schema: ...,
  initialState: ...,
  onSubmit: ...,
  undoLimit: ... // (optional)
});

// Access current form state
const currentState = formContext.state();

// Update form state
await formContext.setState(newState);

// Check if form is currently submitting
const isSubmitting = formContext.formStatus().submitting;

// Get all current form errors
const formErrors = formContext.errors();

// Undo last change
if (formContext.canUndo()) {
  await formContext.undo();
}

// Check if a specific field is required
const isNameRequired = formContext.isFieldRequired('name');

// Update a specific field's value
await formContext.setFieldValue('email', 'new@example.com');
```

## Form Component
The `Form` component is a crucial part of this library. Its primary purpose is to serve as a context provider, making the form context available to all descendant components.

### Usage
```tsx
import { createForm, Form } from '@gapu/formix';

const formContext = createForm({ ... })

<Form context={formContext}>
  {/* Your form fields and components go here */}
</Form>
```

### Parameters
The `Form` component accepts two props:
* `context`: This is the form context object returned by the `createForm` function. It contains all the form state, methods, and properties needed to manage your form.
* `children`: This can be any valid JSX content. Typically, this will include your form fields, submit buttons, and any other UI elements that make up your form.

### How it works

The `Form` component uses Solid's Context API to provide the form context to all its children.
It wraps its children in a \<form\> element, which handles the submit event.
When the form is submitted, it prevents the default form submission behavior and if the form is valid, calls the submit function from the provided context.

### Example
```tsx
import { createForm, Form, useField } from '@gapu/formix';
import { z } from 'zod';

const MyForm = () => {
  const formContext = createForm({
    schema: z.object({
      name: z.string().min(2),
      email: z.string().email(),
    }),
    initialState: {
      name: '',
      email: '',
    },
    onSubmit: async (state) => {
      console.log('Form submitted:', state);
    },
  });

  return (
    <Form context={formContext}>
      <NameField />
      <EmailField />
      <button type="submit">Submit</button>
    </Form>
  );
};

const NameField = () => {
  const field = useField<string>('name');
  
  ...
};

const EmailField = () => {
  const field = useField<string>('email');

  ...
};
```
### Key Points

The `Form` component is essentially a context provider. It doesn't directly handle form state or validation itself.
All components and hooks from @gapu/formix (such as `useField`) must be used within a `Form` component to access the form context.
The `Form` component renders a regular \<form\> element and handles the onSubmit event internally.
Child components can access the form context using hooks like `useForm`, `useField` or `useArrayField`.

By using the `Form` component, you ensure that all parts of your form have access to the shared form context, allowing for seamless integration of form state, validation, and submission handling throughout your form's component tree.

## useForm Hook
The `useForm` hook provides access to the entire form context within any component that is a child of a Form component.

### Purpose
The `useForm` hook allows you to:

* Access and modify the entire form state
* Handle form-wide operations like submission, reset, and validation
* Access form-wide metadata and status information
* Perform undo and redo operations on the form state

### Usage
```tsx
import { useForm } from '@gapu/formix';

const MyFormComponent = () => {
    const form = useForm<MyFormState>();
    
    ...
};
```

### Return Value
`useForm` returns the form context object with the following properties and methods:

* `initialState`: A function that returns the initial state of the form.
* `formSchema`: A function that returns the Zod schema used for form validation.
* `isFieldRequired`: A function to check if a field is required, given its path and optional variant.
* `state`: A signal containing the current form state.
* `setState`: A function to update the form state.
* `formStatus`: A signal containing the current status of the form (initializing, submitting, validating, etc.).
* `fieldStatuses`: A signal containing the status of individual fields.
* `fieldMetas`: A signal containing metadata for all fields.
* `setFieldMetas`: A function to update metadata for all fields.
* `errors`: A signal containing any current validation errors.
* `reset`: A function to reset the form to its initial state.
* `submit`: A function to trigger form submission.
* `undo`: A function to undo the last change in the form state.
* `redo`: A function to redo the last undone change in the form state.
* `canUndo`: A function that returns whether an undo operation is possible.
* `canRedo`: A function that returns whether a redo operation is possible.
* `wasModified`: A function that returns whether the form state has been modified from its initial state.
* `setFieldMeta`: A function to update metadata for a specific field.
* `setFieldValue`: A function to update the value of a specific field.

### Example
```tsx
import { useForm } from '@gapu/formix';

const FormSummary = () => {
  const form = useForm();
  
  return (
    <div>
      <h3>Form Summary</h3>
      <p>Modified: {form.wasModified() ? 'Yes' : 'No'}</p>
      <p>Can Undo: {form.canUndo() ? 'Yes' : 'No'}</p>
      <p>Can Redo: {form.canRedo() ? 'Yes' : 'No'}</p>
      <button onClick={form.reset} disabled={!form.wasModified()}>
        Reset Form
      </button>
      <button onClick={form.undo} disabled={!form.canUndo()}>
        Undo
      </button>
      <button onClick={form.redo} disabled={!form.canRedo()}>
        Redo
      </button>
      <button onClick={form.submit}>Submit</button>
    </div>
  );
};
```

### Key Points

`useForm` must be used within a component that is a child of a `Form` component.
It provides access to the entire form context, allowing for form-wide operations and state management.
The hook is generic, allowing you to specify the type of the form state for better type safety.
It's particularly useful for creating components that need to interact with the overall form state or perform form-wide actions.

By using the `useForm` hook, you can create components that have full access to the form's state and functionality, enabling you to build complex form interactions and custom form controls.

## useField Hook
The `useField` hook provides a way to interact with individual form fields within a `Form` context.

### Purpose
The `useField` hook allows you to:  
* Access and modify the value of a specific field in your form
* Handle field-specific metadata (like touched, dirty, disabled states)
* Access field-specific validation errors
* Perform field-specific actions like resetting or checking if the field was modified

### Usage
```tsx
import { useField } from '@gapu/formix';

const MyFormField = () => {
    const field = useField<string>('fieldName');
    
    ...
};
```
### Parameters
The `useField` hook takes one parameter:

* `path`: A string representing the path to the field in your form state. For nested objects and arrays, use dot notation (e.g. 'user.name', 'contacts.1')

### Return Value
`useField` returns an object with the following properties and methods:

* `value`: A function that returns the current value of the field.
* `setValue`: A function to update the value of the field.
* `meta`: A function that returns the current metadata state of the field.
* `setMeta`: A function to update the metadata state of the field.
* `errors`: A function that returns an array of current validation errors for the field.
* `status`: A function that returns the current status of the field (isSettingValue, isSettingMeta).
* `reset`: A function to reset the field to its initial value.
* `wasModified`: A function that returns whether the field has been modified from its initial value.
* `isRequired`: A function that returns whether the field is required based on the form schema.

### Example
```tsx
import { useField } from '@gapu/formix';
import { Index } from 'solid-js';

const EmailField = () => {
  const field = useField<string>('email');
  
  return (
    <div>
      <label>Email:</label>
      <input
        value={field.value()}
        onInput={(e) => field.setValue(e.currentTarget.value)}
        onFocus={() => field.setMeta(prev => ({ ...prev, touched: true }))}
        disabled={field.meta().disabled}
      />
      <Index each={hobbies.errors()}>
        {(error) => (
          <p class="error">{error().message}</p>
        )}
      </Index>
      {field.wasModified() && <span>Field was modified</span>}
      <button onClick={() => field.reset()}>Reset</button>
    </div>
  );
};
```
### Key Points

`useField` must be used within a component that is a child of a `Form` component.
This hook provides a comprehensive API for interacting with a single form field.
It handles both the value of the field and its metadata (like disabled state).
It provides access to field-specific validation errors.
The hook is generic, allowing you to specify the type of the field value for better type safety.

By using the `useField` hook, you can create reusable, type-safe form field components that are automatically connected to your form's state and validation logic.

## useArrayField Hook

The `useArrayField` hook is designed to handle array fields in your form. It provides an extended `useField` API for manipulating array-type form fields.

### Purpose
* Access and modify an array field in your form
* Perform array-specific operations like **pushing**, **removing**, **moving**, and **swapping** items
* Handle field-specific metadata and validation errors for the entire array
* Perform field-specific actions like resetting or checking if the array was modified

### Usage
```tsx
import { useArrayField } from '@gapu/formix';

type ItemType = { ... }

const MyArrayField = () => {
    const arrayField = useArrayField<ItemType>('arrayFieldName');

    ...
};
```

### Parameters
The `useArrayField` hook takes one parameter:

* `path`: A string representing the path to the array field in your form state. For nested objects, use dot notation (e.g., 'user.hobbies').

### Return Value
`useArrayField` returns an object that includes all properties and methods from `useField`, plus these additional array-specific methods:

* `push`: A function to add an item to the end of the array.
* `remove`: A function to remove an item at a specific index.
* `move`: A function to move an item from one index to another.
* `insert`: A function to insert an item at a specific index.
* `replace`: A function to replace an item at a specific index.
* `empty`: A function to remove all items from the array.
* `swap`: A function to swap the positions of two items in the array.

### Example
```tsx
import { useArrayField } from '@gapu/formix';
import { Index } from 'solid-js';

const HobbiesField = () => {
  const hobbies = useArrayField<string>('hobbies');

  return (
    <div>
      <h3>Hobbies</h3>
      <Index each={hobbies.value()}>
        {(hobby, index) => (
          <div>
            <input
              value={hobby()}
              onInput={(e) => hobbies.replace(index, e.currentTarget.value)}
            />
            <button onClick={() => hobbies.remove(index)}>Remove</button>
          </div>
        )}
      </Index>
      <button onClick={() => hobbies.push('')}>Add Hobby</button>
      <Index each={hobbies.errors()}>
        {(error) => (
          <p class="error">{error().message}</p>
        )}
      </Index>
    </div>
  );
};
```

### Key Points

`useArrayField` must be used within a component that is a child of a `Form` component.
It provides all the functionality of `useField`, plus additional methods for array manipulation.
The hook is generic, allowing you to specify the type of the array items for better type safety.
Array operations (`push`, `remove`, `move`, etc.) automatically trigger form state updates and validation.
You can use the base field methods (`setValue`, `setMeta`, etc.) to manipulate the entire array at once.

### Advanced Usage
`useArrayField` allows for complex array manipulations:
```ts
const hobbies = useArrayField<string>('hobbies');

// Move the first hobby to the end
hobbies.move(0, hobbies.value().length - 1);
// Swap the first two hobbies
hobbies.swap(0, 1);
// Insert a new hobby at the beginning
hobbies.insert(0, 'New Hobby');
// Replace all hobbies
hobbies.setValue(['Hobby1', 'Hobby2', 'Hobby3']);
```

By using the `useArrayField` hook, you can easily create dynamic form sections that allow users to add, remove, and reorder items in an efficient manner.
