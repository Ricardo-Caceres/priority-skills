export enum ConflictType {
  Soft = 'soft',
  Hard = 'hard'
}

export interface TaskContext {
  id: string
  description?: string
  // extensible context, keep minimal
}

export interface NormalizedSkill {
  id: string
  name: string
  metadata?: {
    priority?: number
    [key: string]: unknown
  }
}

export interface PriorityResult {
  skillId: string
  score: number
  rank: number
}

export interface ConflictReport {
  skillId: string
  conflictType: ConflictType
  details?: string
}
