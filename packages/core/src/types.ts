export enum ConflictType {
  Soft = 'soft',
  Hard = 'hard'
}

export interface TaskContext {
  id: string
  description?: string
  // optional helpers used by the priority engine
  language?: string
  phase?: string
}

export interface NormalizedSkill {
  id: string
  name: string
  metadata?: {
    priority?: number
    // scoring helpers (relevance: 0..1, trust: 0..1, cost: numeric, lastUpdated: ISO)
    relevance?: number
    trust?: number
    cost?: number
    lastUpdated?: string | number
    languageCompatibility?: string[]
    phaseCompatibility?: string[]
    [key: string]: unknown
  }
}

export interface PriorityResult {
  skillId: string
  score: number
  rank: number
  explanation?: string
}

export interface ConflictReport {
  skillId: string
  conflictType: ConflictType
  details?: string
}
