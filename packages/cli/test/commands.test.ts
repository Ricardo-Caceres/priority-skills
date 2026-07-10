import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import { discoverAll } from '../src/index'
import { runPriorityEngine, validateSkill, detectSimilarities, classifyPair } from '@priorityskills/core'
import type { TaskContext, NormalizedSkill } from '@priorityskills/core'

const ADAPTER_FIXTURES = path.resolve(__dirname, '../../adapters/test/fixtures')
const CLI_FIXTURES = path.resolve(__dirname, 'fixtures')

describe('discoverAll', () => {
  it('discovers local skills from a fixture project', async () => {
    const skills = await discoverAll(path.join(ADAPTER_FIXTURES, 'project1'), false)
    const ids = skills.map((s) => s.id).sort()
    expect(ids).toEqual(['skill-a', 'skill-b'])
  })

  it('omits global skills when includeGlobal is false', async () => {
    const skills = await discoverAll(path.join(ADAPTER_FIXTURES, 'project1'), false)
    expect(skills.every((s) => s.metadata?.source === 'local_project')).toBe(true)
  })

  it('extracts scoring metadata from manifests', async () => {
    const skills = await discoverAll(path.join(ADAPTER_FIXTURES, 'project1'), false)
    const skillA = skills.find((s) => s.id === 'skill-a')
    expect(skillA).toBeTruthy()
    expect(skillA!.metadata?.priority).toBe(5)
  })

  it('returns empty list for a project with no skill directories', async () => {
    const skills = await discoverAll(CLI_FIXTURES, false)
    expect(Array.isArray(skills)).toBe(true)
    expect(skills.length).toBe(0)
  })
})

describe('rank — runPriorityEngine integration', () => {
  it('returns ranked results with explanations', () => {
    const task: TaskContext = { id: 'test-task', description: 'do something', language: 'js' }
    const skills: NormalizedSkill[] = [
      { id: 'a', name: 'Alpha', metadata: { relevance: 0.9, trust: 0.8, cost: 1, languageCompatibility: ['js'] } },
      { id: 'b', name: 'Beta', metadata: { relevance: 0.3, trust: 0.5, cost: 2, languageCompatibility: ['js'] } }
    ]
    const results = runPriorityEngine(task, skills, { topN: 5 })
    expect(results.length).toBe(2)
    expect(results[0].skillId).toBe('a')
    expect(results[0].score).toBeGreaterThan(results[1].score)
    expect(results[0].rank).toBe(1)
    expect(typeof results[0].explanation).toBe('string')
  })

  it('respects topN limit', () => {
    const task: TaskContext = { id: 't', description: 'task' }
    const skills: NormalizedSkill[] = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      name: `Skill ${i}`,
      metadata: { relevance: i / 10 }
    }))
    const results = runPriorityEngine(task, skills, { topN: 3 })
    expect(results.length).toBe(3)
  })

  it('filters by language when specified', () => {
    const task: TaskContext = { id: 't', description: 'task', language: 'python' }
    const skills: NormalizedSkill[] = [
      { id: 'js-skill', name: 'JS Only', metadata: { languageCompatibility: ['js'] } },
      { id: 'py-skill', name: 'Python Only', metadata: { languageCompatibility: ['python'] } }
    ]
    const results = runPriorityEngine(task, skills)
    expect(results.map((r) => r.skillId)).toEqual(['py-skill'])
  })
})

describe('guard — validateSkill integration', () => {
  it('accepts a valid skill manifest', async () => {
    const raw = JSON.parse(await fs.promises.readFile(path.join(CLI_FIXTURES, 'valid-skill.json'), 'utf-8'))
    const report = validateSkill(raw, 'local')
    expect(report.accepted).toBe(true)
    expect(report.trustLevel).toBe('trusted')
  })

  it('rejects a skill with dangerous instructions', async () => {
    const raw = JSON.parse(await fs.promises.readFile(path.join(CLI_FIXTURES, 'dangerous-skill.json'), 'utf-8'))
    const report = validateSkill(raw, 'local')
    expect(report.accepted).toBe(false)
    expect(report.events.some((e) => e.check === 'instruction-sanitization' && e.result === 'fail')).toBe(true)
  })

  it('rejects a manifest with missing required fields', () => {
    const report = validateSkill({ name: 'No ID Skill' }, 'local')
    expect(report.accepted).toBe(false)
    expect(report.events.some((e) => e.check === 'manifest' && e.result === 'fail')).toBe(true)
  })
})

describe('conflicts — detectSimilarities + classifyPair integration', () => {
  it('finds similar skills and classifies them', () => {
    const skills: NormalizedSkill[] = [
      { id: 'a', name: 'Translate Document', metadata: { capabilities: ['translate', 'document'] } },
      { id: 'b', name: 'Document Translator', metadata: { capabilities: ['translate', 'document'] } },
      { id: 'c', name: 'Image Classifier', metadata: { capabilities: ['vision', 'classify'] } }
    ]
    const reports = detectSimilarities(skills)
    const abPair = reports.find((r) => (r.aId === 'a' && r.bId === 'b') || (r.aId === 'b' && r.bId === 'a'))
    expect(abPair?.similar).toBe(true)

    const a = skills[0]
    const b = skills[1]
    const cls = classifyPair(a, b)
    expect(['duplicate', 'overlap']).toContain(cls)
  })

  it('marks unrelated skills as complementary', () => {
    const a: NormalizedSkill = { id: 'a', name: 'Image Filter', metadata: { capabilities: ['vision'] } }
    const b: NormalizedSkill = { id: 'b', name: 'Text Translator', metadata: { capabilities: ['translate'] } }
    expect(classifyPair(a, b)).toBe('complementary')
  })
})
