# priorityskills Skill

A Copilot-compatible skill descriptor for the PrioritySkills v1 runtime.

## Entrypoint

`packages/skill-priorityskills/src/index.js`

## API

```js
const { rankSkills, detectConflicts, guardSkill } = require('@priorityskills/skill-priorityskills/src')
```

### `rankSkills(options?)` → `{ results: PriorityResult[], excluded: ExcludedSkill[] }`

Discovers skills from the filesystem and ranks them using the full 4-factor scoring engine
(relevance 45%, trust 25%, freshness 20%, cost 10%). Skills that fail the security guard are
left out of `results` and listed in `excluded` with the reason; pass `includeUnsafe: true` to rank them anyway.

```js
const { results, excluded } = await rankSkills({
  root: process.cwd(),   // project root to scan
  global: true,          // include ~/.copilot/installed-plugins
  task: { id: 'my-task', description: 'refactor auth module', language: 'ts', phase: 'dev' },
  topN: 5
})
```

### `detectConflicts(options?)` → `(SimilarityReport & { classification }][]`

Detects similar or conflicting skills using Jaccard similarity over names and capabilities.

```js
const conflicts = await detectConflicts({ root: '.', threshold: 0.5 })
```

### `guardSkill(manifest, source?)` → `{ accepted, trustLevel, events }`

Validates a raw skill manifest: shape validation, instruction sanitization, and metadata checks.

```js
const report = guardSkill({ id: 'my-skill', name: 'My Skill', instructions: 'do safe things' }, 'local')
if (!report.accepted) console.error(report.events)
```

## Skill manifest fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique skill identifier |
| `name` | string | Human-readable name |
| `instructions` | string | What the skill does (sanitized on ingest) |
| `metadata.priority` | number | Base priority (0–100) |
| `metadata.relevance` | number 0–1 | Domain relevance |
| `metadata.trust` | number 0–1 | Source trust level |
| `metadata.cost` | number | Relative compute cost |
| `metadata.lastUpdated` | ISO string | Freshness signal (linear decay over 365 days) |
| `metadata.capabilities` | string[] | Capability tags for conflict detection |
| `metadata.languageCompatibility` | string[] | Language filter for the priority engine |
| `metadata.phaseCompatibility` | string[] | Phase filter (dev, review, deploy…) |
