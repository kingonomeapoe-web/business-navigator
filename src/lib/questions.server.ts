/**
 * Server-only Question Builder logic. Callers must run `requireAdmin` first.
 */
import { YES_NO_OPTIONS, isChoiceType, publishProblems, type QuestionInput, type QuestionStatus, type QuestionType } from "./question-schemas";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type AdminQuestionRow = {
  id: string;
  key: string;
  question: string;
  question_type: QuestionType;
  status: QuestionStatus;
  required: boolean;
  display_order: number;
  option_count: number;
  updated_at: string;
  updated_by_email: string | null;
};

export type AdminQuestionOption = {
  id: string;
  key: string;
  label: string;
  description: string;
  display_order: number;
  active: boolean;
  internal_notes: string;
};

export type AdminQuestionDetail = {
  id: string;
  key: string;
  question: string;
  short_label: string;
  help_text: string;
  question_type: QuestionType;
  required: boolean;
  placeholder: string;
  display_order: number;
  status: QuestionStatus;
  internal_notes: string;
  published_at: string | null;
  goals: string[];
  options: AdminQuestionOption[];
  usage: number;
  keyLocked: boolean;
  log: { id: string; action: string; field: string | null; previous_value: string | null; new_value: string | null; created_at: string; email: string | null }[];
};

async function emails(ids: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return {};
  const { data } = await (await db()).from("profiles").select("id,email").in("id", unique);
  return Object.fromEntries(((data ?? []) as { id: string; email: string }[]).map((p) => [p.id, p.email]));
}

async function log(entries: { question_id: string | null; question_key: string; action: string; field?: string; previous_value?: string | null; new_value?: string | null }[], userId: string) {
  if (!entries.length) return;
  await (await db()).from("question_change_log").insert(entries.map((e) => ({ ...e, changed_by: userId })));
}

/** How many diagnostic runs have stored an answer under this key. */
export async function questionUsage(key: string): Promise<number> {
  const { count } = await (await db())
    .from("diagnostic_sessions")
    .select("id", { count: "exact", head: true })
    .not(`answers->${key}`, "is", null);
  return count ?? 0;
}

export async function listQuestions(): Promise<AdminQuestionRow[]> {
  const supabase = await db();
  const [{ data: qs, error }, { data: opts }] = await Promise.all([
    supabase.from("diagnostic_questions").select("id,key,question,question_type,status,required,display_order,updated_at,updated_by").order("display_order"),
    supabase.from("diagnostic_question_options").select("question_id"),
  ]);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const o of (opts ?? []) as { question_id: string }[]) counts[o.question_id] = (counts[o.question_id] ?? 0) + 1;
  const map = await emails((qs ?? []).map((q: any) => q.updated_by));
  return (qs ?? []).map((q: any) => ({
    id: q.id,
    key: q.key,
    question: q.question,
    question_type: q.question_type,
    status: q.status,
    required: q.required,
    display_order: q.display_order,
    option_count: q.question_type === "yes_no" ? 2 : counts[q.id] ?? 0,
    updated_at: q.updated_at,
    updated_by_email: q.updated_by ? map[q.updated_by] ?? null : null,
  }));
}

export async function getQuestion(id: string): Promise<AdminQuestionDetail | null> {
  const supabase = await db();
  const { data: q } = await supabase.from("diagnostic_questions").select("*").eq("id", id).maybeSingle();
  if (!q) return null;
  const [{ data: options }, { data: logRows }, usage] = await Promise.all([
    supabase.from("diagnostic_question_options").select("id,key,label,description,display_order,active,internal_notes").eq("question_id", id).order("display_order"),
    supabase.from("question_change_log").select("id,action,field,previous_value,new_value,created_at,changed_by").eq("question_id", id).order("created_at", { ascending: false }).limit(30),
    questionUsage(q.key),
  ]);
  const map = await emails((logRows ?? []).map((l: any) => l.changed_by));
  return {
    id: q.id,
    key: q.key,
    question: q.question,
    short_label: q.short_label,
    help_text: q.help_text,
    question_type: q.question_type,
    required: q.required,
    placeholder: q.placeholder,
    display_order: q.display_order,
    status: q.status,
    internal_notes: q.internal_notes,
    published_at: q.published_at,
    goals: q.goals ?? [],
    options: (options ?? []) as AdminQuestionOption[],
    usage,
    keyLocked: usage > 0 || !!q.published_at,
    log: (logRows ?? []).map((l: any) => ({ ...l, email: l.changed_by ? map[l.changed_by] ?? null : null })),
  };
}

const TRACKED = ["key", "question", "short_label", "help_text", "question_type", "required", "placeholder", "display_order", "status", "internal_notes"] as const;

function friendly(message: string): string {
  if (message.includes("diagnostic_questions_key_key")) return "Another question already uses that stable key.";
  if (message.includes("question_id_key")) return "Two answer options share the same key.";
  return message;
}

export async function saveQuestion(input: QuestionInput, userId: string): Promise<{ id: string }> {
  const supabase = await db();
  const choice = isChoiceType(input.question_type);
  const options = choice ? input.options : [];

  if (input.status === "published") {
    const problems = publishProblems({ ...input, options });
    if (problems.length) throw new Error(`Cannot publish yet: ${problems.join(" ")}`);
  }

  const row = {
    key: input.key,
    question: input.question,
    short_label: input.short_label,
    help_text: input.help_text,
    question_type: input.question_type,
    required: input.required,
    placeholder: input.placeholder,
    display_order: input.display_order,
    status: input.status,
    internal_notes: input.internal_notes,
    updated_by: userId,
  };

  let id = input.id;
  if (id) {
    const current = await getQuestion(id);
    if (!current) throw new Error("Question not found");
    if (current.keyLocked && current.key !== input.key) {
      throw new Error("This question's stable key is locked because it has been published or answered. Duplicate the question if you need a new key.");
    }
    const patch: Record<string, unknown> = { ...row };
    if (input.status === "published" && !current.published_at) patch["published_at"] = new Date().toISOString();
    const { error } = await supabase.from("diagnostic_questions").update(patch).eq("id", id);
    if (error) throw new Error(friendly(error.message));
    await log(
      TRACKED.filter((f) => String((current as any)[f]) !== String((input as any)[f])).map((f) => ({
        question_id: id!,
        question_key: input.key,
        action: "updated",
        field: f,
        previous_value: String((current as any)[f]),
        new_value: String((input as any)[f]),
      })),
      userId,
    );

    // Sync options: update/insert provided ones; removed ones are deleted if the
    // question has never been answered, otherwise deactivated to keep history readable.
    const keepIds = options.map((o) => o.id).filter(Boolean) as string[];
    const removed = current.options.filter((o) => !keepIds.includes(o.id));
    if (removed.length) {
      if (current.usage > 0) {
        await supabase.from("diagnostic_question_options").update({ active: false }).in("id", removed.map((o) => o.id));
      } else {
        await supabase.from("diagnostic_question_options").delete().in("id", removed.map((o) => o.id));
      }
      await log(removed.map((o) => ({ question_id: id!, question_key: input.key, action: current.usage > 0 ? "option_deactivated" : "option_deleted", field: o.key, previous_value: o.label })), userId);
    }
    // Temporarily move existing keys aside to avoid unique clashes on key swaps.
    for (const o of options.filter((o) => o.id)) {
      const before = current.options.find((c) => c.id === o.id);
      if (before && before.key !== o.key && current.usage > 0) {
        throw new Error(`Option key "${before.key}" is locked because people have already answered this question.`);
      }
    }
  } else {
    const { data, error } = await supabase
      .from("diagnostic_questions")
      .insert({ ...row, created_by: userId, published_at: input.status === "published" ? new Date().toISOString() : null })
      .select("id")
      .single();
    if (error) throw new Error(friendly(error.message));
    id = data.id as string;
    await log([{ question_id: id, question_key: input.key, action: "created" }], userId);
  }

  if (options.length) {
    const existing = options.filter((o) => o.id);
    const fresh = options.filter((o) => !o.id);
    for (const o of existing) {
      await supabase.from("diagnostic_question_options").update({ key: `__tmp_${o.id!.slice(0, 8)}` }).eq("id", o.id);
    }
    for (const o of existing) {
      const { error } = await supabase
        .from("diagnostic_question_options")
        .update({ key: o.key, label: o.label, description: o.description, display_order: o.display_order, active: o.active, internal_notes: o.internal_notes })
        .eq("id", o.id);
      if (error) throw new Error(friendly(error.message));
    }
    if (fresh.length) {
      const { error } = await supabase.from("diagnostic_question_options").insert(fresh.map((o) => ({ ...o, question_id: id })));
      if (error) throw new Error(friendly(error.message));
      await log(fresh.map((o) => ({ question_id: id!, question_key: input.key, action: "option_added", field: o.key, new_value: o.label })), userId);
    }
  }
  return { id: id! };
}

export async function setQuestionStatus(id: string, status: QuestionStatus, userId: string): Promise<{ ok: true }> {
  const q = await getQuestion(id);
  if (!q) throw new Error("Question not found");
  if (status === "published") {
    const problems = publishProblems(q);
    if (problems.length) throw new Error(`Cannot publish yet: ${problems.join(" ")}`);
  }
  const patch: Record<string, unknown> = { status, updated_by: userId };
  if (status === "published" && !q.published_at) patch["published_at"] = new Date().toISOString();
  const { error } = await (await db()).from("diagnostic_questions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await log([{ question_id: id, question_key: q.key, action: status === "published" ? "published" : status === "archived" ? "archived" : "unpublished", field: "status", previous_value: q.status, new_value: status }], userId);
  return { ok: true };
}

/** Deletes only never-published, never-answered questions; otherwise archives. */
export async function removeQuestion(id: string, userId: string): Promise<{ result: "deleted" | "archived" }> {
  const q = await getQuestion(id);
  if (!q) throw new Error("Question not found");
  if (q.keyLocked) {
    await setQuestionStatus(id, "archived", userId);
    return { result: "archived" };
  }
  const { error } = await (await db()).from("diagnostic_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await log([{ question_id: null, question_key: q.key, action: "deleted" }], userId);
  return { result: "deleted" };
}

export async function duplicateQuestion(id: string, userId: string): Promise<{ id: string }> {
  const q = await getQuestion(id);
  if (!q) throw new Error("Question not found");
  const supabase = await db();
  let key = `${q.key}_copy`.slice(0, 74);
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase.from("diagnostic_questions").select("id").eq("key", key).maybeSingle();
    if (!data) break;
    key = `${q.key.slice(0, 70)}_copy${i}`;
  }
  const { data: max } = await supabase.from("diagnostic_questions").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("diagnostic_questions")
    .insert({
      key,
      question: q.question,
      short_label: q.short_label,
      help_text: q.help_text,
      question_type: q.question_type,
      required: q.required,
      placeholder: q.placeholder,
      display_order: (max?.display_order ?? 0) + 10,
      status: "draft",
      goals: q.goals,
      internal_notes: q.internal_notes,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (q.options.length) {
    await supabase.from("diagnostic_question_options").insert(
      q.options.map((o) => ({ question_id: data.id, key: o.key, label: o.label, description: o.description, display_order: o.display_order, active: o.active, internal_notes: o.internal_notes })),
    );
  }
  await log([{ question_id: data.id, question_key: key, action: "duplicated", previous_value: q.key }], userId);
  return { id: data.id };
}

export async function reorderQuestions(ids: string[], userId: string): Promise<{ ok: true }> {
  const supabase = await db();
  await Promise.all(ids.map((id, i) => supabase.from("diagnostic_questions").update({ display_order: (i + 1) * 10, updated_by: userId }).eq("id", id)));
  await log([{ question_id: null, question_key: "*", action: "reordered", new_value: ids.join(",") }], userId);
  return { ok: true };
}

export { YES_NO_OPTIONS };
