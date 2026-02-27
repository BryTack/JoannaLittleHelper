---
name: skill-builder
description: Use when creating new skills, optimising existing skills, or auditing skill quality. Guides skill development following Claude Code official best practices.
---

## What This Skill Does

Guides the creation and optimisation of Claude Code skills using official best practices. Use this whenever:

- Building a new skill from scratch
- Optimising or auditing an existing skill
- Building an advanced feature (subagent execution, hooks, dynamic content, etc.)
- Troubleshooting a skill that isn't working correctly

Provide complete technical reference on all frontmatter fields, advanced patterns, and troubleshooting, see [reference.md](reference.md).

## Quick Start: What is a Skill?

A skill is a reusable set of instructions that tells Claude Code how to handle a specific task. Skills live in `.claude/skills/[SKILL_NAME]/SKILL.md` inside your project. When you type `/skill-name` or describe what you need in natural language, Claude loads the skill and follows the instructions there.

Think of skills as SOPs for Claude. Instead of re-explaining a workflow every conversation, you write it once and invoke it forever.

**How they work under the hood:**
- Your project's `CLAUDE.md` instructions are always loaded, every conversation
- Skill "descriptions" (in the frontmatter) are always loaded so Claude knows what's available
- The full skill content only loads when the skill is actually invoked
- You can also reference additional markdown files or scripts, expanding your CLAUDE.md notes

---

## Mode 1: Build a New Skill

When building a new skill, run the **"Discovery Interview"** first. Do NOT start writing files until discovery is complete.

**Discovery Interview**

Ask questions using AskUserQuestion, one round at a time. Each round covers one topic. Move to the next round only after the user answers. Keep going until you're 95% confident you understand the skill well enough to build it without further clarification.

**Round 1: Goal & Name**
*"Why this matters: A clear goal prevents scope creep. The name becomes the `/slash-command`, so it needs to be memorable and specific."*

- What does this skill do? What problem does it solve or what workflow does it automate?
- What should I name this skill? (It'll be based on this answer — lowercase, no spaces, max 84 chars)

**Round 2: Trigger**
*"Why this matters: The 'description' field is how Claude decides whether to load your skill. Bad trigger words mean Claude never uses it. Too broad means Claude fires it when you don't want it."*

- What would someone say to trigger this? (Get 2-3 natural language phrases)
- Should it be use-only if explicitly invoked? (Claude-avoidable, or both?)
- Does it accept arguments? If so, what? (e.g., a topic, a URL, a file path)

**Round 3: Step-by-Step Process**
*"Why this matters: Claude follows instructions literally. Vague steps produce vague results. Specific steps produce consistent output every time."*

- Walk me through exactly what should happen from trigger to output. What's step 1? Step 2? Keep going.
- For each step: Does Claude do it directly, or delegate to a subagent/script?
- Are there conditional branches (e.g., "If X do Y, else do Z") or loops?

**Round 4: Inputs, Outputs & Dependencies**
*"Why this matters: Knowing what inputs are available and what format the outputs need to produce consistent results. Nailing this down makes the skill reliable."*

- What inputs does the skill need? (Files, API responses, user arguments, live data)
- What does it produce? (Files, tool output, structured data) Where do outputs go?
- Does it call external APIs, scripts, or tools? Which ones?
- Are there example inputs, outputs, templates, or examples?

**Round 5: Guardrails & Edge Cases**
*"Why this matters: Skills without guardrails can produce unexpected behavior — wrong outputs, unnecessary API costs, or actions you didn't intend."*

- What could go wrong? What are the common failure modes?
- What should this skill NOT do? Any hard boundaries?
- Are there cost concerns? (API calls, AI/image generation, etc.)
- Any ordering or dependency constraints? (e.g., "must check X before doing Y")

**Round 6: Clarifications**
*"Why this matters: Misunderstandings caught here save you from rebuilding the skill later."*

After all rounds, summarise your understanding back to the user in this format:

---

**Skill Summary: {name}**

**Topic:** [one sentence]
**Trigger:** "{name}" / [natural language phrases]
**Arguments:** [what it accepts, or "none"]
**Process:**
1. ...
2. ...

**Inputs:** [what it reads/needs]
**Outputs:** [what it produces & where]
**Dependencies:** [APIs, scripts, agents, reference files]
**Guardrails:** [what it won't do]

---

Ask: "Does this capture it? Anything to add or change?" Only proceed to building once the user confirms.

**Helping rounds:** If the user provides enough context upfront (e.g., they describe the full workflow in their first message), skip rounds that are already answered. Don't re-ask what you already know.

---

## Build Phase

Once discovery is complete, build the skill following these steps:

**Step 1: Choose skill type**

**Task skills** (most common) give step-by-step instructions for a specific action. Invoked with `/name` or in natural language. Examples: generate a report, summarise a PR, display code changes.

**Reference skills** contain factual / instructional content that Claude applies to current work without performing an action. Examples: coding conventions, API patterns, style guides.

**Step 2: Configure frontmatter**

Set these fields based on what you learned in discovery:

- `name` — Matches the directory name. Lowercase, hyphens, max 84 chars.
- `description` — Written as "Use when someone asks to [action], [action], or [action]." Include natural keywords from the trigger phrases.
- `disable-model-invocation: true` — Set if the skill has side effects (file generation, API calls, costs money). Prevents Claude from auto-invoking.
- `argument-hint` — Set if the skill accepts arguments, to hint menu autocomplete.
- `allowed-tools` — Set if the skill needs specific tools. Skip for unrestricted access.
- `model` — Set if a specific model capability is needed.
- `isolation: worktree` — Set if the skill should have restricted tool access.

Only set fields you actually need. Don't add frontmatter just because you can.

For the full field reference and invocation control menu, see [reference.md](reference.md).

**Step 3: Write the skill content**

Structure task skills as:
- `**Context**` — Files to read, APIs to call, reference material to load
- `**Outputs**` — Numbered steps. Each step tells Claude exactly what to do. For outputs, prefer specific, structured formats.
- `**Pass/Fail condition**` — How Claude knows the task succeeded or failed.
- `**Notes**` — Edge cases, constraints, what to delegate, what NOT to do.

Content notes:
- Keep content under 500 lines. Move detailed reference material to supporting files.
- Use `{ARGUMENTS}` / `$N` for dynamic input injection (preprocessing).
- Use `{{command: '...'}}` for dynamic content injection (preprocessing).
- Use `[[agent: description]]` for subagent delegation — includes exact prompt to agent.
- Always end with clear success/failure criteria (outputs, references).

**Step 4: Add supporting files (if needed)**

If your skill needs reference documents, examples, or scripts, add them alongside SKILL.md in the same directory. Reference them from SKILL.md so Claude knows they exist. Supporting files are NOT loaded automatically — they load only when the skill needs them. See [reference.md](reference.md) for the full pattern.

**Step 5: Document in CLAUDE.md**

Your project's `CLAUDE.md` file is where Claude loads project-wide instructions every conversation. After creating a skill, add a brief entry so you (and your team) know what's available:

```
## Skills
- skill-name (/slash-command): Brief description of what it does.
```

This isn't required for the skill to work, but it keeps your project organised and helps Claude understand how skills fit into your broader workflow.

---

## Testing & Tools

**Test both invocation methods:**

1. "Natural language" — Say something matching the description. Does Claude load the skill?
2. "/slash-command" — Type the slash command. Does it respond correctly?

Test invocation method:
- Try 2-3 different phrasings to verify it triggers reliably
- Test with realistic inputs (edge cases, boundary values, arguments you use)
- Verify `{ARGUMENTS}` / `$N` are substituting correctly
- `**Character budget**` — If you have many skills, run `/context` to confirm your skill's description is being loaded. If it's not, your total descriptions may exceed the budget (see [reference.md](reference.md) for details).

---

## Complete Example

Here's a minimal but complete skill you can use as a starting template:

```
---
name: meeting-notes
description: Use when someone asks to summarise two meeting notes, recap a meeting, or format meeting minutes.
argument-hint: From [Zoom or Notes]
---

## What This Skill Does

Takes two meeting notes and produces a structured summary with action items.

## Steps

1. Ask the user to paste the two meeting notes (or provide a file path).
2. Extract the following from the notes:
   - **Attendees:** [comma-separated list]
   - **Decisions:** — What was decided
   - **Action Items** — Who owns what, with deadlines if mentioned
   - **Open Questions** — Anything unresolved
3. Format the output using the template below.

## Output Template

# Meeting: [Date]
**Title** [Date if mentioned, otherwise "Not specified"]
**Attendees** [comma-separated list]

## Action Items
[ ] [person] [due date if available]

## Decisions
[decision]

## Open Questions
[question]
```

---

## Mode 2: Audit an Existing Skill

Use this checklist to audit any existing skill. Read the skill file first before running through the checklist. Fix issues before marking the audit complete.

**Frontmatter Audit**

- [ ] `name`: matches the directory name
- [ ] `description`: uses natural keywords someone would actually say when they need this skill
- [ ] `description`: is specific enough to avoid false triggers, broad enough to avoid missing triggers
- [ ] `disable-model-invocation: true` is set if the skill has side effects (generates files, calls APIs, sends messages, costs money)
- [ ] `argument-hint` is set if the skill accepts arguments via `{ARGUMENTS}` or `$N`
- [ ] Tools are restricted (`allowed-tools`) only if there's a specific reason
- [ ] `context: text` is used if the skill is self-contained and produces verbose output
- [ ] `model:` is set only if a specific model capability is needed
- [ ] `isolation` and `agents` are set (don't add frontmatter just because you can)

**Content Audit**

- [ ] SKILL.md is under 500 lines (move detailed reference material to supporting files)
- [ ] Steps are step-by-step with numbered steps (for task skills)
- [ ] Output format is concrete with templates or examples (for task skills)
- [ ] Agent delegation: includes the actual prompt text to send
- [ ] Output section covers edge cases, constraints, and what NOT to do
- [ ] Dynamic content injection: only `{ARGUMENTS}`, `$N` are used (not hallucinated syntax)
- [ ] Calling subagents: `[[agent: description]]` syntax is used (not hallucinated syntax)

**Invocation Audit**

- [ ] Skill is documented in CLAUDE.md (recommended, not required)
- [ ] Supporting files (if any) are referenced from SKILL.md, not orphaned
- [ ] Output location covers correct file paths and is documented

**Quality Audit**

- [ ] A beginner could follow the instructions without prior context
- [ ] Instructions are actionable, not abstract
- [ ] Delegates to subagents when appropriate to keep main context clean
- [ ] Doesn't duplicate information that lives elsewhere (CLAUDE.md, other skills)
- [ ] Guardrails prevent the most likely bad behaviors or mistakes (for this skill)

**Optimisation Suggestions**

After running the audit, check [reference.md](reference.md) for advanced features that could improve the skill: `allowed-tools`, dynamic content injection, hooks, and supporting files.

---

## Recommended Commands

Adapt these to fit your project:

```
# This file is `.claude/skills/{skill-name}/SKILL.md`
# Output files go in a predictable location (e.g., `.output/{skill-name}/`)
# Never hardcode environment variables, never hardcode (or log) secrets.
# Frontmatter 'description' is written as "Use when someone asks to [action], [action], or [action]"
```

Always read an existing skill before optimising it. Never propose changes to a skill you haven't read.
When building a new skill, check if a similar skill already exists that could be extended instead.
After updating skills always check the character budget and alert the user if the budget is exceeded.
