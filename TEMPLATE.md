# Lesson template

Every Control Lab lesson follows this structure. Don't skip sections — if a section feels empty, the lesson probably needs more thought.

## Frontmatter

```yaml
---
track: fundamentals | robot-code | motion-control | sensing-vision | autonomy | swerve | tooling
lesson: 3                              # integer, position in track
title: Short, concrete title
prereqs: [fundamentals-02]             # slugs of required prior lessons (omit if none)
objectives:
  - Verb-first outcome students can demonstrate
  - One more
  - One more (3–5 total)
contributedBy: FRC 498                 # your name or team
---
```

## MDX imports

Add these at the top of the file, below the frontmatter, as needed:

```mdx
import Key from '../../../components/Key.astro';
import Try from '../../../components/Try.astro';
import Note from '../../../components/Note.astro';
import Warn from '../../../components/Warn.astro';
import Reveal from '../../../components/Reveal.astro';
```

## Body sections, in order

### Hook (1–2 paragraphs)
A concrete robot scenario that creates the question this lesson answers. No jargon. Make them want to know.

### Core concept
Wrap the single most important idea in a `<Key>` callout. One or two sentences. This is what they should still remember in three months.

```mdx
<Key>
A program is a sequence of instructions, executed in order, by something
that does exactly what you say — no more, no less.
</Key>
```

### Walk-through
The concept in detail. Diagrams, examples, analogies. Code only if it serves the idea — not as the point.

Use `<Note>` for supplementary context that shouldn't interrupt the main flow:
```mdx
<Note label="WPILib note">
In WPILib, this is handled automatically by the command scheduler.
</Note>
```

Use `<Warn>` for common pitfalls:
```mdx
<Warn>
Never call `driveSubsystem.stop()` from two different commands — only one
command should own a subsystem at a time.
</Warn>
```

### Interactive demo
Embed a React component from `src/components/demos/`. Tell students *exactly what to observe*, in numbered steps.

### Try it yourself
Wrap exercises in `<Try>`. Make the expected action concrete: predict a value, tune to a target, or explain a log output.

```mdx
<Try>
Trace this program by hand — write down the value of `angle` after each step
before checking.

```
angle = 0
Step A: angle = angle + 30
Step B: angle = angle + 30
Step C: angle = angle - 10
```
</Try>

<Reveal>
After step A: 30. After step B: 60. After step C: 50.
If you got 50, you just executed a program in your head.
</Reveal>
```

### Key takeaways
3–5 bullets mirroring the objectives. Use a regular markdown list — no component needed.

### Common confusions
Anticipated misunderstandings, addressed directly. Format: "You might think X — actually Y, because Z." This is where you bake in your hard-won knowledge of where students get stuck.

### What's next
One sentence pointing to the next lesson by name.

---

## Style guidelines

- **~500–800 words per lesson.** Long enough to be substantive, short enough to read in a sitting.
- **Code uses 498 conventions** — units in variable names, constants in `Constants.java`, etc.
- **No "easy" or "simple"** — these words shame students who find it hard. Just say what it is.
- **Show before naming.** Let students see a problem before you give it a name.
- **Every lesson produces something** — a tuned sim, a working trace, a correct prediction, a written explanation.
- **Prereqs** are lesson slugs like `fundamentals-02`, not display names.
