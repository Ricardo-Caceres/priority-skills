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

export const auditLog: SecurityEvent[] = []

function logEvent(ev: SecurityEvent) {
  auditLog.push(ev)
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
  const instructions = (ingested.instructions || '') as string
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
