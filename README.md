# PrioritySkills

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Discover, validate, and prioritize **skills** — small capability descriptors — across local projects and globally installed host plugins (e.g. Copilot).

---

## Install

```bash
# run without installing
npx priorityskills scan

# or install globally
npm install -g priorityskills        # or: pnpm add -g priorityskills
priorityskills --help

# library packages
npm install @priorityskills/core @priorityskills/adapters
```

Requires Node.js 18+.

---

## CLI

```bash
npx priorityskills <command> [options]
npx priorityskills --version
```

### `scan` — discover skills

```bash
npx priorityskills scan [--root <path>] [--no-global]
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
npx priorityskills rank --task <description> [--root <path>] [--no-global] \
  [--language <lang>] [--phase <phase>] [--top-n <n>] [--include-unsafe]
```

Runs the full 4-factor scoring engine (relevance 45%, trust 25%, freshness 20%, cost 10%) and returns the top-N ranked skills.

Skills that fail the security guard (see `guard`) are **excluded by default** and listed under `excluded` with the reason. Skills that declare `languageCompatibility` / `phaseCompatibility` are only ranked when the matching `--language` / `--phase` is passed.

| Option | Default | Description |
|--------|---------|-------------|
| `--task` | *(required)* | Task description used as the context id |
| `--language` | — | Filter to skills compatible with this language |
| `--phase` | — | Filter to skills compatible with this phase (e.g. `dev`, `review`) |
| `--top-n` | `5` | Maximum results to return |
| `--include-unsafe` | off | Also rank skills that fail the security guard |

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
  ],
  "excluded": [
    { "skillId": "evil-skill", "reason": "instruction-sanitization: contains forbidden pattern: rm -rf" }
  ]
}
```

### `conflicts` — detect duplicate or overlapping skills

```bash
npx priorityskills conflicts [--root <path>] [--no-global]
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
npx priorityskills guard [--file <path/to/skill.json>]
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

Scoring fields go under `metadata` (recommended). Top-level fields (e.g. `"relevance": 0.8` next to `id`) are also accepted; if a field appears in both places, the `metadata` value wins.

```json
{
  "id": "my-skill",
  "name": "My Skill",
  "instructions": "Summarizes long documents into concise bullet points.",
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
| `instructions` | string | What the skill does. Checked by `guard` and before `rank` (also when placed under `metadata.instructions`): a skill is rejected if it contains `eval(`, `exec `, `rm -rf`, `sudo ` or `bypass` (case-insensitive) |
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
const { runPriorityEngine, partitionSafeSkills, detectSimilarities, validateSkill } = require('@priorityskills/core')
const { LocalFilesystemAdapter, GlobalHostAdapter, normalizedSkillFactory } = require('@priorityskills/adapters')

async function main() {
  // Discover
  const raw = [
    ...(await new LocalFilesystemAdapter().discover(process.cwd())),
    ...(await new GlobalHostAdapter().discover())
  ]
  const skills = raw.map(normalizedSkillFactory)

  // Drop skills that fail the security guard, then rank for a task
  const { safe, excluded } = partitionSafeSkills(skills)
  const ranked = runPriorityEngine(
    { id: 'auth-refactor', description: 'refactor auth module', language: 'ts', phase: 'dev' },
    safe,
    { topN: 5 }
  )
  console.log(ranked, excluded)

  // Detect conflicts
  const pairs = detectSimilarities(skills).filter((r) => r.similar)
  console.log(pairs)

  // Validate a manifest before ingesting it
  const report = validateSkill({ id: 'my-skill', name: 'My Skill', instructions: 'do safe things' }, 'local')
  if (!report.accepted) console.error(report.events)
}

main()
```

With ESM you can use top-level `await` directly:

```js
import { runPriorityEngine, partitionSafeSkills } from '@priorityskills/core'
import { LocalFilesystemAdapter, normalizedSkillFactory } from '@priorityskills/adapters'

const skills = (await new LocalFilesystemAdapter().discover(process.cwd())).map(normalizedSkillFactory)
const { safe } = partitionSafeSkills(skills)
console.log(runPriorityEngine({ id: 'task' }, safe))
```

TypeScript types ship with the packages.

---

## Global host skills

By default, `scan`, `rank`, and `conflicts` also discover skills installed in `~/.copilot/installed-plugins`. Pass `--no-global` to restrict discovery to the local project only.

---

## Packages

| npm package | Purpose |
|---|---|
| [`priorityskills`](https://www.npmjs.com/package/priorityskills) | CLI (`npx priorityskills`) |
| [`@priorityskills/core`](https://www.npmjs.com/package/@priorityskills/core) | Scoring engine, validation, conflicts, security |
| [`@priorityskills/adapters`](https://www.npmjs.com/package/@priorityskills/adapters) | Skill discovery (local + global host) |

Contributing / local development: see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

[MIT](LICENSE) © Ricardo Cáceres
