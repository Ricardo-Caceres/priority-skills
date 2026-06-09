import { Command } from 'commander'
import path from 'path'
import { LocalFilesystemAdapter, normalizedSkillFactory } from '@priorityskills/adapters'
import { prioritizeSkills } from '@priorityskills/core'
import conflictsModule from '@priorityskills/core'
import { validateSkill } from '@priorityskills/core'
import fs from 'fs'

const program = new Command()
program.name('@priorityskills/cli').description('Priority Skills CLI')

program
  .command('scan')
  .description('Discover skills locally and output a summary')
  .option('--root <root>', 'project root to scan', process.cwd())
  .action(async (opts) => {
    try {
      const adapter = new LocalFilesystemAdapter()
      const raw = await adapter.discover(opts.root)
      const normalized = raw.map(normalizedSkillFactory)
      const summary = {
        root: path.resolve(opts.root),
        count: normalized.length,
        skills: normalized.map((s: any) => ({ id: s.id, name: s.name }))
      }
      console.log(JSON.stringify(summary, null, 2))
    } catch (e: any) {
      console.error('scan failed:', e?.message ?? String(e))
      process.exit(1)
    }
  })

program
  .command('rank')
  .description('Prioritize skills for a given task')
  .requiredOption('--task <task>', 'task description')
  .option('--root <root>', 'project root to scan', process.cwd())
  .action(async (opts) => {
    try {
      const adapter = new LocalFilesystemAdapter()
      const raw = await adapter.discover(opts.root)
      const normalized = raw.map(normalizedSkillFactory)
      const results = prioritizeSkills(normalized)
      console.log(JSON.stringify({ task: opts.task, results }, null, 2))
    } catch (e: any) {
      console.error('rank failed:', e?.message ?? String(e))
      process.exit(1)
    }
  })

program
  .command('conflicts')
  .description('Detect conflicting or duplicate skills and output a report')
  .option('--root <root>', 'project root to scan', process.cwd())
  .action(async (opts) => {
    try {
      const adapter = new LocalFilesystemAdapter()
      const raw = await adapter.discover(opts.root)
      const normalized = raw.map(normalizedSkillFactory)
      const reports = (conflictsModule.detectSimilarities as any)(normalized)
      const classified = reports.map((r: any) => {
        const a = normalized.find((s: any) => s.id === r.aId)!
        const b = normalized.find((s: any) => s.id === r.bId)!
        return {
          aId: r.aId,
          bId: r.bId,
          score: r.score,
          similar: r.similar,
          classification: conflictsModule.classifyPair(a, b)
        }
      })
      console.log(JSON.stringify(classified, null, 2))
    } catch (e: any) {
      console.error('conflicts failed:', e?.message ?? String(e))
      process.exit(1)
    }
  })

program
  .command('guard')
  .description('Validate security of a skill manifest')
  .option('--file <file>', 'path to skill manifest (JSON). If omitted, looks for skill.json in CWD')
  .action(async (opts) => {
    try {
      const file = opts.file || path.join(process.cwd(), 'skill.json')
      if (!fs.existsSync(file)) {
        console.error(JSON.stringify({ accepted: false, reason: 'file not found', file }))
        process.exit(2)
      }
      const raw = JSON.parse(await fs.promises.readFile(file, 'utf-8'))
      const report = validateSkill(raw, 'local')
      console.log(JSON.stringify(report, null, 2))
    } catch (e: any) {
      console.error('guard failed:', e?.message ?? String(e))
      process.exit(1)
    }
  })

if (require.main === module) {
  program.parseAsync(process.argv)
}

export default program
