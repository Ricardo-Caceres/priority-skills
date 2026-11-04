# Development guide — PrioritySkills

## Setup

```bash
# Install pnpm if you don't have it: https://pnpm.io/
pnpm install
pnpm build    # compile all packages (core → adapters → cli)
pnpm test     # run all tests (43 total)
```

## Useful scripts

| Script | What it does |
|--------|--------------|
| `pnpm test` | Run all workspace tests (Vitest) |
| `pnpm build` | Build TypeScript in all packages (dependency order) |
| `pnpm cli:scan` | Build CLI and run `scan` against the current directory |
| `pnpm --filter @priorityskills/core test` | Test a single package |
| `pnpm --filter priorityskills build` | Build only the CLI |

## Package structure

```
packages/
  core/        src/types.ts · validation.ts · engine.ts · prioritize.ts · conflicts.ts · security.ts
  adapters/    src/discovery.ts  (LocalFilesystemAdapter + GlobalHostAdapter + normalizedSkillFactory)
  cli/         src/index.ts      (scan · rank · conflicts · guard commands + exported discoverAll)
  skill-priorityskills/  src/index.js  (rankSkills · detectConflicts · guardSkill)
schemas/       JSON Schema versions of the core types (task-context, normalized-skill, conflict-report)
```

## Adding a skill

1. Create a directory under `.github/skills/<skill-name>/` or `skills/<skill-name>/`.
2. Add a `skill.json` with at minimum `id` and `name`. Include scoring metadata for better ranking:

```json
{
  "id": "my-skill",
  "name": "My Skill",
  "instructions": "What this skill does.",
  "metadata": {
    "priority": 50,
    "relevance": 0.8,
    "trust": 0.9,
    "cost": 1,
    "lastUpdated": "2025-06-01T00:00:00.000Z",
    "capabilities": ["summarize"],
    "languageCompatibility": ["ts"],
    "phaseCompatibility": ["dev"]
  }
}
```

3. Verify discovery and scoring: `pnpm cli:scan`.

## Testing

- Tests live in `packages/*/test/` and run with Vitest.
- The CLI test suite (`packages/cli/test/commands.test.ts`) covers: `discoverAll`, rank engine integration, guard validation, and conflict classification.
- Fixtures for adapter tests are under `packages/adapters/test/fixtures/` and reused by CLI tests.
- `scripts/smoke-test.sh <tarball-dir>` installs packed tarballs into a throwaway project and checks the CLI, CommonJS and ESM entry points the way a real user would.

### CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

| Job | What it checks |
|---|---|
| Build & test | `pnpm install --frozen-lockfile`, build and the full test suite on Node 22 and 24 (pnpm 11 needs Node ≥ 22.13) |
| Pack & inspect | Packs `core`, `adapters` and `cli`; fails if a tarball ships anything besides `dist/`, `README.md`, `LICENSE`, `package.json`, or keeps a `workspace:` dependency |
| Consumer smoke test | Runs `scripts/smoke-test.sh` against those tarballs on Node 18, 20, 22 and 24 (the published `engines` range) |

`pnpm-lock.yaml` is committed; CI fails if it is out of date, so commit it whenever dependencies change.

**Coverage by package:**

| Package | Test files | Tests |
|---------|-----------|-------|
| core | 5 | 23 |
| adapters | 2 | 4 |
| cli | 1 | 16 |

## How `normalizedSkillFactory` works

`normalizedSkillFactory` in `packages/adapters/src/discovery.ts` converts a raw discovered skill into a `NormalizedSkill`. It copies these fields from the manifest into `metadata` automatically:

- **Scalar**: `priority`, `relevance`, `trust`, `cost`, `lastUpdated`, `instructions`
- **Array**: `capabilities`, `languageCompatibility`, `phaseCompatibility`

The original manifest is also preserved under `metadata.manifest`. Skills from `~/.copilot/installed-plugins` get `metadata.source = 'global_host'`; local skills get `metadata.source = 'local_project'`.

## Security

The `guard` command (and `guardSkill()` programmatically) runs three checks:

1. **Shape** — Zod validation against `NormalizedSkillSchema`.
2. **Instruction sanitization** — scans `instructions` for forbidden patterns (`eval(`, `exec`, `rm -rf`, `sudo`, `bypass`) and redacts them. Blocked skills are rejected.
3. **Metadata integrity** — `priority` must be a number if present.

Trust levels: `trusted` (source in `trustedSources`, default `['local']`), `blocked` (source in `blockedSources`, default `['untrusted-repo']`), `unknown` (everything else).

## Contributing

- Keep changes focused — one concern per PR.
- Add tests for any new behaviour. The test suite must stay green (`pnpm test`).
- Follow the model policy below for cost-aware AI assistance.

## Model policy (cost-aware)

- Default tier for implementation and routine checks: fast/economical.
- Reserve high-cost models (Sonnet 4.5+) only for:
  - complex architecture decisions
  - critical security review
  - ambiguous conflict-resolution decisions
- Do not escalate model tier without explicit justification.

## Publishing to npm

Published packages: `priorityskills` (CLI), `@priorityskills/core`, `@priorityskills/adapters`.
`skill-priorityskills` stays private.

**Always publish with `pnpm`, never `npm publish`** — pnpm rewrites `workspace:*` dependencies to real versions; npm would publish them literally and break installs.

1. Bump the same version in `packages/{core,adapters,cli}/package.json`.
2. Verify the tarballs contain only `dist/`, `README.md`, `LICENSE`:
   ```bash
   pnpm -r --filter "./packages/{core,adapters,cli}" exec pnpm pack --dry-run
   ```
3. Smoke-test as a real consumer (CI runs the same check):
   ```bash
   mkdir -p /tmp/ps-tarballs
   for p in core adapters cli; do (cd packages/$p && pnpm pack --pack-destination /tmp/ps-tarballs); done
   bash scripts/smoke-test.sh /tmp/ps-tarballs
   ```
4. Publish in dependency order (`prepublishOnly` builds automatically):
   ```bash
   npm login
   pnpm --filter @priorityskills/core publish --access public
   pnpm --filter @priorityskills/adapters publish --access public
   pnpm --filter priorityskills publish --access public
   ```
5. Tag the release: `git tag v<version> && git push --tags`.
