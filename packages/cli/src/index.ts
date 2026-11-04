#!/usr/bin/env node
import { Command } from 'commander'
import path from 'path'
import fs from 'fs'
import { GlobalHostAdapter, LocalFilesystemAdapter, normalizedSkillFactory } from '@priorityskills/adapters'
import {
  runPriorityEngine,
  partitionSafeSkills,
  validateSkill,
  detectSimilarities,
  classifyPair,
  type TaskContext
} from '@priorityskills/core'

export async function discoverAll(root: string, includeGlobal: boolean) {
  const localRaw = await new LocalFilesystemAdapter().discover(root)
  const globalRaw = includeGlobal ? await new GlobalHostAdapter().discover() : []
  return [...localRaw, ...globalRaw].map(normalizedSkillFactory)
}

const program = new Command()
program
  .name('priorityskills')
  .description('Discover, rank, deduplicate and security-check AI agent skills')
  .version(require('../package.json').version)

program
  .command('scan')
  .description('Discover skills locally and output a summary')
  .option('--root <root>', 'project root to scan', process.cwd())
  .option('--no-global', 'do not include globally installed host skills')
  .action(async (opts) => {
    try {
      const normalized = await discoverAll(opts.root, opts.global)
      const summary = {
        root: path.resolve(opts.root),
        count: normalized.length,
        skills: normalized.map((s) => ({ id: s.id, name: s.name }))
      }
      console.log(JSON.stringify(summary, null, 2))
    } catch (e: any) {
      console.error('scan failed:', e?.message ?? String(e))
      process.exit(1)
    }
  })

program
  .command('rank')
  .description('Prioritize skills for a given task using the full scoring engine')
  .requiredOption('--task <task>', 'task description or id')
  .option('--root <root>', 'project root to scan', process.cwd())
  .option('--no-global', 'do not include globally installed host skills')
  .option('--language <language>', 'filter by language compatibility')
  .option('--phase <phase>', 'filter by phase compatibility')
  .option('--top-n <n>', 'maximum number of results to return', '5')
  .option('--include-unsafe', 'also rank skills that fail the security guard')
  .action(async (opts) => {
    try {
      const discovered = await discoverAll(opts.root, opts.global)
      const { safe, excluded } = opts.includeUnsafe
        ? { safe: discovered, excluded: [] }
        : partitionSafeSkills(discovered)
      const task: TaskContext = {
        id: opts.task,
        description: opts.task,
        language: opts.language,
        phase: opts.phase
      }
      const results = runPriorityEngine(task, safe, { topN: parseInt(opts.topN, 10) })
      console.log(JSON.stringify({ task: opts.task, results, excluded }, null, 2))
    } catch (e: any) {
      console.error('rank failed:', e?.message ?? String(e))
      process.exit(1)
    }
  })

program
  .command('conflicts')
  .description('Detect conflicting or duplicate skills and output a report')
  .option('--root <root>', 'project root to scan', process.cwd())
  .option('--no-global', 'do not include globally installed host skills')
  .action(async (opts) => {
    try {
      const normalized = await discoverAll(opts.root, opts.global)
      const reports = detectSimilarities(normalized)
      const classified = reports.map((r) => {
        const a = normalized.find((s) => s.id === r.aId)!
        const b = normalized.find((s) => s.id === r.bId)!
        return {
          aId: r.aId,
          bId: r.bId,
          score: r.score,
          similar: r.similar,
          classification: classifyPair(a, b)
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
