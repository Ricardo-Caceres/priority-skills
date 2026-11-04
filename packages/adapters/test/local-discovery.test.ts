import { describe, it, expect } from 'vitest'
import path from 'path'
import { LocalFilesystemAdapter, normalizedSkillFactory } from '../src'

describe('LocalFilesystemAdapter', () => {
  it('discovers skills in .github/skills and skills directories', async () => {
    const fixtures = path.resolve(__dirname, 'fixtures', 'project1')
    const adapter = new LocalFilesystemAdapter()
    const raw = await adapter.discover(fixtures)

    // should find two skills
    const ids = raw.map(r => r.id).sort()
    expect(ids).toEqual(['skill-a', 'skill-b'])

    // normalized factory
    const normalized = raw.map(normalizedSkillFactory)
    const byId = Object.fromEntries(normalized.map(s => [s.id, s]))
    expect(byId['skill-a'].name).toBe('Skill A')
    expect(byId['skill-a'].metadata.priority).toBe(5)
    expect(byId['skill-b'].name).toBe('skill-b')
    expect(byId['skill-b'].metadata.manifest).toBeTruthy()
  })
})

describe('normalizedSkillFactory manifest formats', () => {
  it('reads scoring fields nested under metadata (documented format)', () => {
    const s = normalizedSkillFactory({
      id: 'n',
      path: '/p/skills/n',
      manifest: { id: 'n', metadata: { relevance: 0.9, trust: 0.7, languageCompatibility: ['py'] } }
    })
    expect(s.metadata?.relevance).toBe(0.9)
    expect(s.metadata?.trust).toBe(0.7)
    expect(s.metadata?.languageCompatibility).toEqual(['py'])
  })

  it('falls back to top-level fields and prefers nested ones when both exist', () => {
    const s = normalizedSkillFactory({
      id: 't',
      path: '/p/skills/t',
      manifest: { id: 't', relevance: 0.2, cost: 3, metadata: { relevance: 0.8 } }
    })
    expect(s.metadata?.relevance).toBe(0.8)
    expect(s.metadata?.cost).toBe(3)
  })
})
