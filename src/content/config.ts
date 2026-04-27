import { defineCollection, z } from 'astro:content';

const lessons = defineCollection({
  type: 'content',
  schema: z.object({
    track: z.enum([
      'fundamentals',    // core programming concepts
      'robot-code',      // WPILib, subsystems, commands
      'motion-control',  // PID, feedforward, profiling
      'sensing-vision',  // PhotonVision, pose estimation
      'autonomy',        // PathPlanner, auto routines
      'swerve',          // swerve kinematics & tuning
      'tooling',         // git, debugging, AdvantageScope
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
