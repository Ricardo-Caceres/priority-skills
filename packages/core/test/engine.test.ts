import { describe, it, expect } from 'vitest'
import { runPriorityEngine } from '../src/engine'
import { TaskContext, NormalizedSkill } from '../src/types'

describe('priority engine', () => {
  it('eligibility filter removes incompatible skills', () => {
    const ctx: TaskContext = { id: 't1', language: 'js' }
    const skills: NormalizedSkill[] = [
      { id: 's1', name: 'JS Skill', metadata: { languageCompatibility: ['js'] } },
      { id: 's2', name: 'Py Skill', metadata: { languageCompatibility: ['py'] } }
    ]
    const res = runPriorityEngine(ctx, skills, { topN: 10 })
    expect(res.map((r) => r.skillId)).toEqual(['s1'])
  })

  it('scoring is deterministic and reproducible', () => {
    const ctx: TaskContext = { id: 't2', language: 'js' }
    const baseDate = new Date('2024-01-01T00:00:00.000Z').toISOString()
    const skills: NormalizedSkill[] = [
      { id: 'a', name: 'A', metadata: { relevance: 0.9, trust: 0.8, cost: 1, lastUpdated: baseDate } },
      { id: 'b', name: 'B', metadata: { relevance: 0.85, trust: 0.9, cost: 2, lastUpdated: baseDate } }
    ]
    const first = runPriorityEngine(ctx, skills, { topN: 2 })
    const second = runPriorityEngine(ctx, skills, { topN: 2 })
    expect(first).toEqual(second)
  })

  it('returns top-N skills with explanations and proper shape', () => {
    const ctx: TaskContext = { id: 't3', language: 'js', phase: 'dev' }
    const skills: NormalizedSkill[] = [
      { id: 's1', name: 'One', metadata: { relevance: 0.2, trust: 0.9, cost: 0.5, languageCompatibility: ['js'], phaseCompatibility: ['dev'] } },
      { id: 's2', name: 'Two', metadata: { relevance: 0.9, trust: 0.5, cost: 2, languageCompatibility: ['js'], phaseCompatibility: ['dev'] } },
      { id: 's3', name: 'Three', metadata: { relevance: 0.5, trust: 0.6, cost: 1, languageCompatibility: ['js'], phaseCompatibility: ['dev'] } }
    ]
    const res = runPriorityEngine(ctx, skills, { topN: 2 })
    expect(res.length).toBe(2)
    for (const r of res) {
      expect(typeof r.skillId).toBe('string')
      expect(typeof r.score).toBe('number')
      expect(typeof r.rank).toBe('number')
      expect(typeof r.explanation).toBe('string')
      expect(r.explanation!.length).toBeGreaterThan(0)
    }
    // ensure descending by score
    expect(res[0].score).toBeGreaterThanOrEqual(res[1].score)
  })
})
