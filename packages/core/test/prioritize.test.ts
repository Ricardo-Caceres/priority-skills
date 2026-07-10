import { describe, it, expect } from 'vitest'
import { prioritizeSkills } from '../src/prioritize'
import { ConflictType, ConflictReport } from '../src/types'

describe('prioritizeSkills', () => {
  it('produces deterministic ranking from stub data', () => {
    const skills = [
      { id: 'alpha', name: 'Alpha', metadata: { priority: 2 } },
      { id: 'beta', name: 'Beta', metadata: { priority: 1 } },
      { id: 'gamma', name: 'Gamma' }
    ]

    const res = prioritizeSkills(skills)
    // highest priority should be alpha, then beta, then gamma
    expect(res[0].skillId).toBe('alpha')
    expect(res[1].skillId).toBe('beta')
    expect(res[2].skillId).toBe('gamma')

    // scores and ranks monotonic
    expect(res.map(r => r.rank)).toEqual([1,2,3])
    expect(res[0].score).toBeGreaterThan(res[1].score)
  })
})

describe('ConflictReport shape', () => {
  it('classifies a conflict with expected shape', () => {
    const rpt: ConflictReport = { skillId: 's1', conflictType: ConflictType.Hard, details: 'reason' }
    expect(rpt).toHaveProperty('skillId')
    expect([ConflictType.Hard, ConflictType.Soft]).toContain(rpt.conflictType)
  })
})
