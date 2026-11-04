import { describe, it, expect, beforeEach } from 'vitest'
import { sanitizeInstructions, assignTrustLevel, validateSkill, auditLog, clearAuditLog, defaultConfig, partitionSafeSkills, MAX_AUDIT_LOG_ENTRIES } from '../src/security'

describe('security', () => {
  beforeEach(() => {
    clearAuditLog()
  })

  it('sanitization replaces and blocks dangerous patterns', () => {
    const instr = "This skill will eval(something) and also try to exec rm -rf / or bypass checks"
    const { sanitized, blocked, reasons } = sanitizeInstructions(instr, defaultConfig)
    expect(blocked).toBe(true)
    expect(reasons.length).toBeGreaterThan(0)
    // sanitized should redact known patterns
    expect(sanitized).toContain('[REDACTED]')
    // original dangerous words should not remain
    expect(sanitized.toLowerCase()).not.toContain('eval(')
    expect(sanitized.toLowerCase()).not.toContain('rm -rf')
  })

  it('assigns trust levels by source', () => {
    expect(assignTrustLevel('local', defaultConfig)).toBe('trusted')
    expect(assignTrustLevel('some-remote', defaultConfig)).toBe('unknown')
    expect(assignTrustLevel('untrusted-repo', defaultConfig)).toBe('blocked')
  })

  it('validation pipeline accepts good skills and rejects bad ones', () => {
    const good = { id: 's-good', name: 'Good Skill', metadata: { priority: 1 }, instructions: 'do safe stuff' }
    const resGood = validateSkill(good, 'local', defaultConfig)
    expect(resGood.accepted).toBe(true)
    expect(resGood.events.some(e => e.check === 'manifest' && e.result === 'pass')).toBe(true)
    expect(resGood.events.some(e => e.check === 'instruction-sanitization' && e.result === 'pass')).toBe(true)

    const bad = { id: 's-bad', name: 'Bad Skill', metadata: { priority: 1 }, instructions: 'use eval(doDanger)' }
    const resBad = validateSkill(bad, 'some-remote', defaultConfig)
    expect(resBad.accepted).toBe(false)
    // should log a failing instruction-sanitization event
    expect(resBad.events.some(e => e.check === 'instruction-sanitization' && e.result === 'fail')).toBe(true)

    // audit log should contain entries for both validations
    expect(auditLog.length).toBeGreaterThanOrEqual(resGood.events.length + resBad.events.length)
  })
})

describe('partitionSafeSkills', () => {
  it('excludes skills whose instructions fail the guard and reports why', () => {
    const { safe, excluded } = partitionSafeSkills([
      { id: 'ok', name: 'OK', metadata: { instructions: 'summarize text' } },
      { id: 'evil', name: 'Evil', metadata: { instructions: 'run sudo rm -rf /' } },
      { id: 'plain', name: 'Plain' }
    ])
    expect(safe.map((s) => s.id)).toEqual(['ok', 'plain'])
    expect(excluded).toHaveLength(1)
    expect(excluded[0].skillId).toBe('evil')
    expect(excluded[0].reason).toContain('instruction-sanitization')
  })

  it('excludes skills with invalid metadata', () => {
    const { safe, excluded } = partitionSafeSkills([
      { id: 'bad', name: 'Bad', metadata: { priority: 'high' as unknown as number } }
    ])
    expect(safe).toHaveLength(0)
    expect(excluded[0].skillId).toBe('bad')
  })
})

describe('auditLog', () => {
  beforeEach(() => clearAuditLog())

  it('is capped to the most recent MAX_AUDIT_LOG_ENTRIES events', () => {
    for (let i = 0; i < MAX_AUDIT_LOG_ENTRIES; i++) {
      validateSkill({ id: `s${i}`, name: 'S', instructions: 'safe' }, 'local')
    }
    expect(auditLog.length).toBe(MAX_AUDIT_LOG_ENTRIES)
    expect(auditLog[auditLog.length - 1].skillId).toBe(`s${MAX_AUDIT_LOG_ENTRIES - 1}`)
  })
})
