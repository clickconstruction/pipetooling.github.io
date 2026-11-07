/**
 * `npm run walk` starts here (punch list #142, v2.6652). The driver, `scripts/walk/run.ts`, imports the screens' own io
 * modules, and the first of them (`src/lib/supabase.ts`) throws at load when Vite's `import.meta.env` has no
 * `VITE_SUPABASE_URL`: vite-node fills that from the checkout's own `.env` files and the process environment when it
 * starts, and never again. A worktree has no `.env` of its own, so the driver could not start there, whatever the main
 * checkout's files held (found 2026-11-07). This script reads the three keys the driver's way — the main checkout's
 * `.env` under `.env.local`, the environment over both — names a missing one and stops, else runs the driver in a
 * second vite-node with the keys in its environment, the flags passed through, the output shared, and the exit code
 * the driver's own.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { WALK_ENV_KEYS, missingKeyWords } from '../../src/lib/walk/walkEnv'
import { mainCheckoutRoot, readEnvFiles } from './env'

const layered = readEnvFiles(mainCheckoutRoot(), process.env)
const missing = missingKeyWords(layered)
if (missing) {
  console.error(missing)
  process.exit(2)
}
const env: Record<string, string | undefined> = { ...process.env }
for (const key of WALK_ENV_KEYS) env[key] = layered.env[key]
const viteNode = resolve(process.cwd(), 'node_modules', '.bin', 'vite-node')
const driver = resolve(process.cwd(), 'scripts', 'walk', 'run.ts')
const child = spawnSync(viteNode, [driver, ...process.argv.slice(2)], { stdio: 'inherit', env })
if (child.error) {
  console.error(`The walk could not start: ${child.error.message}`)
  process.exit(1)
}
process.exit(child.status ?? 1)
