import { NormalizedSkill } from './types'

export type ConflictClass = 'duplicate' | 'overlap' | 'conflicting' | 'complementary'

export interface SimilarityReport {
  aId: string
  bId: string
  score: number // 0..1
  similar: boolean
}

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter(x => b.has(x)))
  const uni = new Set([...a, ...b])
  if (uni.size === 0) return 0
  return inter.size / uni.size
}

export function similarityScore(a: NormalizedSkill, b: NormalizedSkill): number {
  const nameTokensA = new Set(tokenize(a.name))
  const nameTokensB = new Set(tokenize(b.name))
  const nameScore = jaccard(nameTokensA, nameTokensB)

  const capsA = new Set(
    Array.isArray(a.metadata?.capabilities) ? (a.metadata?.capabilities as string[]) : []
  )
  const capsB = new Set(
    Array.isArray(b.metadata?.capabilities) ? (b.metadata?.capabilities as string[]) : []
  )
  const capScore = jaccard(capsA, capsB)

  // weighted heuristic: name more important than capabilities
  const score = nameScore * 0.6 + capScore * 0.4
  return Math.max(0, Math.min(1, score))
}

export function areSimilar(a: NormalizedSkill, b: NormalizedSkill, threshold = 0.5): boolean {
  return similarityScore(a, b) >= threshold
}

export function detectSimilarities(skills: NormalizedSkill[], threshold = 0.5): SimilarityReport[] {
  const reports: SimilarityReport[] = []
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i]
      const b = skills[j]
      const score = similarityScore(a, b)
      reports.push({ aId: a.id, bId: b.id, score, similar: score >= threshold })
    }
  }
  return reports
}

export function classifyPair(a: NormalizedSkill, b: NormalizedSkill): ConflictClass {
  const score = similarityScore(a, b)
  const capsA = new Set(Array.isArray(a.metadata?.capabilities) ? (a.metadata?.capabilities as string[]) : [])
  const capsB = new Set(Array.isArray(b.metadata?.capabilities) ? (b.metadata?.capabilities as string[]) : [])
  const capInter = new Set([...capsA].filter(x => capsB.has(x)))

  // duplicate: very high similarity and capability sets are identical (or both empty)
  const capsEqual = capsA.size === capsB.size && [...capsA].every(x => capsB.has(x))
  if (score >= 0.85 && capsEqual) return 'duplicate'

  // overlap: moderate similarity and some capability intersection
  // relax condition to allow capability-heavy matches even when name tokens differ
  const capScore = jaccard(capsA, capsB)
  if (capInter.size > 0 && (score >= 0.5 || capScore >= 0.3)) return 'overlap'

  // conflicting: same capability but low name similarity
  if (capInter.size > 0 && score < 0.5) return 'conflicting'

  // complementary: little to no overlap in capabilities and low similarity
  return 'complementary'
}

// Resolution strategies
export type ResolutionStrategy = 'prefer_one' | 'compose' | 'suppress' | 'suggest_merge_template'

export interface ResolutionResult {
  kept: NormalizedSkill[]
  removed?: NormalizedSkill[]
  composed?: NormalizedSkill | null
  suggestion?: string | null
}

function pickPreferred(skills: NormalizedSkill[]): NormalizedSkill {
  // deterministic: prefer higher metadata.priority, then higher relevance, then lower id lexicographically
  const sorted = [...skills].sort((x, y) => {
    const px = typeof x.metadata?.priority === 'number' ? x.metadata!.priority! : 0
    const py = typeof y.metadata?.priority === 'number' ? y.metadata!.priority! : 0
    if (px !== py) return py - px
    const rx = typeof x.metadata?.relevance === 'number' ? x.metadata!.relevance! : 0
    const ry = typeof y.metadata?.relevance === 'number' ? y.metadata!.relevance! : 0
    if (rx !== ry) return ry - rx
    return x.id.localeCompare(y.id)
  })
  return sorted[0]
}

export function resolveConflict(skills: NormalizedSkill[], strategy: ResolutionStrategy): ResolutionResult {
  if (skills.length === 0) return { kept: [] }
  if (skills.length === 1) return { kept: skills }

  switch (strategy) {
    case 'prefer_one': {
      const preferred = pickPreferred(skills)
      const removed = skills.filter(s => s.id !== preferred.id)
      return { kept: [preferred], removed }
    }
    case 'suppress': {
      // suppress all but highest priority but keep none of the suppressed
      const preferred = pickPreferred(skills)
      const removed = skills.filter(s => s.id !== preferred.id)
      return { kept: [preferred], removed }
    }
    case 'compose': {
      // deterministic composition: combine names and union capabilities
      const base = pickPreferred(skills)
      const allCaps = new Set<string>()
      for (const s of skills) {
        const caps = Array.isArray(s.metadata?.capabilities) ? (s.metadata?.capabilities as string[]) : []
        for (const c of caps) allCaps.add(c)
      }
      const composed: NormalizedSkill = {
        id: skills.map(s => s.id).sort().join('+'),
        name: skills.map(s => s.name).join(' / '),
        metadata: {
          ...base.metadata,
          capabilities: [...allCaps]
        }
      }
      return { kept: [composed], composed }
    }
    case 'suggest_merge_template': {
      const preferred = pickPreferred(skills)
      const others = skills.filter(s => s.id !== preferred.id)
      const suggestion = `Merge ${others.map(o => o.name).join(', ')} into ${preferred.name}. Template:\n\n- Purpose: ${preferred.name}\n- Keep capabilities: ${Array.isArray(preferred.metadata?.capabilities) ? (preferred.metadata!.capabilities as string[]).join(', ') : ''}\n- Merge notes:\n${others.map(o => `  - From ${o.name}: capabilities ${Array.isArray(o.metadata?.capabilities) ? (o.metadata!.capabilities as string[]).join(', ') : ''}`).join('\n')}`
      return { kept: [preferred], removed: others, suggestion }
    }
    default:
      return { kept: skills }
  }
}

export default {
  similarityScore,
  areSimilar,
  detectSimilarities,
  classifyPair,
  resolveConflict
}
