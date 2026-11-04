# @priorityskills/adapters

Skill discovery adapters for [PrioritySkills](https://github.com/Ricardo-Caceres/priority-skills).

- `LocalFilesystemAdapter` — scans `.github/skills/` and `skills/` in a project
- `GlobalHostAdapter` — scans `~/.copilot/installed-plugins`
- `normalizedSkillFactory` — converts raw discoveries into `NormalizedSkill` objects

```bash
npm install @priorityskills/adapters
```

```js
const { LocalFilesystemAdapter, normalizedSkillFactory } = require('@priorityskills/adapters')

const raw = await new LocalFilesystemAdapter().discover(process.cwd())
const skills = raw.map(normalizedSkillFactory)
```

MIT © Ricardo Cáceres
