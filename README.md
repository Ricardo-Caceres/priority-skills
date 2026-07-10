# PrioritySkills v1

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Discover, validate, and prioritize **skills** — small capability descriptors — across local projects and globally installed host plugins (e.g. Copilot).

---

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm cli:scan          # scan current directory + global host skills
```

---

## CLI

All commands are available after `pnpm build` via:

```bash
node packages/cli/dist/index.js <command> [options]
# or, using the workspace shortcut:
pnpm cli:scan
```

### `scan` — discover skills

```bash
node dist/index.js scan [--root <path>] [--no-global]
```

Outputs a JSON summary of every skill found.

```json
{
  "root": "/path/to/project",
  "count": 2,
  "skills": [
    { "id": "skill-a", "name": "Skill A" },
    { "id": "skill-b", "name": "skill-b" }
  ]
}
```

### `rank` — prioritize skills for a task

```bash
node dist/index.js rank --task <description> [--root <path>] [--no-global] \
  [--language <lang>] [--phase <phase>] [--top-n <n>]
```

Runs the full 4-factor scoring engine (relevance 45%, trust 25%, freshness 20%, cost 10%) and returns the top-N ranked skills.

| Option | Default | Description |
|--------|---------|-------------|
| `--task` | *(required)* | Task description used as the context id |
| `--language` | — | Filter to skills compatible with this language |
| `--phase` | — | Filter to skills compatible with this phase (e.g. `dev`, `review`) |
| `--top-n` | `5` | Maximum results to return |

```json
{
  "task": "refactor auth module",
  "results": [
    {
      "skillId": "skill-a",
      "score": 0.612500,
      "rank": 1,
      "explanation": "components: relevance=0.800, freshness=0.500, trust=0.900, costFactor=0.500; ..."
    }
  ]
}
```

### `conflicts` — detect duplicate or overlapping skills

```bash
node dist/index.js conflicts [--root <path>] [--no-global]
```

Compares every skill pair using Jaccard similarity over names and capability tags. Each pair is classified as `duplicate`, `overlap`, `conflicting`, or `complementary`.

```json
[
  {
    "aId": "skill-a",
    "bId": "skill-b",
    "score": 0.75,
    "similar": true,
    "classification": "overlap"
  }
]
```

### `guard` — validate a skill manifest before ingesting it

```bash
node dist/index.js guard [--file <path/to/skill.json>]
```

Runs three checks in sequence: shape validation (Zod), instruction sanitization (denylist), and metadata integrity. Returns `accepted: true/false` with a full audit event log.

```json
{
  "accepted": true,
  "trustLevel": "trusted",
  "events": [
    { "check": "manifest", "result": "pass", ... },
    { "check": "instruction-sanitization", "result": "pass", ... },
    { "check": "metadata", "result": "pass", ... }
  ]
}
```

---

## Skill manifest format

Skills are discovered from `skill.json` (or `package.json`) files inside directories under `.github/skills/` or `skills/` in your project root.

```json
{
  "id": "my-skill",
  "name": "My Skill",
  "instructions": "Explain what this skill does. Avoid eval(), exec, rm -rf.",
  "metadata": {
    "priority": 50,
    "relevance": 0.8,
    "trust": 0.9,
    "cost": 1,
    "lastUpdated": "2025-01-15T00:00:00.000Z",
    "capabilities": ["summarize", "text"],
    "languageCompatibility": ["ts", "js"],
    "phaseCompatibility": ["dev", "review"]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique skill identifier |
| `name` | string | Human-readable name |
| `instructions` | string | What the skill does (sanitized on ingest — forbidden: `eval(`, `exec`, `rm -rf`, `sudo`, `bypass`) |
| `metadata.priority` | number | Base priority hint (0–100) |
| `metadata.relevance` | number 0–1 | How relevant this skill is to its domain |
| `metadata.trust` | number 0–1 | How trustworthy the skill source is |
| `metadata.cost` | number | Relative compute cost (lower = cheaper) |
| `metadata.lastUpdated` | ISO string | Freshness signal — decays linearly over 365 days |
| `metadata.capabilities` | string[] | Tags used by conflict detection |
| `metadata.languageCompatibility` | string[] | `rank --language` filter |
| `metadata.phaseCompatibility` | string[] | `rank --phase` filter |

---

## Architecture

```
packages/
  core/          — types, Zod validators, priority engine, conflict detection, security layer
  adapters/      — LocalFilesystemAdapter (.github/skills, skills/) + GlobalHostAdapter (~/.copilot/installed-plugins)
  cli/           — scan · rank · conflicts · guard commands
  skill-priorityskills/  — Copilot-compatible skill descriptor with ready-to-use API
```

### Priority engine scoring

`runPriorityEngine(task, skills, { topN })` applies these weights:

| Factor | Weight | Source |
|--------|--------|--------|
| Relevance | 45% | `metadata.relevance` or `metadata.priority / 100` |
| Trust | 25% | `metadata.trust` (default 0.5) |
| Freshness | 20% | Linear decay from `metadata.lastUpdated` over 365 days |
| Cost | 10% | `1 / (1 + metadata.cost)` |

Skills are filtered by `languageCompatibility` and `phaseCompatibility` before scoring if those fields and the task context are provided.

### Conflict classification

`classifyPair(a, b)` uses Jaccard similarity (60% name tokens, 40% capability tags):

| Class | Condition |
|---|---|
| `duplicate` | Score ≥ 0.85 and identical capability sets |
| `overlap` | Shared capabilities and score ≥ 0.5 |
| `conflicting` | Shared capabilities but low name similarity |
| `complementary` | Little to no overlap |

---

## Programmatic usage

```js
const { rankSkills, detectConflicts, guardSkill } = require('@priorityskills/skill-priorityskills/src')

// Rank skills for a task
const results = await rankSkills({
  root: process.cwd(),
  global: true,
  task: { id: 'auth-refactor', description: 'refactor auth module', language: 'ts', phase: 'dev' },
  topN: 5
})

// Detect conflicts
const conflicts = await detectConflicts({ root: '.', threshold: 0.5 })

// Validate before ingesting
const report = guardSkill({ id: 'my-skill', name: 'My Skill', instructions: 'do safe things' }, 'local')
if (!report.accepted) console.error(report.events)
```

---

## Global host skills

By default, `scan`, `rank`, and `conflicts` also discover skills installed in `~/.copilot/installed-plugins`. Pass `--no-global` to restrict discovery to the local project only.

---

## License

[MIT](LICENSE) © Rick Caceres

This repo is workspace-managed with pnpm. Not published to npm — local use only.
