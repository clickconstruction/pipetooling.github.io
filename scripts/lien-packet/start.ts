/**
 * `npm run lien:packet` starts here (v2.7930). The runner, `scripts/lien-packet/run.ts`, imports the Lien desk's own
 * modules, and the first of them (`src/lib/supabase.ts`) throws at load when Vite's `import.meta.env` has no
 * `VITE_SUPABASE_URL`: vite-node fills that when it starts and never again, and a worktree has no `.env.local` of its
 * own. So this reads the three keys the way the walk does (`scripts/walk/env.ts`: the main checkout's `.env` under
 * `.env.local`, the environment over both), names a missing one and stops, else runs the runner in a second vite-node
 * with the keys in its environment, the flags passed through, and the runner's own exit code.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { WALK_ENV_KEYS, missingKeys } from '../../src/lib/walk/walkEnv'
import { mainCheckoutRoot, readEnvFiles } from '../walk/env'

const layered = readEnvFiles(mainCheckoutRoot(), process.env)
const missing = missingKeys(layered.env)
if (missing.length > 0) {
  console.error(`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing. The preview signs in as the dev with the keys in the main checkout’s .env.local (read: ${layered.read.join(', ') || 'no file'}).`)
  process.exit(2)
}
const env: Record<string, string | undefined> = { ...process.env }
for (const key of WALK_ENV_KEYS) env[key] = layered.env[key]
// Where the command was typed, so a relative --out reads from there and not from the package's folder.
env.LIEN_PACKET_CWD = process.env.INIT_CWD || process.cwd()
const viteNode = resolve(process.cwd(), 'node_modules', '.bin', 'vite-node')
const runner = resolve(process.cwd(), 'scripts', 'lien-packet', 'run.ts')
const child = spawnSync(viteNode, [runner, ...process.argv.slice(2)], { stdio: 'inherit', env })
if (child.error) {
  console.error(`The preview could not start: ${child.error.message}`)
  process.exit(1)
}
process.exit(child.status ?? 1)
