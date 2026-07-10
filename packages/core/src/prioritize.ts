import { NormalizedSkill, PriorityResult } from './types'

// Minimal deterministic scoring: use metadata.priority then fallback to id length
export function prioritizeSkills(skills: NormalizedSkill[]): PriorityResult[] {
  const scored = skills.map((s) => {
    const base = typeof s.metadata?.priority === 'number' ? s.metadata!.priority : 0
    const score = base + s.id.length * 0.01 // deterministic tie-breaker
    return { skillId: s.id, score }
  })
  scored.sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId))
  return scored.map((s, idx) => ({ ...s, rank: idx + 1 }))
}
