import { TaskContext, NormalizedSkill, PriorityResult } from './types'

export interface EngineOptions {
  topN?: number
}

export function runPriorityEngine(
  task: TaskContext,
  skills: NormalizedSkill[],
  options: EngineOptions = {}
): PriorityResult[] {
  const topN = typeof options.topN === 'number' ? options.topN : 5

  // Eligibility filter: language and phase compatibility if provided
  const eligible = skills.filter((s) => {
    const meta = s.metadata || {}
    const langCompat = meta.languageCompatibility as string[] | undefined
    if (langCompat && langCompat.length > 0) {
      const ctxLang = (task as any).language as string | undefined
      if (!ctxLang || !langCompat.includes(ctxLang)) return false
    }
    const phaseCompat = meta.phaseCompatibility as string[] | undefined
    if (phaseCompat && phaseCompat.length > 0) {
      const ctxPhase = (task as any).phase as string | undefined
      if (!ctxPhase || !phaseCompat.includes(ctxPhase)) return false
    }
    return true
  })

  // Scoring weights — transparent and auditable
  const WEIGHTS = {
    relevance: 0.45,
    freshness: 0.2,
    trust: 0.25,
    cost: 0.1
  }

  function clamp01(v: number) {
    if (Number.isNaN(v) || !isFinite(v)) return 0
    return Math.max(0, Math.min(1, v))
  }

  function computeFreshness(lastUpdated?: string | number): number {
    if (!lastUpdated) return 0.5
    const time = typeof lastUpdated === 'number' ? lastUpdated : Date.parse(String(lastUpdated))
    if (Number.isNaN(time)) return 0.5
    const msSince = Date.now() - time
    const days = msSince / (1000 * 60 * 60 * 24)
    // Linear decay over 365 days
    return clamp01(1 - days / 365)
  }

  const scored = eligible.map((s) => {
    const meta: any = s.metadata ?? {}
    const relevance = clamp01(typeof meta.relevance === 'number' ? meta.relevance : (typeof meta.priority === 'number' ? clamp01(meta.priority / 100) : 0))
    const freshness = computeFreshness(meta.lastUpdated)
    const trust = clamp01(typeof meta.trust === 'number' ? meta.trust : 0.5)
    const cost = typeof meta.cost === 'number' ? meta.cost : 1
    const costFactor = clamp01(1 / (1 + cost))

    const score =
      relevance * WEIGHTS.relevance +
      freshness * WEIGHTS.freshness +
      trust * WEIGHTS.trust +
      costFactor * WEIGHTS.cost

    const scoreRounded = Math.round((score + (meta.priority ? meta.priority / 1000000 : 0)) * 1e6) / 1e6

    const explanation = `components: relevance=${relevance.toFixed(3)}, freshness=${freshness.toFixed(3)}, trust=${trust.toFixed(3)}, costFactor=${costFactor.toFixed(3)}; weights: ${JSON.stringify(
      WEIGHTS
    )}; score=${scoreRounded.toFixed(6)}`

    return {
      skillId: s.id,
      score: scoreRounded,
      explanation
    }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.skillId.localeCompare(b.skillId)
  })

  const top = scored.slice(0, topN).map((s, idx) => ({ ...s, rank: idx + 1 }))
  return top
}
