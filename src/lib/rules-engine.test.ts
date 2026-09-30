import { describe, expect, it } from "vitest";

import { decide, type DiagnosticProfile } from "./recommend";
import { diffResults, evaluateCondition, evaluateRules, safeRecommend, type EngineRule } from "./rules-engine";

const base: DiagnosticProfile = {
  goals: ["more_enquiries"],
  answers: { geography: ["local"], acquisition: ["google", "whatsapp"], conversion: ["enquiry"], follow_up: ["manual"], problems: [], budget: ["1500"], notes: ["We sell cakes"] },
  classification: { industry: "Bakery", lead_value: "medium", services: ["cakes", "catering"] },
};
const rule = (over: Partial<EngineRule>): EngineRule => ({
  id: over.key ?? "r", key: "r", name: "r", priority: 0, version: 1,
  conditions: { kind: "group", mode: "all", children: [{ kind: "goal", op: "selected", value: "more_enquiries" }] },
  actions: [], ...over,
});
const verdict = (r: ReturnType<typeof evaluateRules>, slug: string) => r.decisions.find((d) => d.component === slug)?.verdict;
const m = (c: any, p = base) => evaluateCondition(c, p).matched;

describe("conditions", () => {
  it("answer equals / not equals / contains", () => {
    expect(m({ kind: "answer", question: "geography", op: "equals", value: "local" })).toBe(true);
    expect(m({ kind: "answer", question: "geography", op: "not_equals", value: "local" })).toBe(false);
    expect(m({ kind: "answer", question: "acquisition", op: "contains", value: "whatsapp" })).toBe(true);
    expect(m({ kind: "answer", question: "acquisition", op: "not_contains", value: "social" })).toBe(true);
    expect(m({ kind: "answer", question: "acquisition", op: "equals", value: "google" })).toBe(false);
  });
  it("answered / empty", () => {
    expect(m({ kind: "answer", question: "problems", op: "not_answered", value: "" })).toBe(true);
    expect(m({ kind: "text", question: "notes", op: "not_empty", value: "" })).toBe(true);
    expect(m({ kind: "text", question: "missing", op: "empty", value: "" })).toBe(true);
    expect(m({ kind: "text", question: "notes", op: "contains", value: "CAKES" })).toBe(true);
  });
  it("numbers", () => {
    expect(m({ kind: "number", question: "budget", op: "gt", value: 1000 })).toBe(true);
    expect(m({ kind: "number", question: "budget", op: "lt", value: 1000 })).toBe(false);
    expect(m({ kind: "number", question: "budget", op: "eq", value: 1500 })).toBe(true);
    expect(m({ kind: "number", question: "budget", op: "gte", value: 1500 })).toBe(true);
  });
  it("classification and goals", () => {
    expect(m({ kind: "classification", field: "services", op: "equals", value: "catering" })).toBe(true);
    expect(m({ kind: "classification", field: "industry", op: "contains", value: "bak" })).toBe(true);
    expect(m({ kind: "goal", op: "not_selected", value: "sell_products" })).toBe(true);
  });
  it("ALL / ANY / nested / empty group", () => {
    const t = { kind: "goal", op: "selected", value: "more_enquiries" };
    const f = { kind: "goal", op: "selected", value: "sell_products" };
    expect(m({ kind: "group", mode: "all", children: [t, f] })).toBe(false);
    expect(m({ kind: "group", mode: "any", children: [t, f] })).toBe(true);
    expect(m({ kind: "group", mode: "all", children: [t, { kind: "group", mode: "any", children: [f, t] }] })).toBe(true);
    expect(m({ kind: "group", mode: "all", children: [] })).toBe(false);
  });
});

describe("actions and conflicts", () => {
  it("recommend / optional / exclude / reason / priority", () => {
    const r = evaluateRules(base, [
      rule({ key: "a", actions: [{ type: "recommend", component: "booking", reason: "Custom reason", priority: 0 }, { type: "exclude", component: "premium-design", reason: "", priority: 0 }, { type: "set_priority", component: "booking", reason: "", priority: 40 }] }),
      rule({ key: "b", actions: [{ type: "optional", component: "whatsapp", reason: "", priority: 0 }] }),
    ]);
    const booking = r.decisions.find((d) => d.component === "booking")!;
    expect(booking.verdict).toBe("recommended");
    expect(booking.reason).toBe("Custom reason");
    expect(booking.priority).toBe(40);
    expect(booking.source).toMatchObject({ type: "rule", ruleKey: "a", ruleVersion: 1 });
    expect(verdict(r, "premium-design")).toBe("excluded");
    expect(verdict(r, "whatsapp")).toBe("optional");
  });
  it("higher priority wins", () => {
    const r = evaluateRules(base, [
      rule({ key: "low", priority: 0, actions: [{ type: "exclude", component: "booking", reason: "", priority: 0 }] }),
      rule({ key: "high", priority: 50, actions: [{ type: "recommend", component: "booking", reason: "", priority: 0 }] }),
    ]);
    expect(verdict(r, "booking")).toBe("recommended");
  });
  it("equal-priority conflict keeps baseline and is recorded", () => {
    const baseline = decide(base).find((d) => d.slug === "booking")!.verdict;
    const r = evaluateRules(base, [
      rule({ key: "x", actions: [{ type: "exclude", component: "booking", reason: "", priority: 0 }] }),
      rule({ key: "y", actions: [{ type: "recommend", component: "booking", reason: "", priority: 0 }] }),
    ]);
    const d = r.decisions.find((x) => x.component === "booking")!;
    expect(d.verdict).toBe(baseline);
    expect(d.conflicts[0]?.ruleKeys).toEqual(["x", "y"]);
  });
  it("is deterministic regardless of rule order", () => {
    const rs = [rule({ key: "a", priority: 5, actions: [{ type: "exclude", component: "crm", reason: "", priority: 0 }] }), rule({ key: "b", actions: [{ type: "recommend", component: "crm", reason: "", priority: 0 }] })];
    expect(JSON.stringify(evaluateRules(base, rs))).toBe(JSON.stringify(evaluateRules(base, [...rs].reverse())));
  });
});

describe("dependencies", () => {
  it("ecommerce → payments even if a rule excludes payments", () => {
    const r = evaluateRules(base, [rule({ key: "shop", actions: [{ type: "recommend", component: "ecommerce", reason: "", priority: 0 }, { type: "exclude", component: "payments", reason: "", priority: 0 }] })]);
    expect(verdict(r, "payments")).toBe("recommended");
    expect(r.decisions.find((d) => d.component === "payments")!.requiredBy).toEqual(["ecommerce"]);
  });
  it("follow-up automation → CRM", () => {
    const r = evaluateRules(base, [rule({ key: "fu", actions: [{ type: "recommend", component: "follow-up-automation", reason: "", priority: 0 }, { type: "exclude", component: "crm", reason: "", priority: 0 }] })]);
    expect(verdict(r, "crm")).toBe("recommended");
  });
});

describe("fallback", () => {
  it("no active rules equals the existing engine", () => {
    const r = safeRecommend(base, []);
    expect(r.mode).toBe("engine");
    expect(r.fallbackReason).toBe("no_active_rules");
    const engine = new Map(decide(base).map((d) => [d.slug, d.verdict]));
    for (const d of r.decisions) expect(d.verdict).toBe(engine.get(d.component));
  });
  it("invalid rule is skipped with a warning", () => {
    const r = safeRecommend(base, [rule({ key: "bad", conditions: { kind: "nope" } as any, actions: [{ type: "exclude", component: "business-website", reason: "", priority: 0 }] })]);
    expect(verdict(r, "business-website")).toBe("recommended");
    expect(r.warnings.join()).toMatch(/bad/);
  });
  it("runtime failure falls back to the engine", () => {
    const evil = rule({ key: "evil" });
    Object.defineProperty(evil, "conditions", { get() { throw new Error("boom"); } });
    const r = safeRecommend(base, [evil]);
    expect(r.fallbackReason).toBe("evaluation_error");
    expect(r.decisions.length).toBeGreaterThan(10);
  });
  it("archived / missing components are never acted on", () => {
    const cat = new Map([["booking", { name: "Booking", pillar: "convert", status: "archived" }]]);
    const r = evaluateRules(base, [rule({ key: "a", actions: [{ type: "exclude", component: "booking", reason: "", priority: 0 }] })], cat as any);
    expect(r.warnings[0]).toMatch(/archived/);
  });
});

describe("history and comparison", () => {
  it("evaluation does not mutate its inputs (stored snapshots stay untouched)", () => {
    const snapshot = { items: [{ slug: "booking", one_time: 320 }] };
    const frozen = JSON.stringify(snapshot);
    const p = structuredClone(base);
    evaluateRules(p, [rule({ key: "a", actions: [{ type: "exclude", component: "booking", reason: "", priority: 0 }] })]);
    expect(JSON.stringify(snapshot)).toBe(frozen);
    expect(p).toEqual(base);
  });
  it("diff reports changed and unchanged", () => {
    const a = safeRecommend(base, []);
    const b = evaluateRules(base, [rule({ key: "a", actions: [{ type: "exclude", component: "booking", reason: "", priority: 0 }] })]);
    const rows = diffResults(a, b);
    expect(rows.find((x) => x.component === "booking")!.kind).toBe(decide(base).find((d) => d.slug === "booking")!.verdict === "excluded" ? "unchanged" : "changed");
    expect(rows.some((x) => x.kind === "unchanged")).toBe(true);
  });
});
