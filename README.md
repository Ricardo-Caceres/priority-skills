PrioritySkills v1

Purpose

PrioritySkills helps discover, validate, and prioritize "skills" (small capability descriptors) in a project. It provides core logic (validation, scoring, conflict detection), adapters for local and global host discovery, and a CLI for common workflows.

Quick start

1. Install dependencies: pnpm install
2. Run tests: pnpm test
3. Build all packages: pnpm build
4. Scan project + global host skills: pnpm cli:scan

Architecture overview

- packages/core: types, validators, prioritization engine, conflict/resolution logic
- packages/adapters: local filesystem adapter (discover skills)
- packages/adapters: local filesystem adapter + global host adapter (Copilot installed plugins)
- packages/cli: user-facing commands (scan, rank, conflicts, guard)
- packages/skill-priorityskills: example skill descriptor

This repo is workspace-managed with pnpm.