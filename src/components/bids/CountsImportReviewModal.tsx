import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import {
  buildCountsImportWritePlan,
  countsImportWritePlanIsEmpty,
  defaultCountsImportChoices,
  describeCountsImportWritePlan,
  type CountsImportChoices,
  type CountsImportReview,
} from '../../lib/bids/countsImportReview'
import { COUNT_UNIT_LABEL, effectiveCountUnit, formatUnitTotal } from '../../lib/bids/countRowUnit'
import { ModalShell } from './ModalShell'

/**
 * The import review (v2.4686): what "Import from /Tooling" opens when the bid already has count
 * rows. Four piles — Changed, New, Missing, Same (folded) — each with a bucket switch first and a
 * tick per row second, the rename / move proposals at the head of Missing, what each row carries
 * downstream beside it, and one Apply. Pure over its props: the kernel sorts, the tab writes.
 */

/** What hangs off an existing count row — the parts and prices an Update keeps and a Remove drops. */
export type CountRowAttachedWork = { parts: number; priced: boolean }

export type CountsImportReviewModalProps = {
  review: CountsImportReview
  existingCount: number
  attached: ReadonlyMap<string, CountRowAttachedWork>
  busy: boolean
  error?: string | null
  onApply: (choices: CountsImportChoices) => void
  onCancel: () => void
}

const CARD: CSSProperties = { background: 'var(--surface)', padding: 0, borderRadius: 10, maxWidth: 880, width: '96%', maxHeight: 'min(92vh, 100%)', overflow: 'auto', display: 'flex', flexDirection: 'column' }
const SEG_BTN: CSSProperties = { padding: '2px 10px', fontSize: '0.78rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-700)' }
const BUCKET_HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 1.1rem', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)', fontSize: '0.84rem', flexWrap: 'wrap' }
const CELL: CSSProperties = { padding: '0.35rem 0.6rem', borderTop: '1px solid var(--border)', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '0.84rem' }
const NUM: CSSProperties = { ...CELL, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const MUTED: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }

function scopeWords(scope: CountsImportReview['scope']): string {
  if (scope === 'all') return 'every sheet and every layer'
  if (scope === 'partial') return 'part of the takeoff'
  return 'no scope heading'
}

function Seg({ value, options, onChange, disabled }: { value: string; options: Array<{ key: string; label: string; tone?: 'blue' | 'red' | 'green' }>; onChange: (key: string) => void; disabled: boolean }) {
  return (
    <span role="group" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
      {options.map((o) => {
        const on = o.key === value
        const bg = o.tone === 'red' ? '#dc2626' : o.tone === 'green' ? '#059669' : '#2563eb'
        return (
          <button key={o.key} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(o.key)} style={{ ...SEG_BTN, ...(on ? { background: bg, color: '#fff', fontWeight: 600 } : {}) }}>
            {o.label}
          </button>
        )
      })}
    </span>
  )
}

function Tick({ on, tone, label, onChange, disabled }: { on: boolean; tone?: 'red'; label: string; onChange: (next: boolean) => void; disabled: boolean }) {
  return <input type="checkbox" aria-label={label} checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: tone === 'red' ? '#dc2626' : '#2563eb', width: 15, height: 15, margin: 0, cursor: disabled ? 'default' : 'pointer' }} />
}

function UnitChip({ row }: { row: { fixture: string | null; unit?: string | null } }) {
  return <span style={{ display: 'inline-block', marginLeft: 4, fontSize: '0.68rem', fontWeight: 600, padding: '0 5px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>{COUNT_UNIT_LABEL[effectiveCountUnit(row)]}</span>
}

function attachedWords(w: CountRowAttachedWork | undefined, fate: 'stays' | 'lost'): ReactNode {
  if (!w || (w.parts === 0 && !w.priced)) return <span style={MUTED}>nothing attached</span>
  const bits: string[] = []
  if (w.parts > 0) bits.push(`${w.parts} part${w.parts === 1 ? '' : 's'}`)
  if (w.priced) bits.push('priced')
  if (fate === 'stays') return <span style={MUTED}>{bits.join(' · ')} · stays</span>
  return <span style={{ ...MUTED, color: 'var(--text-red-700)' }}>{bits.join(' · ')} · <b>lost on remove</b></span>
}

export function CountsImportReviewModal({ review, existingCount, attached, busy, error, onApply, onCancel }: CountsImportReviewModalProps) {
  const [choices, setChoices] = useState<CountsImportChoices>(() => defaultCountsImportChoices(review))
  const [showSame, setShowSame] = useState(false)
  const plan = useMemo(() => buildCountsImportWritePlan(review, choices), [review, choices])
  const nothing = countsImportWritePlanIsEmpty(plan)
  const changes = plan.updates.length + plan.inserts.length + plan.deletes.length

  const set = (fn: (c: CountsImportChoices) => void) =>
    setChoices((prev) => {
      const next: CountsImportChoices = { update: new Set(prev.update), add: new Set(prev.add), remove: new Set(prev.remove), pair: new Set(prev.pair) }
      fn(next)
      return next
    })
  const updateMode = review.changed.length > 0 && choices.update.size === review.changed.length ? 'all' : choices.update.size === 0 ? 'none' : 'some'
  const addMode = review.added.length > 0 && choices.add.size === review.added.length ? 'all' : choices.add.size === 0 ? 'none' : 'some'
  const removeMode = review.missing.length > 0 && choices.remove.size === review.missing.length ? 'all' : choices.remove.size === 0 ? 'none' : 'some'
  const pairedMissing = new Set(review.pairs.filter((_, i) => choices.pair.has(i)).map((p) => p.missing.id))
  const pairedAdded = new Set(review.pairs.filter((_, i) => choices.pair.has(i)).map((p) => p.incoming))

  return (
    <ModalShell zIndex={1004} cardStyle={CARD}>
      <div role="dialog" aria-label="Review the import" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', padding: '0.9rem 1.1rem 0.6rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Review the import</h2>
            <p style={{ ...MUTED, margin: '2px 0 0' }}>
              {review.changed.length + review.added.length + review.same.length} rows copied · {scopeWords(review.scope)} · {existingCount} row{existingCount === 1 ? '' : 's'} on this bid
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" title="Close" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {review.changed.length > 0 && (
          <section data-testid="counts-review-changed">
            <div style={BUCKET_HEAD}>
              <b>Changed</b> <span style={MUTED}>{review.changed.length}</span>
              <span style={MUTED}>same name and group, a different count, page or group</span>
              <span style={{ flex: 1 }} />
              <Seg value={updateMode} disabled={busy} onChange={(k) => set((c) => { c.update = new Set(k === 'all' ? review.changed.map((x) => x.existing.id) : []) })} options={[{ key: 'all', label: 'Update all' }, { key: 'none', label: 'Leave as is' }]} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {review.changed.map((c) => {
                  const on = choices.update.has(c.existing.id)
                  const unit = effectiveCountUnit(c.existing)
                  const up = c.incoming.count > c.existing.count
                  return (
                    <tr key={c.existing.id} style={{ opacity: on ? 1 : 0.55 }}>
                      <td style={{ ...CELL, paddingLeft: '1.1rem', width: 24 }}><Tick on={on} disabled={busy} label={`Update ${c.existing.fixture}`} onChange={(next) => set((ch) => { if (next) ch.update.add(c.existing.id); else ch.update.delete(c.existing.id) })} /></td>
                      <td style={{ ...CELL, whiteSpace: 'normal', minWidth: 140 }}>{c.existing.fixture}</td>
                      <td style={{ ...CELL, ...MUTED }}>{c.groupChanged ? <><s>{c.existing.group_tag || '—'}</s> → <b>{c.incoming.group_tag || '—'}</b></> : c.existing.group_tag}</td>
                      <td style={NUM}>{c.countChanged ? <s style={{ color: 'var(--text-muted)' }}>{formatUnitTotal(c.existing.count, unit)}</s> : formatUnitTotal(c.existing.count, unit)}</td>
                      <td style={{ ...CELL, color: 'var(--text-faint)', textAlign: 'center', width: 20 }}>→</td>
                      <td style={NUM}>
                        {c.countChanged ? <b style={{ color: up ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{formatUnitTotal(c.incoming.count, unit)}</b> : formatUnitTotal(c.incoming.count, unit)}
                        <UnitChip row={c.existing} />
                      </td>
                      <td style={{ ...CELL, ...MUTED }}>{c.pageChanged ? <>page <s>{c.existing.page || '—'}</s> → <b>{c.incoming.page || '—'}</b></> : c.existing.page ? `page ${c.existing.page}` : ''}</td>
                      <td style={{ ...CELL, textAlign: 'right', paddingRight: '1.1rem' }}>{attachedWords(attached.get(c.existing.id), 'stays')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {review.added.length > 0 && (
          <section data-testid="counts-review-added">
            <div style={BUCKET_HEAD}>
              <b>New</b> <span style={MUTED}>{review.added.length}</span>
              <span style={MUTED}>in the copy, not on the bid</span>
              <span style={{ flex: 1 }} />
              <Seg value={addMode} disabled={busy} onChange={(k) => set((c) => { c.add = new Set(k === 'all' ? review.added.map((_, i) => i) : []) })} options={[{ key: 'all', label: 'Add all' }, { key: 'none', label: 'Skip all' }]} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {review.added.map((a, i) => {
                  const paired = pairedAdded.has(a)
                  const on = choices.add.has(i)
                  return (
                    <tr key={i} style={{ opacity: on && !paired ? 1 : 0.55 }}>
                      <td style={{ ...CELL, paddingLeft: '1.1rem', width: 24 }}><Tick on={on} disabled={busy || paired} label={`Add ${a.fixture}`} onChange={(next) => set((ch) => { if (next) ch.add.add(i); else ch.add.delete(i) })} /></td>
                      <td style={{ ...CELL, whiteSpace: 'normal', minWidth: 140 }}>{a.fixture} <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 999, background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }}>new</span></td>
                      <td style={{ ...CELL, ...MUTED }}>{a.group_tag}</td>
                      <td style={NUM} />
                      <td style={CELL} />
                      <td style={NUM}>{formatUnitTotal(a.count, a.unit)}<UnitChip row={a} /></td>
                      <td style={{ ...CELL, ...MUTED }}>{a.page ? `page ${a.page}` : ''}</td>
                      <td style={{ ...CELL, textAlign: 'right', paddingRight: '1.1rem', ...MUTED }}>{paired ? 'paired below' : review.ambiguousAdded.has(a) ? 'this name is on the bid more than once' : 'goes to the end of the sheet'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {review.missing.length > 0 && (
          <section data-testid="counts-review-missing">
            <div style={BUCKET_HEAD}>
              <b>Missing</b> <span style={MUTED}>{review.missing.length}</span>
              <span style={MUTED}>on the bid, not in the copy</span>
              <span style={{ flex: 1 }} />
              <Seg value={removeMode} disabled={busy} onChange={(k) => set((c) => { c.remove = new Set(k === 'all' ? review.missing.map((m) => m.id) : []) })} options={[{ key: 'all', label: 'Remove all', tone: 'red' }, { key: 'none', label: 'Keep all' }]} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {review.pairs.map((p, i) => {
                  const on = choices.pair.has(i)
                  return (
                    <tr key={`pair-${i}`} style={{ background: 'var(--bg-violet-100)' }}>
                      <td style={{ ...CELL, paddingLeft: '1.1rem', whiteSpace: 'normal' }} colSpan={6}>
                        <span style={{ color: 'var(--text-violet-800)' }}>
                          {p.kind === 'renamed'
                            ? <>Looks like a rename: <b>{p.missing.fixture}</b> ({p.missing.group_tag ? `${p.missing.group_tag} · ` : ''}{formatUnitTotal(p.missing.count, effectiveCountUnit(p.missing))}) left and <b>{p.incoming.fixture}</b> ({p.incoming.group_tag ? `${p.incoming.group_tag} · ` : ''}{formatUnitTotal(p.incoming.count, p.incoming.unit)}) arrived.</>
                            : <>Looks like a move: <b>{p.missing.fixture}</b> left <b>{p.missing.group_tag || 'no group'}</b> and arrived in <b>{p.incoming.group_tag || 'no group'}</b> ({formatUnitTotal(p.incoming.count, p.incoming.unit)}).</>}
                        </span>
                      </td>
                      <td style={{ ...CELL, textAlign: 'right', paddingRight: '1.1rem' }} colSpan={2}>
                        <button type="button" aria-pressed={on} disabled={busy} onClick={() => set((c) => { if (on) c.pair.delete(i); else c.pair.add(i) })} style={{ fontSize: '0.78rem', padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border-violet)', background: on ? 'var(--text-violet-700)' : 'var(--surface)', color: on ? '#fff' : 'var(--text-violet-800)', cursor: 'pointer', fontWeight: 600 }}>
                          {on ? '✓ Same row' : p.kind === 'renamed' ? 'Same row, renamed' : 'Same row, moved'}
                        </button>
                        {on && <button type="button" disabled={busy} onClick={() => set((c) => { c.pair.delete(i) })} style={{ ...SEG_BTN, marginLeft: 6, color: 'var(--text-violet-800)' }}>Not the same</button>}
                      </td>
                    </tr>
                  )
                })}
                {review.missing.map((m) => {
                  const paired = pairedMissing.has(m.id)
                  const on = choices.remove.has(m.id)
                  const unit = effectiveCountUnit(m)
                  return (
                    <tr key={m.id} style={{ opacity: paired ? 0.45 : 1 }}>
                      <td style={{ ...CELL, paddingLeft: '1.1rem', width: 24 }}><Tick on={on} tone="red" disabled={busy || paired} label={`Remove ${m.fixture}`} onChange={(next) => set((ch) => { if (next) ch.remove.add(m.id); else ch.remove.delete(m.id) })} /></td>
                      <td style={{ ...CELL, whiteSpace: 'normal', minWidth: 140 }}>{m.fixture} <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 999, background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }}>gone</span></td>
                      <td style={{ ...CELL, ...MUTED }}>{m.group_tag}</td>
                      <td style={NUM}>{formatUnitTotal(m.count, unit)}<UnitChip row={m} /></td>
                      <td style={CELL} />
                      <td style={NUM} />
                      <td style={{ ...CELL, ...MUTED }}>{m.page ? `page ${m.page}` : ''}</td>
                      <td style={{ ...CELL, textAlign: 'right', paddingRight: '1.1rem' }}>{paired ? <span style={MUTED}>kept as the same row</span> : review.ambiguousMissing.has(m.id) ? <span style={MUTED}>this name is on the bid more than once</span> : attachedWords(attached.get(m.id), on ? 'lost' : 'stays')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p style={{ ...MUTED, margin: 0, padding: '0.4rem 1.1rem 0.7rem' }}>
              {review.scope === 'all'
                ? <>This copy is <b style={{ color: 'var(--text-700)' }}>every sheet and every layer</b>, so a row CountTooling no longer has is probably gone on purpose. A This Canvas Only copy would start on Keep all.</>
                : review.scope === 'partial'
                  ? <>This copy is <b style={{ color: 'var(--text-700)' }}>part of the takeoff</b>, so a row it leaves out may still be real. It starts on Keep all.</>
                  : <>This paste has no CountTooling heading, so a row it leaves out may still be real. It starts on Keep all.</>}
            </p>
          </section>
        )}

        {review.same.length > 0 && (
          <section data-testid="counts-review-same">
            <div style={{ ...BUCKET_HEAD, background: 'transparent' }}>
              <span style={MUTED}><b style={{ color: 'var(--text-700)' }}>{review.same.length}</b> row{review.same.length === 1 ? ' matches' : 's match'} exactly. Nothing to do.</span>
              <button type="button" onClick={() => setShowSame((v) => !v)} style={{ ...SEG_BTN, color: 'var(--text-link)', padding: 0 }}>{showSame ? 'Hide them' : 'Show them'}</button>
            </div>
            {showSame && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {review.same.map((s) => (
                    <tr key={s.existing.id} style={{ opacity: 0.7 }}>
                      <td style={{ ...CELL, paddingLeft: '1.1rem', width: 24 }} />
                      <td style={{ ...CELL, whiteSpace: 'normal', minWidth: 140 }}>{s.existing.fixture}</td>
                      <td style={{ ...CELL, ...MUTED }}>{s.existing.group_tag}</td>
                      <td style={NUM}>{formatUnitTotal(s.existing.count, effectiveCountUnit(s.existing))}<UnitChip row={s.existing} /></td>
                      <td style={{ ...CELL, ...MUTED }} colSpan={4}>{s.existing.page ? `page ${s.existing.page}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {error && <p style={{ color: 'var(--text-red-700)', fontSize: '0.85rem', margin: 0, padding: '0.5rem 1.1rem 0' }}>{error}</p>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--surface)' }}>
          <span data-testid="counts-review-summary" style={{ ...MUTED, flex: 1 }}>{describeCountsImportWritePlan(plan, review.same.length)}{nothing ? '' : ' The source link moves to this copy.'}</span>
          <button type="button" onClick={onCancel} disabled={busy} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={() => onApply(choices)} disabled={busy || nothing} style={{ padding: '0.5rem 1rem', background: nothing ? 'var(--border-strong)' : '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: busy || nothing ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {busy ? 'Applying…' : `Apply ${changes} change${changes === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
