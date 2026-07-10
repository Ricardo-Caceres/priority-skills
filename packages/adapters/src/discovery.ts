import fs from 'fs'
import path from 'path'
import { NormalizedSkill } from '@priorityskills/core'

export interface RawDiscoveredSkill {
  id: string
  name?: string
  manifest?: Record<string, any>
  path: string
}

export interface SkillSourceAdapter<T = RawDiscoveredSkill> {
  discover(projectRoot?: string): Promise<T[]>
}

export class LocalFilesystemAdapter implements SkillSourceAdapter {
  private readonly locations: string[]

  constructor(locations?: string[]) {
    this.locations = locations ?? ['.github/skills', 'skills']
  }

  async discover(projectRoot = process.cwd()): Promise<RawDiscoveredSkill[]> {
    const results: RawDiscoveredSkill[] = []

    for (const loc of this.locations) {
      const full = path.resolve(projectRoot, loc)
      if (!fs.existsSync(full)) continue

      const entries = await fs.promises.readdir(full, { withFileTypes: true })
      for (const ent of entries) {
        if (!ent.isDirectory()) continue
        const skillDir = path.join(full, ent.name)

        // try skill.json then package.json
        const skillJson = path.join(skillDir, 'skill.json')
        const pkgJson = path.join(skillDir, 'package.json')
        let manifest: Record<string, any> | undefined
        if (fs.existsSync(skillJson)) {
          try {
            manifest = JSON.parse(await fs.promises.readFile(skillJson, 'utf-8'))
          } catch (e) {
            // ignore malformed
          }
        } else if (fs.existsSync(pkgJson)) {
          try {
            manifest = JSON.parse(await fs.promises.readFile(pkgJson, 'utf-8'))
          } catch (e) {
            // ignore
          }
        }

        const id = manifest?.id ?? ent.name
        const name = manifest?.name ?? ent.name

        results.push({ id, name, manifest, path: skillDir })
      }
    }

    return results
  }
}

export interface GlobalHostAdapterOptions {
  homeDir?: string
  locations?: string[]
}

export class GlobalHostAdapter implements SkillSourceAdapter {
  private readonly homeDir: string
  private readonly locations: string[]

  constructor(options?: GlobalHostAdapterOptions) {
    this.homeDir = options?.homeDir ?? process.env.HOME ?? ''
    this.locations = options?.locations ?? ['.copilot/installed-plugins']
  }

  async discover(): Promise<RawDiscoveredSkill[]> {
    const results: RawDiscoveredSkill[] = []

    for (const relative of this.locations) {
      const base = path.resolve(this.homeDir, relative)
      if (!fs.existsSync(base)) continue

      const marketplaces = await fs.promises.readdir(base, { withFileTypes: true })
      for (const marketplace of marketplaces) {
        if (!marketplace.isDirectory()) continue
        const marketplaceDir = path.join(base, marketplace.name)
        const plugins = await fs.promises.readdir(marketplaceDir, { withFileTypes: true })

        for (const plugin of plugins) {
          if (!plugin.isDirectory()) continue
          const pluginDir = path.join(marketplaceDir, plugin.name)
          const skillsDir = path.join(pluginDir, 'skills')
          if (!fs.existsSync(skillsDir)) continue

          const skills = await fs.promises.readdir(skillsDir, { withFileTypes: true })
          for (const skill of skills) {
            if (!skill.isDirectory()) continue
            const skillDir = path.join(skillsDir, skill.name)
            const skillMd = path.join(skillDir, 'SKILL.md')
            const skillJson = path.join(skillDir, 'skill.json')

            if (!fs.existsSync(skillMd) && !fs.existsSync(skillJson)) continue
            let manifest: Record<string, any> | undefined

            if (fs.existsSync(skillJson)) {
              try {
                manifest = JSON.parse(await fs.promises.readFile(skillJson, 'utf-8'))
              } catch (_e) {
                // ignore malformed global skill manifests
              }
            }

            results.push({
              id: manifest?.id ?? skill.name,
              name: manifest?.name ?? skill.name,
              manifest,
              path: skillDir
            })
          }
        }
      }
    }

    return results
  }
}

const SCALAR_MANIFEST_FIELDS = ['priority', 'relevance', 'trust', 'cost', 'lastUpdated', 'instructions'] as const
const ARRAY_MANIFEST_FIELDS = ['capabilities', 'languageCompatibility', 'phaseCompatibility'] as const

export function normalizedSkillFactory(raw: RawDiscoveredSkill): NormalizedSkill {
  const metadata: Record<string, any> = {}
  if (raw.manifest) {
    for (const field of SCALAR_MANIFEST_FIELDS) {
      if (raw.manifest[field] !== undefined) metadata[field] = raw.manifest[field]
    }
    for (const field of ARRAY_MANIFEST_FIELDS) {
      if (Array.isArray(raw.manifest[field])) metadata[field] = raw.manifest[field]
    }
    metadata.manifest = raw.manifest
  }
  if (raw.path.includes('.copilot/installed-plugins')) {
    metadata.source = 'global_host'
    metadata.host = 'copilot'
  } else {
    metadata.source = 'local_project'
  }

  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    metadata
  }
}
