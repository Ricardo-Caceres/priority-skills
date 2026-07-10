import { z } from 'zod'

export const TaskContextSchema = z.object({
  id: z.string(),
  description: z.string().optional()
}).passthrough()

export const NormalizedSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.string().optional(),
  metadata: z.object({
    priority: z.number().optional(),
    relevance: z.number().min(0).max(1).optional(),
    trust: z.number().min(0).max(1).optional(),
    cost: z.number().optional(),
    lastUpdated: z.union([z.string(), z.number()]).optional(),
    capabilities: z.array(z.string()).optional(),
    languageCompatibility: z.array(z.string()).optional(),
    phaseCompatibility: z.array(z.string()).optional()
  }).passthrough().optional()
}).passthrough()

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
