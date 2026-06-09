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

export function normalizedSkillFactory(raw: RawDiscoveredSkill): NormalizedSkill {
  const metadata: Record<string, any> = {}
  if (raw.manifest) {
    if (raw.manifest.priority !== undefined) metadata.priority = raw.manifest.priority
    // copy other manifest fields under metadata.manifest if needed
    metadata.manifest = raw.manifest
  }

  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    metadata
  }
}
