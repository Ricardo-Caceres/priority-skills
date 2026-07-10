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
