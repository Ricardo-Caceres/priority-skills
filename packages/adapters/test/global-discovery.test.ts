import { describe, it, expect } from 'vitest'
import path from 'path'
import { GlobalHostAdapter, normalizedSkillFactory } from '../src'

describe('GlobalHostAdapter', () => {
  it('discovers skills from Copilot global plugin locations', async () => {
    const fakeHome = path.resolve(__dirname, 'fixtures', 'global-home')
    const adapter = new GlobalHostAdapter({ homeDir: fakeHome })
    const raw = await adapter.discover()

    const ids = raw.map((r) => r.id).sort()
    expect(ids).toContain('brainstorming')

    const normalized = raw.map(normalizedSkillFactory)
    const brainstorming = normalized.find((s) => s.id === 'brainstorming')
    expect(brainstorming).toBeTruthy()
    expect(brainstorming?.metadata.source).toBe('global_host')
    expect(brainstorming?.metadata.host).toBe('copilot')
  })
})

