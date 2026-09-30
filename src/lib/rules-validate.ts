import { conditionSchema, type Condition, type RuleAction } from "./rules-engine";
import type { RuleInput } from "./rules-schemas";

type WS = {
  questions: { key: string; question: string; type: string; status: string; options: { key: string; label: string; active: boolean }[] }[];
  components: { slug: string; name: string; status: string }[];
  goals: { id: string; label: string }[];
  rules: { id: string; name: string; status: string; priority: number; actions: RuleAction[] }[];
};

/* ------------------------------------------------------------------ validation */

export function leaves(c: Condition): Exclude<Condition, { kind: "group" }>[] {
  return c.kind === "group" ? c.children.flatMap(leaves) : [c];
}

export function validateRule(
  rule: Pick<RuleInput, "conditions" | "actions" | "priority" | "key"> & { id?: string | undefined },
  ws: WS,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!conditionSchema.safeParse(rule.conditions).success) errors.push("The conditions are not valid.");
  const ls = leaves(rule.conditions);
  if (ls.length === 0) errors.push("Add at least one condition.");
  if (rule.actions.length === 0) errors.push("Add at least one action.");
  const depth = (c: Condition, d = 1): number => (c.kind === "group" ? Math.max(d, ...c.children.map((x) => depth(x, d + 1))) : d - 1);
  if (depth(rule.conditions) > 3) errors.push("Groups can be nested at most three levels deep.");

  for (const l of ls) {
    if (l.kind === "goal") {
      if (!ws.goals.some((g) => g.id === l.value)) errors.push(`Unknown goal "${l.value}".`);
      continue;
    }
    if (l.kind === "classification") {
      if (!["empty", "not_empty"].includes(l.op) && !l.value) errors.push(`Enter a value for business ${l.field}.`);
      continue;
    }
    const q = ws.questions.find((x) => x.key === l.question);
    if (!q) { errors.push(`Unknown question "${l.question}".`); continue; }
    if (q.status === "archived") warnings.push(`This rule references a question that is archived: "${q.question}".`);
    const choice = ["single_choice", "multi_choice", "yes_no"].includes(q.type);
    if (l.kind === "answer") {
      if (!choice) errors.push(`"${q.question}" is not a choice question — use a text or number condition.`);
      else if (!["answered", "not_answered"].includes(l.op)) {
        const opt = q.options.find((o) => o.key === l.value);
        if (!opt) errors.push(`"${l.value}" is not an answer of "${q.question}".`);
        else if (!opt.active) warnings.push(`This condition can never match because "${opt.label}" is no longer available.`);
      }
    }
    if (l.kind === "number" && q.type !== "number") errors.push(`"${q.question}" is not a number question.`);
    if (l.kind === "text" && choice) warnings.push(`"${q.question}" is a choice question; an answer condition is usually clearer.`);
  }

  for (const a of rule.actions) {
    const c = ws.components.find((x) => x.slug === a.component);
    if (!c) errors.push(`Unknown component "${a.component}".`);
    else if (c.status === "archived") warnings.push(`This rule targets ${c.name}, which is archived — the action will be skipped.`);
    else if (c.status === "draft") warnings.push(`${c.name} is still a draft component.`);
    if (a.type === "set_reason" && !a.reason) errors.push("A set-reason action needs a reason.");
  }

  // Equal-priority conflicts with other active rules.
  const mine = rule.actions.filter((a) => ["recommend", "optional", "exclude"].includes(a.type));
  for (const other of ws.rules) {
    if (other.id === rule.id || other.status !== "active" || other.priority !== rule.priority) continue;
    for (const a of mine) {
      const clash = (other.actions ?? []).find((b) => b.component === a.component && ["recommend", "optional", "exclude"].includes(b.type) && b.type !== a.type);
      if (clash) warnings.push(`May conflict with active rule "${other.name}" (same priority, ${clash.type} vs ${a.type} on ${a.component}). If both match, the built-in engine's verdict is kept.`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

