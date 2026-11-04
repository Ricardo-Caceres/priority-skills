import type { NormalizedSkill } from './types'
import { validators } from './validation'

export type TrustLevel = 'trusted' | 'unknown' | 'blocked'

export interface SecurityConfig {
  denylist: string[]
  allowlist: string[]
  trustedSources: string[]
  blockedSources: string[]
}

export interface SecurityEvent {
  skillId?: string
  check: string
  result: 'pass' | 'fail'
  reason?: string
  timestamp: string
  details?: unknown
  source?: string
}

export const defaultConfig: SecurityConfig = {
  denylist: ['eval(', 'exec ', 'bypass', 'rm -rf', 'sudo '],
  allowlist: [],
  trustedSources: ['local'],
  blockedSources: ['untrusted-repo']
}

// Keeps only the most recent events so long-lived processes don't grow memory without bound.
export const MAX_AUDIT_LOG_ENTRIES = 1000

export const auditLog: SecurityEvent[] = []

function logEvent(ev: SecurityEvent) {
  auditLog.push(ev)
  if (auditLog.length > MAX_AUDIT_LOG_ENTRIES) auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG_ENTRIES)
}

export function sanitizeInstructions(instructions: string, config: SecurityConfig = defaultConfig) {
  const lower = instructions.toLowerCase()
  const reasons: string[] = []
  let sanitized = instructions
  let blocked = false

  for (const pat of config.denylist) {
    if (!pat) continue
    if (lower.includes(pat.toLowerCase())) {
      // If pattern is explicitly allowlisted, skip
      if (config.allowlist.some(a => a.toLowerCase() === pat.toLowerCase())) continue
      reasons.push(`contains forbidden pattern: ${pat}`)
      // simple deterministic replace (case-insensitive)
      const regex = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      sanitized = sanitized.replace(regex, '[REDACTED]')
      blocked = true
    }
  }

  return { sanitized, blocked, reasons }
}

export function assignTrustLevel(source: string | undefined, config: SecurityConfig = defaultConfig): TrustLevel {
  if (!source) return 'unknown'
  if (config.blockedSources.includes(source)) return 'blocked'
  if (config.trustedSources.includes(source)) return 'trusted'
  return 'unknown'
}

export function validateSkill(ingested: any, source?: string, config: SecurityConfig = defaultConfig) {
  const events: SecurityEvent[] = []
  const skillId = ingested?.id
  // 1. manifest/shape validation
  const manifestCheck = validators.normalizedSkill.safeParse(ingested)
  if (!manifestCheck.success) {
    const reason = 'manifest validation failed'
    const ev: SecurityEvent = { skillId, check: 'manifest', result: 'fail', reason, timestamp: new Date().toISOString(), source }
    events.push(ev)
    logEvent(ev)
    return { accepted: false, events, trustLevel: assignTrustLevel(source, config) }
  }
  const evPass: SecurityEvent = { skillId, check: 'manifest', result: 'pass', timestamp: new Date().toISOString(), source }
  events.push(evPass)
  logEvent(evPass)

  // 2. instruction sanitization
  // Manifests may put instructions at the top level or under metadata; check both.
  const instructions = [ingested.instructions, ingested.metadata?.instructions]
    .filter((text): text is string => typeof text === 'string')
    .join('\n')
  const { sanitized, blocked, reasons } = sanitizeInstructions(instructions, config)
  if (blocked) {
    const ev: SecurityEvent = { skillId, check: 'instruction-sanitization', result: 'fail', reason: reasons.join('; '), details: { sanitized }, timestamp: new Date().toISOString(), source }
    events.push(ev)
    logEvent(ev)
    return { accepted: false, events, trustLevel: assignTrustLevel(source, config) }
  }
  const ev2: SecurityEvent = { skillId, check: 'instruction-sanitization', result: 'pass', timestamp: new Date().toISOString(), details: { sanitized }, source }
  events.push(ev2)
  logEvent(ev2)

  // 3. metadata checks (simple: priority must be number if present)
  const metadata = ingested.metadata || {}
  if (metadata.priority !== undefined && typeof metadata.priority !== 'number') {
    const ev: SecurityEvent = { skillId, check: 'metadata', result: 'fail', reason: 'priority must be a number', timestamp: new Date().toISOString(), source }
    events.push(ev)
    logEvent(ev)
    return { accepted: false, events, trustLevel: assignTrustLevel(source, config) }
  }
  const ev3: SecurityEvent = { skillId, check: 'metadata', result: 'pass', timestamp: new Date().toISOString(), source }
  events.push(ev3)
  logEvent(ev3)

  // all checks passed
  const trustLevel = assignTrustLevel(source, config)
  const finalEv: SecurityEvent = { skillId, check: 'final', result: 'pass', timestamp: new Date().toISOString(), details: { trustLevel }, source }
  events.push(finalEv)
  logEvent(finalEv)

  return { accepted: true, events, trustLevel }
}

export function clearAuditLog() {
  auditLog.splice(0, auditLog.length)
}

export interface ExcludedSkill {
  skillId: string
  reason: string
}

export function partitionSafeSkills(
  skills: NormalizedSkill[],
  config: SecurityConfig = defaultConfig
): { safe: NormalizedSkill[]; excluded: ExcludedSkill[] } {
  const safe: NormalizedSkill[] = []
  const excluded: ExcludedSkill[] = []
  for (const skill of skills) {
    const report = validateSkill(
      skill,
      typeof skill.metadata?.source === 'string' ? skill.metadata.source : undefined,
      config
    )
    if (report.accepted) {
      safe.push(skill)
    } else {
      const failed = report.events.find((e) => e.result === 'fail')
      excluded.push({ skillId: skill.id, reason: failed ? `${failed.check}: ${failed.reason ?? 'failed'}` : 'rejected' })
    }
  }
  return { safe, excluded }
}
