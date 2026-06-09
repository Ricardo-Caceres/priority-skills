import { z } from 'zod'

export const TaskContextSchema = z.object({
  id: z.string(),
  description: z.string().optional()
}).passthrough()

export const NormalizedSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  metadata: z.object({
    priority: z.number().optional()
  }).passthrough().optional()
}).strict()

export const ConflictReportSchema = z.object({
  skillId: z.string(),
  conflictType: z.enum(['soft', 'hard']),
  details: z.string().optional()
}).strict()

export const validators = {
  taskContext: TaskContextSchema,
  normalizedSkill: NormalizedSkillSchema,
  conflictReport: ConflictReportSchema
}
