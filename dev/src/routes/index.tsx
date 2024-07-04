import { createForm, Form, useField, useArrayField, FieldContext, useForm } from '@gapu/formix';

import { createEffect, createSignal } from 'solid-js';
import { z } from 'zod';

const jobApplicationSchema = z.object({
  personalInfo: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  }),
  education: z.array(z.object({
    institution: z.string().min(2, 'Institution name is required'),
    degree: z.string().min(2, 'Degree is required'),
    graduationYear: z.number().min(1900).max(new Date().getFullYear()),
  })),
  workExperience: z.array(z.object({
    company: z.string().min(2, 'Company name is required'),
    position: z.string().min(2, 'Position is required'),
    currentlyWorking: z.boolean(),
  })),
  skills: z.array(z.string()),
  additionalInfo: z.string().optional(),
});

const JobApplicationForm = () => {
  const formContext = createForm({
    schema: jobApplicationSchema,
    initialState: {
      personalInfo: { firstName: '', lastName: '', email: '', phone: '' },
      education: [],
      workExperience: [],
      skills: [],
      additionalInfo: '',
    },
    onSubmit: async (state) => {
      console.log('Form submitted:', state);
    },
  });

  return (
    <Form context={formContext}>
      <div class="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg">
        <h1 class="text-3xl font-bold mb-6">Job Application</h1>

        <PersonalInfoSection />
        <EducationSection />
        <WorkExperienceSection />
        <SkillsSection />
        <AdditionalInfoSection />

        <div class="mt-8">
          <button
            type="submit"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Submit Application
          </button>
        </div>
      </div>
    </Form>
  );
};

const PersonalInfoSection = () => {
  return (
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Personal Information</h2>
      <div class="grid grid-cols-2 gap-4">
        <TextField label="First Name" name={'personalInfo.firstName'} />
        <TextField label="Last Name" name={'personalInfo.lastName'} />
        <TextField label="Email" name={'personalInfo.email'} />
        <TextField label="Phone" name={'personalInfo.phone'} />
      </div>
    </section>
  );
};

const EducationSection = () => {
  const education = useArrayField('education');

  return (
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Education</h2>
      {(education.value() ?? []).map((_: unknown, index: number) => (
        <EducationEntry index={index} />
      ))}
      <button
        type="button"
        onClick={() => education.push({ institution: '', degree: '', graduationYear: new Date().getFullYear() })}
        class="mt-2 bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition"
      >
        Add Education
      </button>
    </section>
  );
};

const EducationEntry = (props: { index: number }) => {
  return (
    <div class="mb-4 p-4 border rounded">
      <TextField label="Institution" name={`education.${props.index}.institution`} />
      <TextField label="Degree" name={`education.${props.index}.degree`} />
      <TextField label="Graduation Year" name={`education.${props.index}.graduationYear`} />
    </div>
  );
};

const WorkExperienceSection = () => {
  const workExperience = useArrayField('workExperience');

  return (
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Work Experience</h2>
      {(workExperience.value() ?? []).map((_: unknown, index: number) => (
        <WorkExperienceEntry index={index} />
      ))}
      <button
        type="button"
        onClick={() => workExperience.push({ company: '', position: '', currentlyWorking: false })}
        class="mt-2 bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition"
      >
        Add Work Experience
      </button>
    </section>
  );
};

const WorkExperienceEntry = (props: { index: number }) => {
  const currentlyWorking = useField<boolean>(`workExperience.${props.index}.currentlyWorking`);

  return (
    <div class="mb-4 p-4 border rounded">
      <TextField label="Company" name={`workExperience.${props.index}.company`} />
      <TextField label="Position" name={`workExperience.${props.index}.position`} />
      <div class="flex items-center mt-2">
        <input
          type="checkbox"
          id={`currentlyWorking-${props.index}`}
          checked={currentlyWorking.value()}
          onChange={(e) => currentlyWorking.setValue(e.target.checked)}
          class="mr-2"
        />
        <label for={`currentlyWorking-${props.index}`}>I currently work here</label>
      </div>
    </div>
  );
};

const SkillsSection = () => {
  const skills = useArrayField('skills');
  const [newSkill, setNewSkill] = createSignal('');

  const addSkill = () => {
    if (newSkill()) {
      skills.push(newSkill());
      setNewSkill('');
    }
  };

  return (
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Skills</h2>
      <div class="flex flex-wrap gap-2 mb-4">
        {(skills.value() ?? []).map((skill: any, index: number) => (
          <div class="bg-gray-200 px-3 py-1 rounded">
            {skill}
            <button
              type="button"
              onClick={() => skills.remove(index)}
              class="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div class="flex">
        <input
          type="text"
          value={newSkill()}
          onInput={(e) => setNewSkill(e.target.value)}
          class="border rounded px-2 py-1 mr-2 flex-grow"
          placeholder="Enter a skill"
        />
        <button
          type="button"
          onClick={addSkill}
          class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
        >
          Add Skill
        </button>
      </div>
    </section>
  );
};

const AdditionalInfoSection = () => {
  const additionalInfo = useField<string>('additionalInfo');

  return (
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Additional Information</h2>
      <textarea
        value={additionalInfo.value()}
        onInput={(e) => additionalInfo.setValue(e.target.value)}
        class="w-full h-32 border rounded px-2 py-1"
        placeholder="Any additional information you'd like to share..."
      />
    </section>
  );
};

const TextField = (props: { name: string; label: string; }) => {
  const f = useField<string>(props.name)
  const form = useForm()
createEffect(() => {
  console.log(form.errors())
})
  return (
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-1">{props.label}</label>
      <input
        value={f.value()}
        onInput={(e) => f.setValue(e.target.value)}
        disabled={f.meta().disabled}
        class="w-full border rounded px-2 py-1"
      />
      {f.errors().map((e) => (
        <p class="text-red-500 text-sm mt-1">{e.message}</p>
      ))}
    </div>
  )
};

export default JobApplicationForm;
