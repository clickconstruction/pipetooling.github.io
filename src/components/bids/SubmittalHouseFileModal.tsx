/**
 * Read its parts (2026-10-01): what a house's submittal file says, beside the rows, before
 * anything is written. One card per tag in the file: its parts with their pages — the same part
 * as the takeoff's, a different part in its place (pick which), or a part nobody priced — and
 * the row's parts the file does not carry, each kept as order only or taken off. A tag no row
 * carries can be added as a row; a row found by its parts can take the file's tag. Use the
 * file's parts hands the choices back; the tab writes them.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { defaultFileChoice, fileMatchCounts, type FileTagChoice, type FileTagMatch, type HouseFileRead } from '../../lib/submittals/houseFileParts'
import { formatPages } from '../../lib/submittals/submittalRevision'
import { splitPartLabel, type SubmittalPartRow } from '../../lib/submittals/itemParts'

const quiet: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.45rem 0.85rem', minHeight: 36, background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const select: CSSProperties = { padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text-strong)', maxWidth: '100%', minWidth: 0 }
const CHIP: Record<'same' | 'different' | 'not_priced' | 'off', { bg: string; fg: string }> = {
  same: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)' },
  different: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-700)' },
  not_priced: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)' },
  off: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
}
const chip = (k: keyof typeof CHIP): CSSProperties => ({ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 999, background: CHIP[k].bg, color: CHIP[k].fg, whiteSpace: 'nowrap' })

export function SubmittalHouseFileModal({
  fileName,
  read,
  matches,
  rows,
  partsByItem,
  houses,
  houseId: givenHouseId,
  busy = false,
  onApply,
  onClose,
}: {
  fileName: string
  read: HouseFileRead
  matches: FileTagMatch[]
  rows: ReadonlyArray<{ id: string; tag: string }>
  partsByItem: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>>
  houses: ReadonlyArray<{ id: string; name: string }>
  houseId: string | null
  busy?: boolean
  onApply: (choices: FileTagChoice[], houseId: string | null) => void
  onClose: () => void
}) {
  const [choices, setChoices] = useState<FileTagChoice[]>(() => matches.map(defaultFileChoice))
  const [houseId, setHouseId] = useState<string | null>(givenHouseId)
  const counts = useMemo(() => fileMatchCounts(matches), [matches])
  const rowTag = (id: string) => rows.find((r) => r.id === id)?.tag.trim() || 'a row with no tag'
  const set = (i: number, patch: Partial<FileTagChoice>) => setChoices((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)))
  const using = choices.filter((c, i) => c.use && (matches[i]!.itemIds.length > 0 || c.addRow)).length

  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem 0.6rem', overflowY: 'auto' }}>
      <div role="dialog" aria-modal="true" aria-label={`What ${fileName} says`} style={{ background: 'var(--surface)', borderRadius: 10, width: '100%', maxWidth: 880, boxShadow: '0 10px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 2rem)' }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: '1rem 1.1rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>What {fileName} says</h3>
            <button type="button" aria-label="Close" disabled={busy} onClick={onClose} style={{ ...btn, minHeight: 32, padding: '0.2rem 0.6rem' }}>×</button>
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-base)', lineHeight: 1.45 }}>
            The file lists {read.parts.length} parts under {read.tags.length} tags, each with its pages. Each row can take the file’s parts. The takeoff’s part stays beside it as what was priced.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }} data-testid="house-file-counts">
            <span style={chip('same')}>{counts.same} the same</span>
            <span style={chip('different')}>{counts.different} a different part</span>
            <span style={chip('not_priced')}>{counts.not_priced} not priced</span>
            <label style={{ ...quiet, display: 'inline-flex', gap: '0.35rem', alignItems: 'center', marginLeft: 'auto' }}>
              Bought from
              <select aria-label="The house this file is from" value={houseId ?? ''} onChange={(e) => setHouseId(e.target.value || null)} style={select}>
                <option value="">No house</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.6rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {matches.map((m, i) => {
            const c = choices[i]!
            const first = m.itemIds[0]
            const rowParts = first ? partsByItem.get(first) ?? [] : []
            const usedElsewhere = (k: number) => new Set(Object.entries(c.inPlaceOf).filter(([idx, v]) => Number(idx) !== k && v).map(([, v]) => v as string))
            const inPlaceIds = new Set(Object.values(c.inPlaceOf).filter((v): v is string => !!v))
            const notInFile = rowParts.filter((p) => !inPlaceIds.has(p.id))
            return (
              <section key={m.tag} style={{ border: `1px solid ${c.use ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 8, padding: '0.6rem 0.75rem', opacity: c.use ? 1 : 0.6, display: 'flex', flexDirection: 'column', gap: '0.45rem' }} data-testid="house-file-tag">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem', alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                    <input type="checkbox" checked={c.use} disabled={busy} onChange={(e) => set(i, { use: e.target.checked })} aria-label={`Use ${m.tag}`} />
                    {m.tag}
                  </label>
                  <span style={quiet} data-testid="house-file-destination">
                    {m.how === 'tag' ? `→ ${m.itemIds.map(rowTag).join(' and ')}` : m.how === 'parts' ? `→ the row ${rowTag(first!)}, by its parts` : 'no row yet'}
                  </span>
                  {m.how === 'parts' ? (
                    <label style={{ ...quiet, display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input type="checkbox" checked={c.rename} disabled={busy || !c.use} onChange={(e) => set(i, { rename: e.target.checked })} /> call it {m.tag}
                    </label>
                  ) : null}
                  {m.itemIds.length === 0 ? (
                    <label style={{ ...quiet, display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input type="checkbox" checked={c.addRow} disabled={busy || !c.use} onChange={(e) => set(i, { addRow: e.target.checked })} /> add it as a row
                    </label>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {m.parts.map((p, k) => {
                    const target = c.inPlaceOf[k] ?? null
                    const kind: keyof typeof CHIP = target ? (p.kind === 'same' && p.rowPart?.id === target ? 'same' : 'different') : 'not_priced'
                    const { head, words } = splitPartLabel(p.file.label)
                    const taken = usedElsewhere(k)
                    return (
                      <div key={k} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.6rem', alignItems: 'center', padding: '0.35rem 0', borderTop: k > 0 ? '1px solid var(--border)' : 'none' }} data-testid="house-file-part">
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 16rem' }}>
                          <b style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{head}</b>
                          {words ? <span style={{ ...quiet, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.file.label}>{words}</span> : null}
                        </span>
                        <span style={{ ...quiet, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatPages(p.file.pages)}</span>
                        <span style={chip(kind)} data-testid="house-file-kind">{kind === 'same' ? 'the same' : kind === 'different' ? 'in place of' : 'not priced'}</span>
                        {rowParts.length > 0 ? (
                          <select aria-label={`What ${head} takes the place of`} value={target ?? ''} disabled={busy || !c.use} onChange={(e) => set(i, { inPlaceOf: { ...c.inPlaceOf, [k]: e.target.value || null } })} style={{ ...select, flex: '0 1 15rem' }}>
                            <option value="">nothing, a part of its own</option>
                            {rowParts.filter((rp) => !taken.has(rp.id)).map((rp) => (
                              <option key={rp.id} value={rp.id}>{splitPartLabel(rp.label).head}{rp.on_submittal ? '' : ' · order only'}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                {notInFile.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px dashed var(--border-strong)', paddingTop: '0.4rem' }} data-testid="house-file-not-in-file">
                    <span style={quiet}>On the row, not in the file</span>
                    {notInFile.map((p) => {
                      const keep = c.keep[p.id] ?? false
                      return (
                        <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.6rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8125rem', color: keep ? 'var(--text-base)' : 'var(--text-faint)', textDecoration: keep ? 'none' : 'line-through', minWidth: 0, flex: '1 1 14rem', overflowWrap: 'anywhere' }}>{splitPartLabel(p.label).head}</span>
                          <span role="group" aria-label={`${splitPartLabel(p.label).head}: keep or take off`} style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                            <button type="button" aria-pressed={keep} disabled={busy || !c.use} onClick={() => set(i, { keep: { ...c.keep, [p.id]: true } })} style={{ padding: '0.3rem 0.6rem', border: 'none', font: 'inherit', fontSize: '0.75rem', cursor: 'pointer', background: keep ? 'var(--text-strong)' : 'var(--surface)', color: keep ? 'var(--surface)' : 'var(--text-muted)', fontWeight: keep ? 700 : 500 }}>Keep, order only</button>
                            <button type="button" aria-pressed={!keep} disabled={busy || !c.use} onClick={() => set(i, { keep: { ...c.keep, [p.id]: false } })} style={{ padding: '0.3rem 0.6rem', border: 'none', borderLeft: '1px solid var(--border-strong)', font: 'inherit', fontSize: '0.75rem', cursor: 'pointer', background: !keep ? '#b42318' : 'var(--surface)', color: !keep ? 'white' : 'var(--text-muted)', fontWeight: !keep ? 700 : 500 }}>Take off</button>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>

        <div style={{ padding: '0.7rem 1.1rem 0.9rem', borderTop: '1px solid var(--border-strong)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...quiet, flex: '1 1 16rem' }}>A part that is not what was priced shows the takeoff’s part beside it. Say why on the row with Edit.</span>
          <span style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" disabled={busy} onClick={onClose} style={btn}>Cancel</button>
            <button type="button" disabled={busy || using === 0} onClick={() => onApply(choices, houseId)} style={{ ...btnPrimary, opacity: using === 0 ? 0.5 : 1 }} data-testid="house-file-apply">
              {busy ? 'Writing…' : `Use the file’s parts on ${using} row${using === 1 ? '' : 's'}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
