import { BookOpen, ChevronRight } from "lucide-react";

/**
 * Expandable "Writing a PRD" guide, shown next to a PRD field on the request
 * form (and on the request detail for reference). Collapsed by default with
 * native <details> so it never gets in the way of someone who already knows.
 */
export function PrdGuide() {
  return (
    <details className="group rounded-md border bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        Writing a PRD — a guide for your first one
      </summary>

      <div className="space-y-6 border-t px-4 py-4 text-sm leading-relaxed">
        <p className="text-muted-foreground">
          For someone who has never written a product requirements document
          before.
        </p>

        <Section n="1" title="What a PRD actually is">
          <p>
            A PRD is a written answer to one question:{" "}
            <strong>
              what are we building, for whom, and how will we know it worked?
            </strong>
          </p>
          <p>
            That&apos;s it. It is not a design document, not a project plan, and
            not a spec that tells engineers how to implement something. It
            describes the problem and the required outcome with enough precision
            that a designer, an engineer, and a compliance reviewer can each read
            it and arrive at the same understanding.
          </p>
          <Aside>
            The most useful mental test: if you got hit by a bus tomorrow, could
            someone build the right thing from this document alone?
          </Aside>
          <p className="font-medium">What a PRD is not</p>
          <ul className="space-y-1.5">
            <NotItem label="A technical design doc">
              The <em>how</em> belongs to engineering. You define constraints,
              not architecture.
            </NotItem>
            <NotItem label="A wish list">
              Everything in a PRD is committed scope. Ideas go in
              &ldquo;Out of scope&rdquo; or a backlog.
            </NotItem>
            <NotItem label="A one-time artefact">
              It changes as you learn. A PRD nobody edited during the build was
              probably ignored.
            </NotItem>
            <NotItem label="A substitute for conversation">
              It&apos;s a record of decisions made with people, not a way to
              avoid making them.
            </NotItem>
          </ul>
        </Section>

        <Section n="2" title="When to write one (and when not to)">
          <p>Write a PRD when at least two of these are true:</p>
          <Bullets
            items={[
              "More than one person will build it",
              "It touches more than one system or team",
              "It changes something a customer or regulator can see",
              "Getting it wrong is expensive or hard to reverse",
              "There's genuine disagreement about what “done” looks like",
            ]}
          />
          <p>
            Don&apos;t write one for a bug fix, a copy change, a config toggle,
            or a two-hour task — write a ticket instead. A PRD for a small change
            costs more than the change does, and it teaches your team that PRDs
            are bureaucracy.
          </p>
          <Aside>
            Rough guide: under a week of work → ticket. Over a sprint, or crosses
            a team boundary → PRD.
          </Aside>
        </Section>

        <Section n="3" title="Before you write a word">
          <p>
            First-time product people almost always start typing too early. The
            writing is the last 20% of the work. Do this first:
          </p>
          <ul className="space-y-2">
            <NotItem label="Talk to the people who feel the problem">
              Not a survey — actual conversations. Three to five is usually
              enough to spot a pattern. Ask what they do today and what it costs
              them, not what they want you to build. People are excellent at
              describing pain and unreliable at specifying solutions.
            </NotItem>
            <NotItem label="Find the evidence">
              Support tickets, ops complaints, drop-off in a flow, manual work
              someone does every week, a regulatory obligation with a date on it.
              If you cannot point to evidence, you have a hunch. Hunches are
              allowed, but say so in the document.
            </NotItem>
            <NotItem label="Understand the current state properly">
              Draw the flow as it exists today, including the ugly manual parts.
              Half of all product mistakes come from not knowing what already
              happens.
            </NotItem>
            <NotItem label="Find your constraints early">
              Regulatory obligations, existing integrations, security
              requirements, things another team is mid-way through changing.
              Constraints discovered late are the main cause of rewrites.
            </NotItem>
            <NotItem label="Get a rough sense of cost">
              Ask an engineer &ldquo;if we did roughly this, is it days, weeks,
              or months?&rdquo; before you scope it. This single question will
              save you from writing beautiful documents for things that will
              never be prioritised.
            </NotItem>
          </ul>
        </Section>

        <Section n="4" title="The template">
          <p className="text-muted-foreground">
            Use <strong>Insert starter outline</strong> above to drop this
            straight into the field, then replace the guidance as you go.
          </p>
          <ul className="space-y-2">
            <NotItem label="Title">
              Plain description of the change. &ldquo;Automated retry for failed
              fund movements&rdquo;, not &ldquo;Project Falcon&rdquo;. Plus
              owner, reviewers named by function (engineering, design,
              compliance, ops), status, and last-updated.
            </NotItem>
            <NotItem label="1. Summary">
              Three to five sentences: the problem, what you&apos;re doing about
              it, and what changes as a result. Someone should be able to read
              only this and know whether the rest is relevant to them. Write it
              last.
            </NotItem>
            <NotItem label="2. Problem">
              Who is hurting, how much, and how you know — include the evidence.
              Describe today&apos;s workflow including the manual workarounds.
              The test: a reader who disagrees with your solution should still
              agree the problem is real.
            </NotItem>
            <NotItem label="3. Why now">
              What makes this the right thing to do this quarter rather than next
              year. If there&apos;s no answer here, that&apos;s useful
              information.
            </NotItem>
            <NotItem label="4. Goals and non-goals">
              Goals: 2–4 outcomes in outcome language —
              &ldquo;Operations no longer manually re-submit failed
              payments&rdquo;, not &ldquo;build a retry button&rdquo;. Non-goals:
              the adjacent things you are deliberately not doing. This section
              prevents more scope creep than any other.
            </NotItem>
            <NotItem label="5. Users and use cases">
              Who this is for, by role and situation. Internal ops teams and
              admins count as users — and their needs are usually the ones that
              get forgotten. Write the main paths as user stories.
            </NotItem>
            <NotItem label="6. Requirements">
              The core of the document. Number them so people can reference them
              in review. Split into <em>must have</em>, <em>should have</em>, and{" "}
              <em>won&apos;t have (this time)</em>. Write each so it can be
              tested: &ldquo;the system must be fast&rdquo; cannot be;
              &ldquo;retry must complete within 30 seconds, or return a failure
              state&rdquo; can.
            </NotItem>
            <NotItem label="7. Out of scope">
              Work you&apos;re not doing now, and why — different from non-goals,
              which are outcomes you&apos;re not chasing.
            </NotItem>
            <NotItem label="8. Dependencies and risks">
              What has to be true for this to work. For each risk: what could go
              wrong, how likely, what you&apos;d do about it. Risks
              you&apos;ve named are manageable; risks you&apos;ve hidden are not.
            </NotItem>
            <NotItem label="9. Success metrics">
              What you measure, where the number comes from (name the dashboard
              or query — &ldquo;we&apos;ll track it&rdquo; is how metrics quietly
              disappear), today&apos;s baseline, and what good looks like.
              Include at least one <strong>guardrail</strong> metric — the thing
              that must not get worse.
            </NotItem>
            <NotItem label="10. Rollout">
              Feature flag (name it), who gets it first, how you&apos;d turn it
              off, any migration and what happens on rollback, and whether users
              need telling.
            </NotItem>
            <NotItem label="11. Open questions">
              Everything unresolved, with a name and a date against each. This is
              a sign of a healthy document, not a weak one.
            </NotItem>
          </ul>
          <Aside>
            Cover the unglamorous cases — failures, timeouts, partial states,
            empty and first-run states, permissions, limits, what gets logged for
            an auditor, and what happens to work already in flight. That&apos;s
            where the real work hides.
          </Aside>
        </Section>

        <Section n="5" title="A short worked example">
          <p className="font-medium">
            Manual retry for failed fund-movement steps
          </p>
          <p>
            <span className="font-medium">Summary.</span> When an automated fund
            movement fails partway through, operations currently cancel and
            rebuild the whole transaction by hand. This adds delay and creates a
            re-keying risk on amounts and addresses. We&apos;ll let an authorised
            operator retry the specific failed step, with the original
            transaction data preserved and every retry logged.
          </p>
          <p>
            <span className="font-medium">Problem.</span> Fund movements run as a
            sequence of steps. When one fails — a provider timeout, a signing
            service that didn&apos;t respond — the whole movement stalls. There
            is no way to resume, so ops cancel it and re-enter everything
            manually. Last quarter this happened around 40 times; each takes
            20–30 minutes and requires re-typing the destination details. Two
            near-miss incidents came from that re-keying. Clients see delays of
            hours on transfers that should settle in minutes.
          </p>
          <p>
            <span className="font-medium">Goals.</span> A stalled movement can be
            resumed without re-entry; no new path exists to alter amount or
            destination during a retry; every retry is attributable to a named
            operator in the audit trail.
          </p>
          <p>
            <span className="font-medium">Non-goals.</span> Automatic retries
            without a human in the loop — a follow-on, and only once we
            understand the failure modes. Changes to how failures are detected.
          </p>
          <p className="font-medium">Requirements (must have).</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              R1. A failed step displays a Retry action to users with the
              fund-movement operator permission.
            </li>
            <li>
              R2. Retry re-executes only the failed step, using the originally
              submitted parameters. Amount, destination, and asset are not
              editable at any point in the retry flow.
            </li>
            <li>
              R3. Where the provider cannot guarantee idempotency, the system
              must confirm the step&apos;s true state with the provider before
              retrying, and block the retry if the state is ambiguous.
            </li>
            <li>
              R4. Each retry writes an audit entry: operator, timestamp, step,
              outcome, provider reference.
            </li>
            <li>
              R5. A maximum of three retries per step; beyond that the movement
              must be escalated rather than retried.
            </li>
          </ul>
          <p>
            <span className="font-medium">Requirements (should have).</span> R6.
            The failure reason is shown in plain language alongside the Retry
            action.
          </p>
          <p>
            <span className="font-medium">Risks.</span> R3 is the one to watch —
            a double-send caused by retrying a step that actually succeeded is
            far worse than the manual process we&apos;re replacing. This needs a
            provider-by-provider assessment before build, not during.
          </p>
          <p>
            <span className="font-medium">Success metrics.</span> Median time to
            resolve a stalled movement, from ~25 minutes to under 5 (source: ops
            timing log). Re-keying incidents to zero (source: incident register).
            Guardrail: zero duplicate settlements attributable to retry.
          </p>
          <p>
            <span className="font-medium">Open questions.</span> Does retry
            authority need a second approver above a certain value? — Compliance,
            by the 12th.
          </p>
          <Aside>
            Notice how much of that is about failure, permissions, and limits,
            and how little is about the button. That ratio is roughly right.
          </Aside>
        </Section>

        <Section n="6" title="From PRD to tickets">
          <p>
            The PRD is the shared understanding; tickets are the units of work.
            One PRD usually becomes five to fifteen tickets. Each should be
            independently buildable and testable, carrying a user story, a
            description, a definition of done, whether a permissions change is
            required, whether it sits behind a feature flag (and the flag&apos;s
            name), success metrics, and a testing plan. If the PRD is written
            well you&apos;re transcribing, not inventing.
          </p>
          <p>
            If you can&apos;t fill in a ticket&apos;s definition of done,
            that&apos;s a gap in the PRD, not the ticket. Fix it there so
            everyone gets the fix.
          </p>
        </Section>

        <Section n="7" title="The mistakes almost everyone makes first time">
          <ul className="space-y-2">
            <NotItem label="Specifying the solution instead of the problem">
              You arrive with a design in your head and write it up as
              requirements. Engineers then build exactly the thing you imagined,
              including its flaws, because you never gave them the problem to
              solve.
            </NotItem>
            <NotItem label="Only writing the happy path">
              The happy path is maybe 20% of the work. Failures, partial states,
              permissions, and limits are the rest. If your PRD is short, this is
              almost certainly why.
            </NotItem>
            <NotItem label="Vague requirements">
              &ldquo;Fast&rdquo;, &ldquo;secure&rdquo;, &ldquo;intuitive&rdquo;,
              &ldquo;robust&rdquo;. None can be built or tested. Every
              requirement needs a number, a condition, or an observable
              behaviour.
            </NotItem>
            <NotItem label="Skipping the reviewers who'd object">
              The compliance reviewer who blocks you in week one saved you three
              weeks. Send it to them first, not last.
            </NotItem>
            <NotItem label="Writing it alone">
              A PRD written in isolation and presented as finished gets edited
              politely and ignored genuinely. Share the draft while it&apos;s
              messy.
            </NotItem>
            <NotItem label="Metrics with no source">
              &ldquo;We&apos;ll measure adoption&rdquo; without naming where the
              number comes from means nobody measures anything.
            </NotItem>
            <NotItem label="Never closing the loop">
              Six weeks after shipping, write down what the metrics actually did.
              This single habit separates people who get better at product from
              people who just ship things.
            </NotItem>
          </ul>
        </Section>

        <Section n="8" title="Before you send it out">
          <ul className="space-y-1">
            {[
              "Someone unfamiliar with the area can read the summary and understand what's being built",
              "The problem is supported by evidence, not assertion",
              "Every requirement is numbered and testable",
              "Failure states, permissions, and limits are all covered",
              "Non-goals and out-of-scope are explicit",
              "Success metrics name their source and a baseline",
              "There's at least one guardrail metric",
              "Every open question has a name and a date on it",
              "Engineering has seen it before it's called final",
              "Anyone whose sign-off you need is on the reviewer list",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-[3px] border"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section n="9" title="One last thing">
          <p>
            The document is not the point. The thinking is the point, and the
            shared understanding is the point. A rough PRD that three people
            argued over is worth more than a polished one nobody read.
          </p>
          <p>
            The way to get good at this is to write one, ship it, then reread it
            afterwards and notice what you didn&apos;t know when you wrote it.
            That gap is the whole education.
          </p>
        </Section>
      </div>
    </details>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">
        <span className="mr-1.5 text-muted-foreground">{n}.</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border-l-2 border-primary/40 bg-background/60 px-3 py-2 text-muted-foreground">
      {children}
    </p>
  );
}

function NotItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <span className="font-medium">{label}.</span>{" "}
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="ml-4 list-disc space-y-1">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
