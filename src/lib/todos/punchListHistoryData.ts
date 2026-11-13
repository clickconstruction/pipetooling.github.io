import type { PackedHistory } from './punchListHistory'

/**
 * The punch list's history for the burndown on /punch-list. This file is what TypeScript and the tests read: an
 * empty history. When the app is built or served, `todoHistoryPlugin` (vite.config.ts) loads this path with every
 * change of `to-dos/` on main replayed from git instead (`scripts/todos/readTodoHistory.ts`). Nothing generated is
 * committed, and no global type declaration is needed: a change to `src/vite-env.d.ts` makes CI re-check every file,
 * and that full check ran out of the runner's memory (v2.7128).
 */
const history: PackedHistory = { shallow: false, rows: [] }

export default history
