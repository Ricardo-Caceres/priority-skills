Development guide — PrioritySkills

Setup

- Install pnpm (https://pnpm.io/)
- At repo root: pnpm install

Useful scripts

- pnpm test        — run all workspace tests
- pnpm build       — build TypeScript in all packages
- pnpm cli:scan    — build CLI and run `scan` against the current directory
- pnpm --filter @priorityskills/cli build — build only the CLI

Testing & CI

- Tests live in package tests (packages/*/test) and are run with Vitest.
- To run tests for a single package: pnpm --filter @priorityskills/core test

Adding skills

- Add skill manifests (skill.json or SKILL.md) under a folder and use `pnpm cli:scan` to discover.

Contributing

- Follow existing coding style. Keep changes focused and add tests for new behavior.
- Use clear commit messages. The root contains a script to run all tests before release.

Release notes

- v1 is local-only. Do not publish to npm from this repository yet.