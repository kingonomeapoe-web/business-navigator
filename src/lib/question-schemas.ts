import { z } from "zod";

export const QUESTION_TYPES = ["single_choice", "multi_choice", "text", "textarea", "number", "yes_no", "url"] as const;
export const QUESTION_STATUSES = ["draft", "published", "archived"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  text: "Short text",
  textarea: "Long text",
  number: "Number",
  yes_no: "Yes / No",
  url: "Web address",
};

export const CHOICE_TYPES: QuestionType[] = ["single_choice", "multi_choice"];
export const isChoiceType = (t: QuestionType) => CHOICE_TYPES.includes(t);

/** Fixed, stable option keys for yes/no questions. */
export const YES_NO_OPTIONS = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
];

export const questionKey = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,79}$/, "Use lowercase letters, numbers and underscores, starting with a letter (e.g. business_has_website)");
export const optionKey = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,59}$/, "Use lowercase letters, numbers and underscores, starting with a letter (e.g. not_sure)");

export const optionInputSchema = z.object({
  id: z.string().uuid().optional(),
  key: optionKey,
  label: z.string().trim().min(1, "Every option needs a label").max(200),
  description: z.string().trim().max(400).default(""),
  display_order: z.number().int().min(0).max(9999),
  active: z.boolean().default(true),
  internal_notes: z.string().trim().max(2000).default(""),
});
export type OptionInput = z.infer<typeof optionInputSchema>;

export const questionInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    key: questionKey,
    question: z.string().trim().min(3, "Enter the question text").max(300),
    short_label: z.string().trim().max(80).default(""),
    help_text: z.string().trim().max(600).default(""),
    question_type: z.enum(QUESTION_TYPES),
    required: z.boolean(),
    placeholder: z.string().trim().max(160).default(""),
    display_order: z.number().int().min(0).max(9999),
    status: z.enum(QUESTION_STATUSES),
    internal_notes: z.string().trim().max(4000).default(""),
    options: z.array(optionInputSchema).max(60).default([]),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.options.forEach((o, i) => {
      if (seen.has(o.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options", i, "key"], message: `Option key "${o.key}" is used twice` });
      seen.add(o.key);
    });
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/** Problems that block publishing. Empty array = safe to publish. */
export function publishProblems(q: { key: string; question: string; question_type: string; display_order: number; options: { key: string; active: boolean }[] }): string[] {
  const problems: string[] = [];
  if (!q.question.trim()) problems.push("Add the question text.");
  if (!questionKey.safeParse(q.key).success) problems.push("Give the question a valid stable key.");
  if (!(QUESTION_TYPES as readonly string[]).includes(q.question_type)) problems.push("Choose a valid question type.");
  if (!(q.display_order >= 0)) problems.push("Display order must be zero or more.");
  if (isChoiceType(q.question_type as QuestionType)) {
    if (!q.options.some((o) => o.active)) problems.push("Choice questions need at least one active answer option.");
    const keys = q.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) problems.push("Answer option keys must be unique within the question.");
  }
  return problems;
}

export const questionIdSchema = z.object({ id: z.string().uuid() });
export const questionStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(QUESTION_STATUSES) });
export const questionReorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

/** Shape the public diagnostic renders. `id` is the stable question key. */
export type PublicQuestion = {
  id: string;
  question: string;
  help?: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
  options: { id: string; label: string }[];
  goals?: string[];
};
