import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import { createForm, Form, defaultFieldMetaState, type FormixError } from '.';
import { z } from 'zod';

describe('createForm', () => {
  const schema = z.object({
    name: z.string().min(3),
    age: z.number().min(18),
  });

  type FormState = z.infer<typeof schema>;

  const initialState: FormState = {
    name: '',
    age: 0,
  };

  let onSubmit = vi.fn();

  let form: ReturnType<typeof createForm<typeof schema, FormState>>;

  beforeEach(() => {
    onSubmit = vi.fn()
    form = createForm({
      schema,
      initialState,
      onSubmit,
    });
  });

  it('should initialize with the correct initial state', () => {
    expect(form.state()).toEqual(initialState);
  });

  it('should update state correctly', async () => {
    await form.setState({ name: 'John', age: 25 });
    expect(form.state()).toEqual({ name: 'John', age: 25 });
  });

  it('should validate the form state', async () => {
    await form.setState({ name: 'Jo', age: 17 });
    expect(form.errors()).toEqual([
      {
        path: "name",
        message: "String must contain at least 3 character(s)",
      },
      {
        path: "age",
        message: "Number must be greater than or equal to 18",
      }
    ] satisfies FormixError[]);
  });

  it('should call onSubmit when form is valid', async () => {
    await form.setState({ name: 'John', age: 25 });
    await form.submit();
    expect(onSubmit).toHaveBeenCalledWith({ name: 'John', age: 25 });
  });

  it('should not call onSubmit when form is invalid', async () => {
    await form.setState({ name: 'Jo', age: 17 });
    await form.submit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should reset the form state', async () => {
    await form.setState({ name: 'John', age: 25 });
    await form.reset();
    expect(form.state()).toEqual(initialState);
  });

  it('should handle undo and redo operations', async () => {
    await form.setState({ name: 'John', age: 25 });

    await form.setState({ name: 'Jane', age: 30 });

    expect(form.canUndo()).toBe(true);
    await form.undo();

    expect(form.canRedo()).toBe(true);
    await form.redo();
  });

  it('should update field value correctly', async () => {
    await form.setFieldValue('name', 'Alice');
    expect(form.state()?.name).toBe('Alice');
  });

  it('should update field meta correctly', async () => {
    await form.setFieldMeta('name', { ...defaultFieldMetaState, touched: true });
    expect(form.fieldMetas().name?.touched).toBe(true);
  });

  it('should detect if form was modified', async () => {
    expect(form.wasModified()).toBe(false);
    await form.setState({ name: 'John', age: 25 });
    expect(form.wasModified()).toBe(true);
  });

  it('should handle nested object schemas', async () => {
    const nestedSchema = z.object({
      user: z.object({
        name: z.string().min(3),
        email: z.string().email(),
      }),
    });
    const nestedForm = createForm({
      schema: nestedSchema,
      initialState: { user: { name: '', email: '' } },
      onSubmit: vi.fn(),
    });

    await nestedForm.setFieldValue('user.name', 'John');
    await nestedForm.setFieldValue('user.email', 'john@example.com');

    expect(nestedForm.state()).toEqual({
      user: { name: 'John', email: 'john@example.com' },
    });
  });

  it('should handle array fields', async () => {
    const arraySchema = z.object({
      tags: z.array(z.string()),
    });
    const arrayForm = createForm({
      schema: arraySchema,
      initialState: { tags: [] },
      onSubmit: vi.fn(),
    });

    await arrayForm.setFieldValue('tags', ['tag1', 'tag2']);
    expect(arrayForm.state()).toEqual({ tags: ['tag1', 'tag2'] });

    await arrayForm.setFieldValue('tags.0', 'updatedTag');
    expect(arrayForm.state()).toEqual({ tags: ['updatedTag', 'tag2'] });
  });

  it('should handle multiple undo/redo operations', async () => {
    await form.setState({ name: 'John', age: 25 });
    await form.setState({ name: 'Jane', age: 30 });
    await form.setState({ name: 'Bob', age: 35 });

    await form.undo(2);
    expect(form.state()).toEqual({ name: 'John', age: 25 });

    await form.redo();
    expect(form.state()).toEqual({ name: 'Jane', age: 30 });

    expect(form.canUndo()).toBe(true);
    expect(form.canRedo()).toBe(true);
  });

  it('should handle edge cases in undo/redo', async () => {
    expect(form.canUndo()).toBe(false);
    expect(form.canRedo()).toBe(false);

    await form.setState({ name: 'John', age: 25 });
    expect(form.canUndo()).toBe(true);
    expect(form.canRedo()).toBe(false);

    await form.undo();
    expect(form.canUndo()).toBe(false);
    expect(form.canRedo()).toBe(true);

    await form.redo();
    expect(form.canUndo()).toBe(true);
    expect(form.canRedo()).toBe(false);
  });

  it('should handle async initialState', async () => {
    const asyncForm = createForm({
      schema,
      initialState: async () => ({ name: 'Async', age: 30 }),
      onSubmit: vi.fn(),
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(asyncForm.state()).toEqual({ name: 'Async', age: 30 });
  });

  it('should handle async onSubmit', async () => {
    const asyncOnSubmit = vi.fn().mockResolvedValue('success');
    const asyncForm = createForm({
      schema,
      initialState,
      onSubmit: asyncOnSubmit,
    });

    await asyncForm.setState({ name: 'John', age: 25 });
    await asyncForm.submit();

    expect(asyncOnSubmit).toHaveBeenCalledWith({ name: 'John', age: 25 });
  });

  it('should handle form-level errors', async () => {
    const schema = z.object({
      password: z.string(),
      confirmPassword: z.string(),
    }).refine(data => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: [],
    });

    const form = createForm({
      schema: schema,
      initialState: { password: '', confirmPassword: '' },
      onSubmit: vi.fn(),
    });
    await form.setState({ password: 'pass123', confirmPassword: 'pass456' });
    expect(form.errors()).toEqual([{
      path: "",
      message: "Passwords don't match"
    }] satisfies FormixError[]);
  });

  it('should handle custom validation', async () => {
    const customSchema = z.object({
      username: z.string().refine(async (val) => {
        // Simulating an async validation (e.g., checking if username is taken)
        await new Promise(resolve => setTimeout(resolve, 100));
        return val !== 'taken';
      }, { message: 'Username is already taken' })
    });

    const customForm = createForm({
      schema: customSchema,
      initialState: { username: '' },
      onSubmit: vi.fn(),
    });

    await customForm.setFieldValue('username', 'taken');
    await customForm.submit();

    expect(customForm.errors()).toEqual([{
      path: "username",
      message: "Username is already taken"
    }] satisfies FormixError[]);
  });
});

describe('Form component', () => {
  it('should render children and handle submit event', async () => {
    const schema = z.object({ name: z.string() });
    const initialState = { name: '' };
    const onSubmit = vi.fn();

    const form = createForm({ schema, initialState, onSubmit });

    render(() => (
      <Form context={form}>
        <input
          data-testid="name-input"
          onChange={(e) => {
            form.setFieldValue("name", e.target.value)
          }}
        />
        <button type="submit">Submit</button>
      </Form>
    ));

    const input = screen.getByTestId('name-input');
    const submitButton = screen.getByText('Submit');

    fireEvent.input(input, { target: { value: 'John' } });
    fireEvent.click(submitButton);
    setTimeout(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'John' });
    })
  });
});
