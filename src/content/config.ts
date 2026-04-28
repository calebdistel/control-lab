import { defineCollection, z } from 'astro:content';

const lessons = defineCollection({
  type: 'content',
  schema: z.object({
    track: z.enum([
      'frc-intro',           // what FRC is, hardware, development workflow
      'fundamentals',        // core programming concepts
      'robot-code',          // WPILib, subsystems, commands, actuators
      'control-systems',     // PID, feedforward, motion profiling, state space
      'software-engineering', // architecture patterns, testing, tooling
    ]),
    lesson: z.number().int().positive(),
    title: z.string(),
    prereqs: z.array(z.string()).default([]),
    objectives: z.array(z.string()).min(1).max(6),
    draft: z.boolean().default(false),
    contributedBy: z.string().default('FRC 498'),
  }),
});

export const collections = { lessons };
