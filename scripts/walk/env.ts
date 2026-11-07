/**
 * Where the walk's keys come from (punch list #142, v2.6030 and v2.6652): the main checkout's `.env` with `.env.local`
 * laid over it, then the process environment over both. Node only, no app import, so `scripts/walk/start.ts` can read
 * the keys before anything that needs them loads; the pure half is `src/lib/walk/walkEnv.ts`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { WALK_ENV_FILES, layerEnv, layerProcessEnv, type LayeredEnv } from '../../src/lib/walk/walkEnv'

/** The main checkout's root: a worktree resolves there through its common git dir, as claim-version.ts does. */
export function mainCheckoutRoot(): string {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()
  return dirname(isAbsolute(common) ? common : resolve(process.cwd(), common))
}

/**
 * The main checkout's `.env` with `.env.local` laid over it (found item 1), then the process environment over both
 * (v2.6652: a scheduled run has no files, a worktree no `.env` of its own); a file that is not there is listed, not an
 * error.
 */
export function readEnvFiles(root: string, processEnv: Readonly<Record<string, string | undefined>> = {}): LayeredEnv {
  const files = layerEnv(
    WALK_ENV_FILES.map((name) => {
      const path = resolve(root, name)
      return { name: path, text: existsSync(path) ? readFileSync(path, 'utf8') : null }
    }),
  )
  return layerProcessEnv(files, processEnv)
}
