// Minimal runtime entrypoint example for orchestration
const { LocalFilesystemAdapter, normalizedSkillFactory } = require('@priorityskills/adapters')
const { prioritizeSkills } = require('@priorityskills/core')

module.exports = async function runExample(root = process.cwd()) {
  const adapter = new LocalFilesystemAdapter()
  const raw = await adapter.discover(root)
  const normalized = raw.map(normalizedSkillFactory)
  const results = prioritizeSkills(normalized)
  return results
}
