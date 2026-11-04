const { LocalFilesystemAdapter, GlobalHostAdapter, normalizedSkillFactory } = require('@priorityskills/adapters')
const { runPriorityEngine, partitionSafeSkills, detectSimilarities, classifyPair, validateSkill } = require('@priorityskills/core')

/**
 * Discover, validate, and rank skills for a given task context.
 *
 * @param {object} options
 * @param {string} [options.root]         - project root to scan (default: cwd)
 * @param {boolean} [options.global]      - include globally installed host skills (default: true)
 * @param {object} [options.task]         - TaskContext: { id, description?, language?, phase? }
 * @param {number} [options.topN]         - max results to return (default: 5)
 * @param {boolean} [options.includeUnsafe] - also rank skills that fail the security guard (default: false)
 * @returns {Promise<{ results: import('@priorityskills/core').PriorityResult[], excluded: import('@priorityskills/core').ExcludedSkill[] }>}
 */
async function rankSkills({ root = process.cwd(), global: includeGlobal = true, task = { id: 'default' }, topN = 5, includeUnsafe = false } = {}) {
  const localRaw = await new LocalFilesystemAdapter().discover(root)
  const globalRaw = includeGlobal ? await new GlobalHostAdapter().discover() : []
  const normalized = [...localRaw, ...globalRaw].map(normalizedSkillFactory)
  const { safe, excluded } = includeUnsafe ? { safe: normalized, excluded: [] } : partitionSafeSkills(normalized)
  return { results: runPriorityEngine(task, safe, { topN }), excluded }
}

/**
 * Detect conflicts across all discovered skills.
 *
 * @param {object} options
 * @param {string} [options.root]
 * @param {boolean} [options.global]
 * @param {number} [options.threshold]    - similarity threshold 0..1 (default: 0.5)
 */
async function detectConflicts({ root = process.cwd(), global: includeGlobal = true, threshold = 0.5 } = {}) {
  const localRaw = await new LocalFilesystemAdapter().discover(root)
  const globalRaw = includeGlobal ? await new GlobalHostAdapter().discover() : []
  const normalized = [...localRaw, ...globalRaw].map(normalizedSkillFactory)
  const reports = detectSimilarities(normalized, threshold)
  return reports.map((r) => {
    const a = normalized.find((s) => s.id === r.aId)
    const b = normalized.find((s) => s.id === r.bId)
    return { ...r, classification: a && b ? classifyPair(a, b) : 'unknown' }
  })
}

/**
 * Validate a raw skill manifest object before ingesting it.
 *
 * @param {object} manifest    - raw skill manifest
 * @param {string} [source]    - 'local' | 'global_host' | other trust source
 */
function guardSkill(manifest, source = 'local') {
  return validateSkill(manifest, source)
}

module.exports = { rankSkills, detectConflicts, guardSkill }
