import { defineCollection, z } from 'astro:content';

const lessons = defineCollection({
  type: 'content',
  schema: z.object({
    track: z.enum([
      'summer',
      'fall',
      'supplemental-s1', // swerve
      'supplemental-s2', // vision
      'supplemental-s3', // auto
      'supplemental-s4', // advanced control
      'supplemental-s5', // tooling
    ]),
    lesson: z.number().int().positive(),
    title: z.string(),
    duration: z.string(), // e.g. "20 min"
    prereqs: z.array(z.string()).default([]),
    objectives: z.array(z.string()).min(1).max(6),
    draft: z.boolean().default(false),
    contributedBy: z.string().default('FRC 498'),
  }),
});

export const collections = { lessons };
