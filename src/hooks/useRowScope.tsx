import { useMemo, useState, type ReactNode } from 'react'
import { ROW_KIND_WORDS, type RowKind } from '../lib/bids/rowKinds'

/** What a scoped tool needs to know about a row. */
export type ScopedRow = {
  id: string
  name: string
  kind: RowKind
  tags: ReadonlyArray<string>
}

export type ScopePreset<R extends ScopedRow> = { key: string; words: string; keep: (r: R) => boolean }
export type RowScope = { type: 'preset'; key: string } | { type: 'tag'; tag: string } | { type: 'kind'; kind: RowKind }

/**
 * The scope the Workbench's tools share (punch list #128): a few presets (every row, the rows
 * still on the bid's number, the taxed rows…), then the bid's tags and kinds as chips, each
 * with its count. Returns the rows the scope keeps and the picker to draw.
 */
export function useRowScope<R extends ScopedRow>(rows: ReadonlyArray<R>, presets: ReadonlyArray<ScopePreset<R>>, initial: RowScope): { scope: RowScope; candidates: R[]; picker: ReactNode } {
  const [scope, setScope] = useState<RowScope>(initial)
  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows])
  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))], [rows])
  const candidates = useMemo(() => {
    if (scope.type === 'preset') {
      const p = presets.find((x) => x.key === scope.key)
      return p ? rows.filter(p.keep) : []
    }
    if (scope.type === 'tag') return rows.filter((r) => r.tags.includes(scope.tag))
    return rows.filter((r) => r.kind === scope.kind)
  }, [scope, rows, presets])
  const radio = (key: string, checked: boolean, pick: () => void, words: string, count: number) => (
    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer', padding: '0.15rem 0' }}>
      <input type="radio" name="row-scope" checked={checked} onChange={pick} style={{ margin: 0 }} />
      <span style={{ flex: 1 }}>{words}</span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </label>
  )
  const chipRow = (label: string, items: Array<{ key: string; words: string; on: boolean; pick: () => void; count: number }>) =>
    items.length === 0 ? null : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', paddingLeft: '1.5rem' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem' }}>{label}</span>
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            aria-pressed={it.on}
            onClick={it.pick}
            style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: it.on ? 700 : 500, padding: '0.05rem 0.55rem', borderRadius: 999, border: `1px solid ${it.on ? 'var(--text-strong)' : 'var(--border-strong)'}`, background: it.on ? 'var(--text-strong)' : 'var(--surface)', color: it.on ? 'var(--surface)' : 'var(--text-700)', cursor: 'pointer' }}
          >
            {it.words} <span style={{ opacity: 0.7 }}>{it.count}</span>
          </button>
        ))}
      </div>
    )
  const picker = (
    <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.15rem' }}>
      {presets.map((p) => radio(p.key, scope.type === 'preset' && scope.key === p.key, () => setScope({ type: 'preset', key: p.key }), p.words, rows.filter(p.keep).length))}
      {chipRow(
        'a tag',
        tags.map((tag) => ({ key: tag, words: tag, on: scope.type === 'tag' && scope.tag === tag, pick: () => setScope({ type: 'tag', tag }), count: rows.filter((r) => r.tags.includes(tag)).length })),
      )}
      {chipRow(
        'a kind',
        kinds.map((k) => ({ key: k, words: ROW_KIND_WORDS[k], on: scope.type === 'kind' && scope.kind === k, pick: () => setScope({ type: 'kind', kind: k }), count: rows.filter((r) => r.kind === k).length })),
      )}
    </div>
  )
  return { scope, candidates, picker }
}

