# @priorityskills/core

Core engine for [PrioritySkills](https://github.com/Ricardo-Caceres/priority-skills): skill validation (Zod), 4-factor priority scoring, conflict detection and security checks.

```bash
npm install @priorityskills/core
```

```js
const { runPriorityEngine, detectSimilarities, classifyPair, validateSkill } = require('@priorityskills/core')

const results = runPriorityEngine(
  { id: 'task-1', description: 'refactor auth', language: 'ts' },
  [{ id: 'a', name: 'Auth Helper', metadata: { relevance: 0.9, trust: 0.8, languageCompatibility: ['ts'] } }],
  { topN: 5 }
)
```

See the [main README](https://github.com/Ricardo-Caceres/priority-skills#readme) for the full manifest format and scoring model.

MIT © Ricardo Cáceres
