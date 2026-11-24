// The dev server's config for drawing punch-list pictures (punch list #438): the repo's own config plus one
// plugin that lets a sealed lens frame take extra invented rows from window.__picExtra.
import { mergeConfig, type UserConfig } from 'vite'
import base from '../../../vite.config'

const picExtra = {
  name: 'pic-extra',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.replace(/\?.*$/, '').endsWith('/src/lib/lens/world/lensWorld.ts')) return null
    if (!code.includes('export function buildLensWorld(')) throw new Error('pic-extra: buildLensWorld not found')
    return (
      code.replace('export function buildLensWorld(', 'function __origBuildLensWorld(') +
      `
export function buildLensWorld(cfg: LensConfig, now: Date = new Date()): LensWorld {
  const w = __origBuildLensWorld(cfg, now)
  const extra = (globalThis as any).__picExtra
  if (!extra) return w
  for (const [t, rows] of Object.entries(extra.tables ?? {})) w.store.set(t, rows as Row[])
  for (const [t, rows] of Object.entries(extra.add ?? {})) w.store.set(t, [...w.store.rows(t), ...(rows as Row[])])
  const rpc: Record<string, LensRpcHandler> = { ...w.rpc }
  for (const [n, v] of Object.entries(extra.rpc ?? {})) rpc[n] = () => v
  const functions: Record<string, LensFnHandler> = { ...w.functions }
  for (const [n, v] of Object.entries(extra.functions ?? {})) functions[n] = () => v
  return { ...w, rpc, functions }
}
`
    )
  },
}

export default mergeConfig(base as UserConfig, { plugins: [picExtra], server: { hmr: false } })
