import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Compass, FileText, MessageSquareText, Sparkles } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { PILLARS } from "@/lib/diagnostic-content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Satphonix Business Builder — What should your website do for your business?" },
      {
        name: "description",
        content:
          "Tell us about your business and Satphonix will show you what your website needs to attract customers, generate enquiries and help you grow. Takes 3–5 minutes.",
      },
      { property: "og:title", content: "What should your website do for your business?" },
      {
        property: "og:description",
        content:
          "A personalised digital business diagnostic from Satphonix. No technical knowledge required.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
          <p className="eyebrow">Satphonix Business Development</p>
          <h1 className="display mt-5 max-w-4xl text-[2.6rem] sm:text-6xl lg:text-7xl">
            What should your website do for your business?
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Tell us about your business. We'll show you what your website needs to attract customers, generate
            enquiries and help you grow.
          </p>

          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              to="/build"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-medium text-primary-foreground shadow-elevated transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Build my website
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="text-sm text-muted-foreground">
              No technical knowledge required · Takes about 3–5 minutes
            </p>
          </div>

          <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <div key={pillar.key} className="bg-card p-7">
                <p className="eyebrow text-accent">{pillar.name}</p>
                <p className="mt-3 text-[17px] leading-snug">{pillar.promise}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pillar.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <h2 className="display max-w-2xl text-3xl sm:text-4xl">
              Most websites look fine. Far fewer actually do anything.
            </h2>
            <p className="mt-5 max-w-2xl text-muted-foreground">
              Two businesses can have websites that look identical. One simply tells people who you are. The other
              becomes part of how your business attracts, converts and serves customers. The difference is never
              visible from the outside.
            </p>
            <Link
              to="/build"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Show me what mine could do
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="eyebrow">How it works</p>
          <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MessageSquareText, title: "Describe your business", body: "In your own words. No jargon, no forms full of technical questions." },
              { icon: Compass, title: "Answer a short interview", body: "We ask about customers, goals and what happens after someone contacts you." },
              { icon: Sparkles, title: "See your business system", body: "A personalised map of what your business actually needs — and what it doesn't." },
              { icon: FileText, title: "See a real price", body: "An understandable investment in your currency, with nothing hidden." },
            ].map((step, index) => (
              <div key={step.title}>
                <step.icon className="h-5 w-5 text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">0{index + 1}</p>
                <h3 className="mt-1 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-24">
          <div className="surface flex flex-col gap-6 p-9 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="display text-3xl">Let's see what your business could become.</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                A professional consultation, not a sales funnel. Leave whenever you like — your answers are saved.
              </p>
            </div>
            <Link
              to="/build"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-medium text-primary-foreground"
            >
              Start
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
