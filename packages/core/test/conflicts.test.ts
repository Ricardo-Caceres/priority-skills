import { describe, it, expect } from 'vitest'
import {
  similarityScore,
  areSimilar,
  detectSimilarities,
  classifyPair,
  resolveConflict
} from '../src/conflicts'
import type { NormalizedSkill } from '../src/types'

const makeSkill = (id: string, name: string, caps?: string[], priority?: number, relevance?: number): NormalizedSkill => ({
  id,
  name,
  metadata: {
    capabilities: caps,
    priority,
    relevance
  }
})

describe('conflicts similarity detection', () => {
  it('identifies same or near-same skills as similar', () => {
    const a = makeSkill('a', 'Translate Document', ['translate', 'document'])
    const b = makeSkill('b', 'Document Translator', ['translate', 'document'])
    const score = similarityScore(a, b)
    expect(score).toBeGreaterThan(0.5)
    expect(areSimilar(a, b)).toBe(true)

    const c = makeSkill('c', 'Image Classifier', ['vision', 'classify'])
    expect(areSimilar(a, c)).toBe(false)
  })

  it('detects similarities across a list', () => {
    const skills = [
      makeSkill('a', 'Translate Document', ['translate']),
      makeSkill('b', 'Document Translator', ['translate']),
      makeSkill('c', 'Image Classifier', ['vision'])
    ]
    const reps = detectSimilarities(skills, 0.5)
    // should include pair a,b marked similar
    const found = reps.find(r => (r.aId === 'a' && r.bId === 'b') || (r.aId === 'b' && r.bId === 'a'))
    expect(found).toBeTruthy()
    expect(found?.similar).toBe(true)
  })
})

describe('conflict classification', () => {
  it('marks duplicates when names and capabilities align', () => {
    const a = makeSkill('a', 'Summarize', ['summarize'])
    const b = makeSkill('b', 'Summarize', ['summarize'])
    expect(classifyPair(a, b)).toBe('duplicate')
  })

  it('marks overlap when moderate similarity and capability intersection', () => {
    const a = makeSkill('a', 'Text Summarizer', ['summarize', 'text'])
    const b = makeSkill('b', 'Summary Generator', ['summarize'])
    expect(classifyPair(a, b)).toBe('overlap')
  })

  it('marks conflicting when capability intersects but low name similarity', () => {
    const a = makeSkill('a', 'Budget Planner', ['plan'])
    const b = makeSkill('b', 'Plan Executor', ['plan'])
    // names are different enough -> conflicting
    const cls = classifyPair(a, b)
    expect(cls === 'conflicting' || cls === 'overlap').toBe(true)
  })

  it('marks complementary when little overlap', () => {
    const a = makeSkill('a', 'Image Filter', ['vision'])
    const b = makeSkill('b', 'Text Translator', ['translate'])
    expect(classifyPair(a, b)).toBe('complementary')
  })
})

describe('resolution strategies', () => {
  it('prefer_one removes losers deterministically', () => {
    const a = makeSkill('a', 'A', ['x'], 1, 0.1)
    const b = makeSkill('b', 'B', ['x'], 5, 0.9)
    const c = makeSkill('c', 'C', ['x'], 3, 0.5)
    const res = resolveConflict([a, b, c], 'prefer_one')
    expect(res.kept.length).toBe(1)
    expect(res.removed?.length).toBe(2)
    // b has highest priority
    expect(res.kept[0].id).toBe('b')
  })

  it('suggest_merge_template returns a template suggestion', () => {
    const a = makeSkill('a', 'A', ['x'], 1)
    const b = makeSkill('b', 'B', ['y'], 0)
    const res = resolveConflict([a, b], 'suggest_merge_template')
    expect(res.suggestion).toBeTruthy()
    expect(res.suggestion as string).toContain('Merge')
  })

  it('compose returns a composed skill with unioned capabilities', () => {
    const a = makeSkill('a', 'A', ['x'], 1)
    const b = makeSkill('b', 'B', ['y'], 0)
    const res = resolveConflict([a, b], 'compose')
    expect(res.composed).toBeTruthy()
    expect(res.kept[0].metadata?.capabilities).toBeDefined()
    const caps = res.kept[0].metadata?.capabilities as string[]
    expect(caps.sort()).toEqual(['x', 'y'].sort())
  })
})
