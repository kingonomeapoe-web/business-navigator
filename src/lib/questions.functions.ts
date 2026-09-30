import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DIAGNOSTIC_QUESTIONS } from "./diagnostic-content";
import {
  YES_NO_OPTIONS,
  questionIdSchema,
  questionInputSchema,
  questionReorderSchema,
  questionStatusSchema,
  type PublicQuestion,
  type QuestionType,
} from "./question-schemas";
import type { AdminQuestionDetail, AdminQuestionRow } from "./questions.server";

async function guard(userId: string) {
  const { requireAdmin } = await import("./admin.server");
  await requireAdmin(userId);
  return import("./questions.server");
}

export const listAdminQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminQuestionRow[]> => (await guard(context.userId)).listQuestions());

export const getAdminQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdminQuestionDetail | null> => (await guard(context.userId)).getQuestion(data.id));

export const saveAdminQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => (await guard(context.userId)).saveQuestion(data, context.userId));

export const setAdminQuestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionStatusSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> =>
    (await guard(context.userId)).setQuestionStatus(data.id, data.status, context.userId),
  );

export const removeAdminQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ result: "deleted" | "archived" }> =>
    (await guard(context.userId)).removeQuestion(data.id, context.userId),
  );

export const duplicateAdminQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => (await guard(context.userId)).duplicateQuestion(data.id, context.userId));

export const reorderAdminQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionReorderSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => (await guard(context.userId)).reorderQuestions(data.ids, context.userId));

/* ------------------------------------------------------------------ public */

/** The built-in questions, used whenever no published questions are available. */
export function fallbackQuestions(): PublicQuestion[] {
  return DIAGNOSTIC_QUESTIONS.map((q) => ({
    id: q.id,
    question: q.question,
    ...(q.help ? { help: q.help } : {}),
    type: q.type === "single" ? "single_choice" : "multi_choice",
    required: true,
    options: q.options,
    ...(q.goals ? { goals: q.goals } : {}),
  }));
}

/**
 * Published diagnostic questions in configured order. Never throws. When the
 * database has no published questions (or is unreachable) the built-in set is returned.
 */
export const getPublicQuestions = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ source: "database" | "fallback"; questions: PublicQuestion[] }> => {
    const fallback = { source: "fallback" as const, questions: fallbackQuestions() };
    try {
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      const url = process.env["SUPABASE_URL"];
      if (!key || !url) return fallback;
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          },
        },
      });
      const { data, error } = await supabase
        .from("diagnostic_questions")
        .select("id,key,question,help_text,question_type,required,placeholder,goals,display_order,diagnostic_question_options(key,label,display_order,active)")
        .eq("status", "published")
        .order("display_order");
      if (error || !data || data.length === 0) return fallback;
      const questions: PublicQuestion[] = (data as any[]).map((q) => {
        const type = q.question_type as QuestionType;
        const options =
          type === "yes_no"
            ? YES_NO_OPTIONS.map((o) => ({ id: o.key, label: o.label }))
            : ((q.diagnostic_question_options ?? []) as any[])
                .filter((o) => o.active)
                .sort((a, b) => a.display_order - b.display_order)
                .map((o) => ({ id: o.key, label: o.label }));
        return {
          id: q.key,
          question: q.question,
          ...(q.help_text ? { help: q.help_text } : {}),
          type,
          required: q.required,
          ...(q.placeholder ? { placeholder: q.placeholder } : {}),
          options,
          ...(q.goals?.length ? { goals: q.goals } : {}),
        };
      });
      return { source: "database", questions: questions.filter((q) => !["single_choice", "multi_choice"].includes(q.type) || q.options.length > 0) };
    } catch {
      return fallback;
    }
  },
);
