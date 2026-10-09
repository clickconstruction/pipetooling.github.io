import { useEffect, useMemo, useState } from 'react'
import { loadLienDeskSignatureInk } from '../lib/jobs/lienDeskSignatureInk'

type InkItem = { id: string; signer_signature_mode?: string | null; signer_signature_storage_path?: string | null }

/**
 * The drawn signatures' ink by desk item (v2.5082), for the run's papers: only the items signed by
 * hand are read; a pressed signature needs no file. The map is what `buildLienDeskRun` takes as
 * `opts.inks`; while a read is still on its way the item is absent and the paper shows the name in
 * the cursive face, as the release did before v2.4335.
 */
export function useLienDeskSignatureInks(items: ReadonlyArray<InkItem> | null | undefined, enabled = true): ReadonlyMap<string, string | null> {
  const wanted = useMemo(() => {
    if (!enabled || !items) return [] as Array<{ id: string; path: string }>
    const out: Array<{ id: string; path: string }> = []
    for (const it of items) {
      const path = (it.signer_signature_storage_path ?? '').trim()
      if (it.signer_signature_mode === 'draw' && path) out.push({ id: it.id, path })
    }
    return out
  }, [items, enabled])
  const key = wanted.map((w) => `${w.id}:${w.path}`).join('|')
  const [inks, setInks] = useState<ReadonlyMap<string, string | null>>(() => new Map())
  useEffect(() => {
    let alive = true
    if (wanted.length === 0) {
      setInks(new Map())
      return
    }
    void Promise.all(wanted.map(async (w) => [w.id, await loadLienDeskSignatureInk({ signer_signature_mode: 'draw', signer_signature_storage_path: w.path })] as const)).then((pairs) => {
      if (alive) setInks(new Map(pairs))
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return inks
}
