# Lesson template

Every lesson must have an interactive demo AND an interactive try-it exercise — no static-only sections. Use `CodeTrace` and `Quiz` as the default building blocks. Build a custom React demo in `src/components/demos/` when you need physics/simulation.

## Frontmatter

```yaml
---
track: fundamentals | robot-code | motion-control | sensing-vision | autonomy | swerve | tooling
lesson: 3
title: Short, concrete title
prereqs: [fundamentals-02]   # lesson slugs; omit if none
objectives:
  - Verb-first outcome students can demonstrate
  - 3–5 total
contributedBy: FRC 498
---
```

## Standard imports (add only what you use)

```mdx
import Key    from '../../../components/Key.astro';
import Try    from '../../../components/Try.astro';
import Note   from '../../../components/Note.astro';
import Warn   from '../../../components/Warn.astro';
import Reveal from '../../../components/Reveal.astro';
import CodeTrace from '../../../components/demos/CodeTrace.jsx';
import Quiz      from '../../../components/demos/Quiz.jsx';
```

---

## Sections (in order)

### Hook
1–2 paragraphs. A concrete robot scenario that creates the question this lesson answers. No jargon.

### Core concept
Wrap the key idea in `<Key>`. One or two sentences — what they should still remember in three months.

```mdx
<Key>
A program is a sequence of instructions, executed in order, by something
that does exactly what you say — no more, no less.
</Key>
```

### Walk-through
The concept in detail: examples, analogies, code. Use `<Note>` for side context, `<Warn>` for common pitfalls.

Consider dropping a `<CodeTrace>` here to make the walk-through interactive rather than just prose.

### Interactive demo *(must be interactive)*
Use `<CodeTrace>` for step-through logic, or a custom `.jsx` component for physics/simulation. Always tell students exactly what to observe.

**`CodeTrace` — step through code with live variable state:**
```mdx
<CodeTrace
  client:load
  variables={{ angle: 0, motor: "off" }}
  steps={[
    { code: "angle = sensor.read()",      state: { angle: 45, motor: "off" }, comment: "read hw" },
    { code: "if angle < 90 → motor UP",   state: { angle: 45, motor: "up"  }, comment: "true"    },
    { code: "→ loop back to step 1",      state: { angle: 47, motor: "up"  }, comment: "loop!"   },
  ]}
/>
```

- `variables` — initial state shown before the first step
- `steps[].code` — the line of code or pseudocode
- `steps[].state` — variable values *after* this step executes
- `steps[].comment` — optional inline annotation (optional)

### Try it yourself *(must be interactive)*
Wrap the prompt in `<Try>`, then follow with a `<CodeTrace>` and/or `<Quiz>`.

**Pattern A — predict a value:**
```mdx
<Try>
Trace this by hand. What is `x` after the last line?

```
x = 10
x = x * 2
x = x - 5
```
</Try>

<CodeTrace
  client:load
  variables={{ x: 10 }}
  steps={[
    { code: "x = 10",     state: { x: 10 } },
    { code: "x = x * 2", state: { x: 20 } },
    { code: "x = x - 5", state: { x: 15 } },
  ]}
/>

<Quiz
  client:load
  question="What is `x` after the last line?"
  type="number"
  correct={15}
  explanation="10 × 2 = 20, then 20 − 5 = 15."
/>
```

**Pattern B — multiple choice:**
```mdx
<Quiz
  client:load
  question="Why does the arm overshoot 90°?"
  options={[
    "The motor is too powerful",
    "The program checks the condition only once and never loops",
    "The sensor is reading wrong",
    "The threshold value is incorrect",
  ]}
  correct={1}
  explanation="Without a loop the program runs once and stops checking. Robot programs must run continuously."
/>
```

**`Quiz` props:**
- `question` — string (backtick code renders as inline code)
- `type` — `"number"` | `"text"` | omit for multiple choice
- `correct` — number/string for text input, or index (0-based) for multiple choice
- `options` — array of strings (multiple choice only)
- `explanation` — shown after answering

### Key takeaways
3–5 bullets mirroring the objectives. Plain markdown list.

### Common confusions
Anticipated misunderstandings. Format: "You might think X — actually Y, because Z."

### What's next
One sentence naming the next lesson.

---

## Style rules

- **~500–800 words** of prose. Interactive components are additive, not a substitute for explanation.
- **No "easy" or "simple"** — these shame students who find it hard.
- **Show before naming** — let students see the problem before giving it a label.
- **Every lesson produces something** — a correct prediction, a tuned sim, a written explanation.
- **Code uses 498 conventions** — units in variable names, constants in `Constants.java`.
