# Control Lab — FRC 498

Programming and control systems curriculum for FRC, Java + AdvantageKit. Built by FRC 498, open for any team to fork and contribute.

## Getting started

```bash
npm install
npm run dev
```

## Project structure

```
src/
  content/
    config.ts                    # lesson schema (enforces template)
    lessons/
      summer/                    # 16 foundation lessons
      fall/                      # 16 implementation lessons
      supplemental-s1/           # swerve drive
      supplemental-s2/           # vision and pose
      supplemental-s3/           # auto routines
      supplemental-s4/           # advanced control
      supplemental-s5/           # tooling and workflow
  components/
    demos/                       # interactive React demos used in lessons
  layouts/
    LessonLayout.astro           # consistent lesson chrome
  pages/
    lessons/[track]/[slug].astro # dynamic lesson route
```

## Adding a lesson

1. Create `src/content/lessons/<track>/<NN-slug>.mdx`.
2. Use the frontmatter schema enforced in `src/content/config.ts`.
3. Follow the [lesson template](./TEMPLATE.md): hook → core idea → walk-through → demo → exercise → recap → confusions → what's next.
4. If your lesson needs a custom interactive, add a React component in `src/components/demos/` and `import` it at the top of your MDX.
5. Open a PR. Two team members review before merge.

## Contributing as another team

We want this to be a community resource. Two ways:

- **Submit a lesson** to an existing track via PR. Set `contributedBy: "FRC ####"` in frontmatter and you'll be credited inline.
- **Propose a new supplemental track** by opening an issue first so we can discuss scope and prereqs.

## License

MIT.
