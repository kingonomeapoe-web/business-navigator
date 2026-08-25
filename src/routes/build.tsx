import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import {
  buildPlan,
  classifyBusiness,
  getSession,
  saveSession,
  startSession,
  type Classification,
} from "@/lib/builder.functions";
import { DIAGNOSTIC_QUESTIONS, GOAL_OPTIONS, PILLARS } from "@/lib/diagnostic-content";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "Your business diagnostic — Satphonix Business Builder" },
      {
        name: "description",
        content:
          "A short, plain-language interview about your business. Satphonix turns your answers into a personalised digital business system.",
      },
      { property: "og:title", content: "Your business diagnostic — Satphonix" },
      {
        property: "og:description",
        content: "Tell us about your business and see what your digital business needs.",
      },
    ],
  }),
  ssr: false,
  component: BuildPage,
});

const STORAGE_KEY = "satphonix.session";

type StepId =
  | "first_name"
  | "business_name"
  | "description"
  | "location"
  | "classifying"
  | "confirm"
  | "two_cars"
  | "four_jobs"
  | "goals"
  | `q:${string}`
  | "scenario"
  | "finishing";

function BuildPage() {
  const navigate = useNavigate();
  const start = useServerFn(startSession);
  const save = useServerFn(saveSession);
  const load = useServerFn(getSession);
  const classify = useServerFn(classifyBusiness);
  const plan = useServerFn(buildPlan);

  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("first_name");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [classification, setClassification] = useState<Classification | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const questions = useMemo(
    () => DIAGNOSTIC_QUESTIONS.filter((q) => !q.goals || q.goals.some((g) => goals.includes(g))),
    [goals],
  );

  const order: StepId[] = useMemo(
    () => [
      "first_name",
      "business_name",
      "description",
      "location",
      "classifying",
      "confirm",
      "two_cars",
      "four_jobs",
      "goals",
      ...questions.map((q) => `q:${q.id}` as StepId),
      "scenario",
      "finishing",
    ],
    [questions],
  );

  const progress = Math.round(((order.indexOf(step) + 1) / order.length) * 100);

  // Resume or create a session.
  useEffect(() => {
    let cancelled = false;
    const existing = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    (async () => {
      try {
        if (existing) {
          const session = await load({ data: { token: existing } });
          if (session && !cancelled) {
            setToken(session.token);
            setFirstName(session.first_name ?? "");
            setBusinessName(session.business_name ?? "");
            setDescription(session.business_description ?? "");
            setCity(session.city ?? "");
            setRegion(session.region ?? "");
            setCountry(session.country ?? "");
            setServiceArea(session.service_area ?? "");
            setGoals(session.goals ?? []);
            setAnswers(session.answers ?? {});
            if (Object.keys(session.classification ?? {}).length > 0) {
              setClassification(session.classification as unknown as Classification);
            }
            return;
          }
        }
        const created = await start({ data: undefined });
        if (cancelled) return;
        window.localStorage.setItem(STORAGE_KEY, created.token);
        setToken(created.token);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("We couldn't start your session. Please refresh and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, start]);

  const goNext = useCallback(() => {
    const index = order.indexOf(step);
    const next = order[Math.min(index + 1, order.length - 1)];
    if (next) setStep(next);
  }, [order, step]);

  const goBack = useCallback(() => {
    const index = order.indexOf(step);
    const previous = order[Math.max(index - 1, 0)];
    if (previous === "classifying") {
      setStep("location");
      return;
    }
    if (previous) setStep(previous);
  }, [order, step]);

  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!token) return;
      try {
        await save({ data: { token, patch: { ...patch, step } } });
      } catch (err) {
        console.error(err);
      }
    },
    [save, step, token],
  );

  // Classification runs once we have the business basics.
  useEffect(() => {
    if (step !== "classifying" || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await classify({ data: { token } });
        if (cancelled) return;
        setClassification(result);
        setStep("confirm");
      } catch (err) {
        console.error(err);
        if (!cancelled) setStep("confirm");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classify, step, token]);

  // Final step: persist selections and open the plan.
  useEffect(() => {
    if (step !== "finishing" || !token) return;
    let cancelled = false;
    (async () => {
      try {
        await save({ data: { token, patch: { goals, answers, step: "complete" } } });
        await plan({ data: { token, persistQuote: true } });
        if (!cancelled) navigate({ to: "/plan/$token", params: { token } });
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("We couldn't build your recommendation. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [answers, goals, navigate, plan, save, step, token]);

  const businessLabel = businessName.trim() || "your business";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader minimal />
      <div className="h-1 w-full bg-secondary">
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10 sm:py-16">
        {error && (
          <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {step === "first_name" && (
              <TextStep
                eyebrow="Step one"
                title="Let's start with you. What should we call you?"
                value={firstName}
                onChange={setFirstName}
                placeholder="First name"
                onSubmit={async () => {
                  await persist({ first_name: firstName.trim() });
                  goNext();
                }}
              />
            )}

            {step === "business_name" && (
              <TextStep
                eyebrow={firstName ? `Nice to meet you, ${firstName}` : "Step two"}
                title="And what's your business called?"
                value={businessName}
                onChange={setBusinessName}
                placeholder="Business name"
                onBack={goBack}
                onSubmit={async () => {
                  await persist({ business_name: businessName.trim() });
                  goNext();
                }}
              />
            )}

            {step === "description" && (
              <div>
                <p className="eyebrow">In your own words</p>
                <h1 className="display mt-4 text-3xl sm:text-4xl">Tell us what {businessLabel} does.</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Write it the way you'd explain it to someone you just met. No jargon needed.
                </p>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="We help families with UK visa applications…"
                  className="mt-6 w-full rounded-xl border border-input bg-card p-4 text-base outline-none ring-ring/30 transition focus:border-ring focus:ring-4"
                />
                <StepActions
                  onBack={goBack}
                  disabled={description.trim().length < 12}
                  onNext={async () => {
                    await persist({ business_description: description.trim() });
                    goNext();
                  }}
                />
              </div>
            )}

            {step === "location" && (
              <div>
                <p className="eyebrow">Where you work</p>
                <h1 className="display mt-4 text-3xl sm:text-4xl">Where does {businessLabel} serve customers?</h1>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="City" value={city} onChange={setCity} placeholder="Maidstone" />
                  <Field label="State or region" value={region} onChange={setRegion} placeholder="Kent" />
                  <Field label="Country" value={country} onChange={setCountry} placeholder="United Kingdom" />
                  <Field
                    label="Wider service area (optional)"
                    value={serviceArea}
                    onChange={setServiceArea}
                    placeholder="Kent and the rest of the UK"
                  />
                </div>
                <StepActions
                  onBack={goBack}
                  disabled={!city.trim() || !country.trim()}
                  nextLabel="See what we understood"
                  onNext={async () => {
                    setBusy(true);
                    await persist({
                      city: city.trim(),
                      region: region.trim(),
                      country: country.trim(),
                      service_area: serviceArea.trim(),
                    });
                    setBusy(false);
                    setStep("classifying");
                  }}
                  busy={busy}
                />
              </div>
            )}

            {step === "classifying" && (
              <div className="flex flex-col items-center py-16 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="mt-6 text-lg">Reading what you told us about {businessLabel}…</p>
                <p className="mt-2 text-sm text-muted-foreground">This takes a few seconds.</p>
              </div>
            )}

            {step === "confirm" && (
              <div>
                <p className="eyebrow">We think we've got you</p>
                <h1 className="display mt-4 text-3xl sm:text-4xl">
                  {classification?.summary ?? `${businessLabel} serves customers in ${city || "your area"}.`}
                </h1>
                <p className="mt-4 text-sm text-muted-foreground">Is that right?</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <PrimaryButton onClick={goNext}>Yes, that's us</PrimaryButton>
                  <GhostButton onClick={() => setStep("description")}>Let me edit that</GhostButton>
                </div>
              </div>
            )}

            {step === "two_cars" && <TwoCars businessLabel={businessLabel} onNext={goNext} onBack={goBack} />}

            {step === "four_jobs" && (
              <div>
                <p className="eyebrow">The four jobs</p>
                <h1 className="display mt-4 text-3xl sm:text-4xl">Your website has four jobs.</h1>
                <div className="mt-8 space-y-5">
                  {PILLARS.map((pillar) => (
                    <div key={pillar.key} className="surface p-5">
                      <p className="eyebrow text-accent">{pillar.name}</p>
                      <p className="mt-2 text-[15px] leading-relaxed">{pillar.detail}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-muted-foreground">
                  Let's see which of these matter most to {businessLabel}.
                </p>
                <StepActions onBack={goBack} onNext={goNext} nextLabel="Continue" />
              </div>
            )}

            {step === "goals" && (
              <div>
                <p className="eyebrow">Your priorities</p>
                <h1 className="display mt-4 text-3xl sm:text-4xl">
                  What would you most like your website to accomplish?
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">Choose as many as apply.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {GOAL_OPTIONS.map((goal) => (
                    <Choice
                      key={goal.id}
                      label={goal.label}
                      selected={goals.includes(goal.id)}
                      onClick={() =>
                        setGoals((current) =>
                          current.includes(goal.id) ? current.filter((g) => g !== goal.id) : [...current, goal.id],
                        )
                      }
                    />
                  ))}
                </div>
                <StepActions
                  onBack={goBack}
                  disabled={goals.length === 0}
                  onNext={async () => {
                    await persist({ goals });
                    goNext();
                  }}
                />
              </div>
            )}

            {step.startsWith("q:") &&
              (() => {
                const id = step.slice(2);
                const question = questions.find((q) => q.id === id);
                if (!question) return null;
                const current = answers[id] ?? [];
                const toggle = (optionId: string) => {
                  setAnswers((prev) => {
                    const existing = prev[id] ?? [];
                    if (question.type === "single") return { ...prev, [id]: [optionId] };
                    return {
                      ...prev,
                      [id]: existing.includes(optionId)
                        ? existing.filter((o) => o !== optionId)
                        : [...existing, optionId],
                    };
                  });
                };
                return (
                  <div>
                    <p className="eyebrow">About {businessLabel}</p>
                    <h1 className="display mt-4 text-3xl sm:text-4xl">{question.question}</h1>
                    {question.help && <p className="mt-3 text-sm text-muted-foreground">{question.help}</p>}
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {question.options.map((option) => (
                        <Choice
                          key={option.id}
                          label={option.label}
                          selected={current.includes(option.id)}
                          onClick={() => toggle(option.id)}
                        />
                      ))}
                    </div>
                    <StepActions
                      onBack={goBack}
                      disabled={current.length === 0}
                      onNext={async () => {
                        await persist({ answers });
                        goNext();
                      }}
                    />
                  </div>
                );
              })()}

            {step === "scenario" && (
              <div>
                <p className="eyebrow">One last picture</p>
                <h1 className="display mt-4 text-3xl sm:text-4xl">
                  {classification?.scenario ??
                    `Imagine someone in ${city || "your area"} searches tonight for what ${businessLabel} does.`}
                </h1>
                <p className="mt-5 text-muted-foreground">
                  They find {businessLabel}. Everything we recommend next exists to make that moment end well.
                </p>
                <StepActions onBack={goBack} onNext={goNext} nextLabel="Show me my business system" />
              </div>
            )}

            {step === "finishing" && (
              <div className="flex flex-col items-center py-16 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="mt-6 text-lg">Designing the system for {businessLabel}…</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function TwoCars({
  businessLabel,
  onNext,
  onBack,
}: {
  businessLabel: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [started, setStarted] = useState(false);

  return (
    <div>
      <p className="eyebrow">Before we go further</p>
      <h1 className="display mt-4 text-3xl sm:text-4xl">They look identical.</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          { label: "Car A", note: started ? "Nothing happens. There's no engine." : "Beautiful exterior." },
          { label: "Car B", note: started ? "The engine starts. It moves." : "Beautiful exterior." },
        ].map((car, index) => (
          <div key={car.label} className="surface overflow-hidden">
            <div className="relative h-32 bg-ink">
              <motion.div
                className="absolute bottom-6 h-10 w-24 rounded-[0.6rem_1.4rem_0.4rem_0.4rem] bg-accent"
                initial={{ x: 24 }}
                animate={started && index === 1 ? { x: 190 } : { x: 24 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              />
              <div className="absolute bottom-5 left-0 right-0 h-px bg-ink-foreground/20" />
            </div>
            <div className="p-5">
              <p className="eyebrow">{car.label}</p>
              <p className="mt-2 text-[15px]">{car.note}</p>
            </div>
          </div>
        ))}
      </div>

      {!started ? (
        <div className="mt-8">
          <PrimaryButton onClick={() => setStarted(true)}>Turn the key</PrimaryButton>
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-lg">A website can be exactly the same.</p>
          <p className="mt-2 text-muted-foreground">
            Beautiful on the outside, completely different underneath. It can simply tell people who you are — or it
            can become part of how {businessLabel} attracts, converts and serves customers.
          </p>
        </div>
      )}

      <StepActions onBack={onBack} onNext={onNext} disabled={!started} nextLabel="Show me what mine could do" />
    </div>
  );
}

function TextStep({
  eyebrow,
  title,
  value,
  onChange,
  placeholder,
  onSubmit,
  onBack,
}: {
  eyebrow: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit: () => void | Promise<void>;
  onBack?: (() => void) | undefined;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) void onSubmit();
      }}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display mt-4 text-3xl sm:text-4xl">{title}</h1>
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={160}
        className="mt-8 w-full border-b border-input bg-transparent pb-3 text-2xl outline-none transition focus:border-ring"
      />
      <StepActions onBack={onBack} disabled={!value.trim()} onNext={() => void onSubmit()} />
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none ring-ring/30 transition focus:border-ring focus:ring-4"
      />
    </label>
  );
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left text-[15px] transition ${
        selected
          ? "border-primary bg-primary-soft text-foreground"
          : "border-border bg-card hover:border-ring/50"
      }`}
    >
      {label}
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

function StepActions({
  onNext,
  onBack,
  disabled,
  nextLabel = "Continue",
  busy,
}: {
  onNext: () => void | Promise<void>;
  onBack?: (() => void) | undefined;
  disabled?: boolean | undefined;
  nextLabel?: string | undefined;
  busy?: boolean | undefined;
}) {
  return (
    <div className="mt-10 flex items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void onNext()}
        className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-base transition hover:bg-secondary"
    >
      {children}
    </button>
  );
}
