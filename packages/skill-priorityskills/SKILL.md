# priorityskills Skill (minimal descriptor)

This is a Superpowers/Codex-compatible skill descriptor for priorityskills core.

Entrypoint (JS): packages/skill-priorityskills/src/index.js

Usage (orchestration):
- Import the core API: `const { prioritizeSkills } = require('@priorityskills/core')`
- Call discovery and prioritize as needed. Example pseudocode:

```js
// discover via adapters
const { LocalFilesystemAdapter, normalizedSkillFactory } = require('@priorityskills/adapters')
const adapter = new LocalFilesystemAdapter()
const raw = await adapter.discover(process.cwd())
const normalized = raw.map(normalizedSkillFactory)
const results = prioritizeSkills(normalized)
console.log(results)
```

Notes:
- This package only provides a descriptor and example for v1 integration.
- Full skill runtime integration is planned for v1.5.
