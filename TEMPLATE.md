# Lesson template

Every Control Lab lesson follows this structure. Don't skip sections — if a section feels empty, the lesson probably needs more thought.

## Frontmatter

```yaml
---
track: summer | fall | supplemental-s1 | supplemental-s2 | supplemental-s3 | supplemental-s4 | supplemental-s5
lesson: 3                              # integer, position in track
title: Short, concrete title
duration: 25 min
prereqs: [summer-02]                   # slugs of required prior lessons
objectives:
  - Verb-first outcome students can demonstrate
  - One more
  - One more (3–5 total)
contributedBy: FRC 498                 # your team
---
```

## Body sections, in order

### Hook (1–2 paragraphs)
A concrete robot scenario that creates the question this lesson answers. No jargon. Make them want to know.

### Core idea
The single most important concept, in plain language. One paragraph, in a blockquote. This is what they should still remember in three months.

### Walk-through
The concept in detail. Diagrams, examples, analogies. Code only if it serves the idea — not as the point.

### Interactive demo
Embed a React component from `src/components/demos/`. Tell students *exactly what to observe*, in numbered steps.

### Try it yourself
A small exercise with a verifiable answer. Predict-then-check, tune-to-target, or read-this-log-and-explain.

### What just happened
3–5 bullet takeaways. Mirrors the objectives.

### Common confusions
Anticipated misunderstandings, addressed directly. Format: "You might think X — actually Y, because Z." This is where you bake in your hard-won knowledge of where students get stuck.

### What's next
One sentence pointing to the next lesson.

## Style guidelines

- **~500–800 words per lesson.** Long enough to be substantive, short enough to read in a sitting.
- **Code uses 498 conventions** — units in variable names, constants in `Constants.java`, etc.
- **No "easy" or "simple"** — these words shame students who find it hard. Just say what it is.
- **Show before naming.** Let students see a problem before you give it a name.
- **Every lesson produces something** — a tuned sim, a working trace, a correct prediction, a written explanation.
