import { describe, it, expect } from 'vitest'
import { validators } from '../src'

describe('validation', () => {
  it('valid TaskContext passes and invalid fails', () => {
    const good = { id: 'task-1', description: 'do something' }
    expect(() => validators.taskContext.parse(good)).not.toThrow()

    const bad = { description: 'missing id' }
    expect(() => validators.taskContext.parse(bad as any)).toThrow()
  })

  it('valid NormalizedSkill passes and invalid fails', () => {
    const good = { id: 's1', name: 'Skill One', metadata: { priority: 10 } }
    expect(() => validators.normalizedSkill.parse(good)).not.toThrow()

    const bad = { id: 's2', name: 'Skill Two', metadata: { priority: 'high' } }
    expect(() => validators.normalizedSkill.parse(bad as any)).toThrow()
  })

  it('valid ConflictReport passes and invalid fails', () => {
    const good = { skillId: 's1', conflictType: 'soft', details: 'minor overlap' }
    expect(() => validators.conflictReport.parse(good)).not.toThrow()

    const bad = { skillId: 's1', conflictType: 'unknown' }
    expect(() => validators.conflictReport.parse(bad as any)).toThrow()
  })
})
