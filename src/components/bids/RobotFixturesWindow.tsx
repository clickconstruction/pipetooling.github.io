import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ModalShell } from './ModalShell'
import { formatUnitTotal, isCountUnit, type CountUnit } from '../../lib/bids/countRowUnit'
import {
  bucketHead,
  FIXTURES_NOT_YET_WORDS,
  fixtureButtonWords,
  fixtureSetLineWords,
  priceEachWords,
  reviewRobotFixtures,
  scheduleLineWords,
  SCOPE_FLAG_WORDS,
  SET_ASIDE_REASON_WORDS,
  SET_ASIDE_REASONS,
  type FixturePull,
  type FixturePullRow,
  type FixtureReview,
  type FixtureReviewRow,
  type FixtureTicks,
  type HerCountRow,
  type SetAsideReason,
} from '../../lib/bids/robotFixtures'
import { SET_ASIDE_WORDS } from '../../lib/bids/robotFixtureShade'

/**
 * The robot fixtures window (punch list #221, PR 3): the fixtures the robot found on the bid's set, against her
 * count, in the import review's shape — buckets, a tick per row, every row opening into the plan text that backs
 * it, one button that names its count and its price. A row she does not want is set aside with a reason, never
 * deleted, and comes back with Put back. Pure over its props: the kernel sorts (`robotFixtures.ts`), the tab
 * writes through the five RPCs.
 */
export type RobotFixturesWindowProps = {
  bidLabel: string
  /** The newest pull; null before the robot seals (the window says when it opens). */
  pull: FixturePull | null
  rows: FixturePullRow[]
  /** Her count rows on the active version. */
  herRows: HerCountRow[]
  /** The set's name through `planSetsForBid`, when the bid names its sets. */
  setName: string | null
  /** The read's time in the company's words, formatted by the tab. */
  readWhen: string | null
  busy: boolean
  error?: string | null
  phone: boolean
  onTake: (ticks: FixtureTicks, review: FixtureReview) => void
  onSetAside: (rowIds: string[], reason: SetAsideReason | null) => void
  onPutBack: (rowIds: string[]) => void
  /** Open sheet: the Plans panel at that page; null when the bid has no readable set. */
  onOpenSheet: ((page: number) => void) | null
  onOpenPlans: (() => void) | null
  onClose: () => void
}

const CARD: CSSProperties = { background: 'var(--surface)', padding: 0, borderRadius: 10, maxWidth: 960, width: '96%', maxHeight: 'min(92vh, 100%)', overflow: 'auto', display: 'flex', flexDirection: 'column' }
const PHONE_CARD: CSSProperties = { ...CARD, borderRadius: 0, maxWidth: 'none', width: '100%', maxHeight: '100%', height: '100%' }
const SEG_BTN: CSSProperties = { padding: '2px 10px', fontSize: '0.78rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-700)', font: 'inherit' }
const BUCKET_HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 1.1rem', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)', fontSize: '0.84rem', flexWrap: 'wrap' }
const CELL: CSSProperties = { padding: '0.35rem 0.6rem', borderTop: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.84rem' }
const NUM: CSSProperties = { ...CELL, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const MUTED: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const TAG: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap' }
const LINK: CSSProperties = { font: 'inherit', fontSize: '0.78rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }
const ROBOT_BLUE = '#2563eb'

const unitOf = (r: FixtureReviewRow): CountUnit => (isCountUnit(r.row.unit) ? r.row.unit : 'ea')

function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'aside' | 'robot'; children: ReactNode }) {
  const style: CSSProperties =
    tone === 'ok'
      ? { color: 'var(--text-green-700)', borderColor: 'var(--border-green)', background: 'var(--bg-green-100)' }
      : tone === 'warn'
        ? { color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)', background: 'var(--bg-amber-100)' }
        : tone === 'robot'
          ? { color: 'var(--text-blue-800)', borderColor: 'var(--border-blue)', background: 'var(--bg-blue-tint)' }
          : { color: 'var(--text-700)', borderColor: 'var(--border-strong)', background: 'var(--bg-muted)' }
  return <span style={{ display: 'inline-block', borderRadius: 999, padding: '0 7px', fontSize: '0.7rem', fontWeight: 600, border: '1px solid', whiteSpace: 'nowrap', marginRight: 4, ...style }}>{children}</span>
}

function Seg({ value, options, onChange, disabled }: { value: string; options: Array<{ key: string; label: string; tone?: 'blue' | 'gray' }>; onChange: (key: string) => void; disabled: boolean }) {
  return (
    <span role="group" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(o.key)} style={{ ...SEG_BTN, ...(on ? { background: o.tone === 'gray' ? 'var(--text-muted)' : ROBOT_BLUE, color: '#fff', fontWeight: 600 } : {}) }}>
            {o.label}
          </button>
        )
      })}
    </span>
  )
}

function Tick({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (next: boolean) => void; disabled: boolean }) {
  return <input type="checkbox" aria-label={label} checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: ROBOT_BLUE, width: 15, height: 15, margin: 0, verticalAlign: 'middle' }} />
}

/** The chip on a row: sure, or what the robot wants a look at, or the plans giving it away. */
function RowChip({ r }: { r: FixtureReviewRow }) {
  if (r.scope) return <><Chip tone="ok">sure</Chip><Chip tone="aside">{SCOPE_FLAG_WORDS[r.scope]}</Chip></>
  return r.sure ? <Chip tone="ok">sure</Chip> : <Chip tone="warn">want a look</Chip>
}

function ReasonChips({ onPick, disabled }: { onPick: (reason: SetAsideReason | null) => void; disabled: boolean }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={MUTED}>Why?</span>
      {SET_ASIDE_REASONS.map((k) => (
        <button key={k} type="button" disabled={disabled} onClick={() => onPick(k)} style={{ ...SEG_BTN, border: '1px solid var(--border-strong)', borderRadius: 999, padding: '1px 8px' }}>
          {SET_ASIDE_REASON_WORDS[k]}
        </button>
      ))}
      <button type="button" disabled={disabled} onClick={() => onPick(null)} style={{ ...LINK, marginLeft: 4 }}>no reason</button>
    </span>
  )
}

export function RobotFixturesWindow({ bidLabel, pull, rows, herRows, setName, readWhen, busy, error, phone, onTake, onSetAside, onPutBack, onOpenSheet, onOpenPlans, onClose }: RobotFixturesWindowProps) {
  const review = useMemo(() => reviewRobotFixtures(rows, herRows), [rows, herRows])
  const [add, setAdd] = useState<Set<string>>(() => new Set(review.rows.filter((r) => r.startTicked).map((r) => r.row.id)))
  const [update, setUpdate] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [showSame, setShowSame] = useState(false)
  const [showTaken, setShowTaken] = useState(false)
  const [showAside, setShowAside] = useState(false)
  const [asking, setAsking] = useState<string | null>(null)
  // A fresh pull (a take, a set-aside, a put-back) starts from its own ticks.
  useEffect(() => {
    setAdd(new Set(review.rows.filter((r) => r.startTicked).map((r) => r.row.id)))
    setUpdate(new Set())
    setAsking(null)
  }, [review])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ticks: FixtureTicks = { add, update }
  const button = fixtureButtonWords(ticks, review, herRows.length)
  const toggle = (set: Set<string>, id: string, next: boolean) => {
    const s = new Set(set)
    if (next) s.add(id)
    else s.delete(id)
    return s
  }
  const newAll = review.byBucket.new.length > 0 && review.byBucket.new.every((r) => add.has(r.row.id)) ? 'all' : add.size === 0 ? 'none' : 'some'
  const updAll = review.byBucket.on_count.length > 0 && review.byBucket.on_count.every((r) => update.has(r.row.id)) ? 'all' : update.size === 0 ? 'none' : 'some'

  const backingRow = (r: FixtureReviewRow) => (
    <tr key={`${r.row.id}-back`}>
      <td style={{ ...CELL, borderTop: 0, paddingTop: 0 }} />
      <td style={{ ...CELL, borderTop: 0, paddingTop: 0, background: 'var(--bg-subtle)' }} colSpan={phone ? 3 : 6}>
        <div style={{ display: 'grid', gap: 6, padding: '2px 0 8px', fontSize: '0.8rem' }}>
          <div><b>The robot's check:</b> {r.check}</div>
          {r.backing.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '6rem minmax(0, 1fr) auto', gap: 8, alignItems: 'start' }}>
              <span style={{ ...MUTED, textTransform: 'uppercase', letterSpacing: '.05em', fontSize: '0.68rem', fontWeight: 700 }}>
                {b.kind}{b.sheet ? <span style={{ display: 'block', textTransform: 'none', letterSpacing: 0, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--text-700)' }}>{b.sheet}{b.page ? ` · p${b.page}` : ''}</span> : null}
              </span>
              <span style={{ color: 'var(--text-700)' }}>
                “{b.text}”{b.flags.map((f) => <span key={f} style={{ marginLeft: 6, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', borderRadius: 4, padding: '1px 5px', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>{f}</span>)}
              </span>
              {onOpenSheet && b.page ? <button type="button" onClick={() => onOpenSheet(b.page!)} style={LINK}>Open sheet</button> : <span />}
            </div>
          ))}
          {r.sheets.length > 0 ? (
            <div style={MUTED}>
              Counted on {r.sheets.map((s, i) => (
                <span key={i}>{i > 0 ? ', ' : ''}{s.sheet ?? (s.page ? `page ${s.page}` : 'a sheet')}{s.count != null ? ` · ${formatUnitTotal(s.count, unitOf(r))}` : ''}{onOpenSheet && s.page ? <> <button type="button" onClick={() => onOpenSheet(s.page!)} style={LINK}>open</button></> : null}</span>
              ))}.
            </div>
          ) : null}
          {r.bucket === 'new' || r.bucket === 'on_count' || r.bucket === 'taken' ? (
            asking === r.row.id ? (
              <ReasonChips disabled={busy} onPick={(reason) => { setAsking(null); onSetAside([r.row.id], reason) }} />
            ) : (
              <div><button type="button" disabled={busy} onClick={() => setAsking(r.row.id)} style={LINK}>{SET_ASIDE_WORDS.button}</button> <span style={MUTED}>{SET_ASIDE_WORDS.why}</span></div>
            )
          ) : null}
        </div>
      </td>
    </tr>
  )

  const fixtureRow = (r: FixtureReviewRow, tick: ReactNode, countCell: ReactNode) => {
    const isOpen = open.has(r.row.id)
    const sched = scheduleLineWords(r.row)
    return [
      <tr key={r.row.id} data-testid={`robot-fixture-${r.row.tag}`} style={{ opacity: r.bucket === 'set_aside' ? 0.7 : 1 }}>
        <td style={{ ...CELL, paddingLeft: '1.1rem', width: 24 }}>{tick}</td>
        <td style={CELL}>
          <span style={TAG}>{r.row.tag}</span>
          {phone ? <> <RowChip r={r} /></> : null}
          <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{r.row.name}</div>
          {sched ? <div style={MUTED}>{sched}</div> : null}
          <div style={MUTED}>{r.words}{phone && r.unitPrice != null ? ` ${priceEachWords(r.unitPrice)}.` : ''}</div>
        </td>
        {countCell}
        {!phone ? <td style={{ ...CELL, ...MUTED, whiteSpace: 'nowrap' }}>{r.sheets.map((s) => `${s.sheet ?? `p${s.page ?? '?'}`}${s.count != null ? ` · ${s.count}` : ''}`).join(', ') || '—'}</td> : null}
        {!phone ? <td style={{ ...NUM, color: 'var(--text-700)' }}>{r.unitPrice != null ? priceEachWords(r.unitPrice) : <span style={MUTED}>no price</span>}</td> : null}
        {!phone ? <td style={{ ...CELL, whiteSpace: 'nowrap' }}><RowChip r={r} /></td> : null}
        <td style={{ ...CELL, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {r.bucket === 'set_aside' ? (
            <>
              {r.reason ? <Chip tone="aside">{r.reason}</Chip> : null}
              <button type="button" disabled={busy} onClick={() => onPutBack([r.row.id])} style={LINK}>{SET_ASIDE_WORDS.putBack}</button>
            </>
          ) : (
            <button type="button" onClick={() => setOpen((s) => toggle(s, r.row.id, !isOpen))} aria-expanded={isOpen} style={{ ...LINK, color: 'var(--text-700)' }}>{isOpen ? '▾ close' : '▸ text'}</button>
          )}
        </td>
      </tr>,
      isOpen ? backingRow(r) : null,
    ]
  }

  const countOf = (r: FixtureReviewRow) => formatUnitTotal(r.count, unitOf(r))

  return (
    <ModalShell zIndex={1004} cardStyle={phone ? PHONE_CARD : CARD}>
      <div role="dialog" aria-label={`Fixtures the robot found on ${bidLabel}`} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', padding: '0.9rem 1.1rem 0.6rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Fixtures the robot found on {bidLabel}</h2>
            <p style={{ ...MUTED, margin: '2px 0 0' }} data-testid="robot-fixtures-set-line">
              {pull ? fixtureSetLineWords({ pull, setName, when: readWhen, review, herRowCount: herRows.length }) : 'The robot is still working on this set.'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" title="Close" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {!pull ? (
          <>
            <p style={{ margin: 0, padding: '0.5rem 1.1rem 1rem', fontSize: '0.9rem', color: 'var(--text-700)' }}>{FIXTURES_NOT_YET_WORDS}</p>
            <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem 1.1rem', borderTop: '1px solid var(--border)' }}>
              {onOpenPlans ? <button type="button" onClick={onOpenPlans} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Open the Plans panel</button> : null}
              <button type="button" onClick={onClose} style={{ marginLeft: 'auto', padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Close</button>
            </div>
          </>
        ) : (
          <>
            {review.byBucket.new.length > 0 && (
              <section data-testid="robot-fixtures-new">
                <div style={BUCKET_HEAD}>
                  <b>{bucketHead('new', review.byBucket.new.length)}</b>
                  <span style={MUTED}>not on your count</span>
                  <span style={{ flex: 1 }} />
                  <Seg value={newAll} disabled={busy} onChange={(k) => setAdd(new Set(k === 'all' ? review.byBucket.new.map((r) => r.row.id) : []))} options={[{ key: 'all', label: 'Add all' }, { key: 'none', label: 'None' }]} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {review.byBucket.new.flatMap((r) => fixtureRow(r, <Tick on={add.has(r.row.id)} disabled={busy} label={`Add ${r.row.tag}`} onChange={(next) => setAdd((s) => toggle(s, r.row.id, next))} />, <td style={NUM}><b>{countOf(r)}</b></td>))}
                  </tbody>
                </table>
              </section>
            )}

            {review.byBucket.on_count.length > 0 && (
              <section data-testid="robot-fixtures-on-count">
                <div style={BUCKET_HEAD}>
                  <b>{bucketHead('on_count', review.byBucket.on_count.length)}</b>
                  <span style={MUTED}>the same fixture, a different count</span>
                  <span style={{ flex: 1 }} />
                  <Seg value={updAll} disabled={busy} onChange={(k) => setUpdate(new Set(k === 'all' ? review.byBucket.on_count.map((r) => r.row.id) : []))} options={[{ key: 'all', label: 'Update' }, { key: 'none', label: 'Keep mine', tone: 'gray' }]} />
                  <span style={{ ...MUTED, flexBasis: '100%' }}>Update keeps your parts and prices on the row. Starts on Keep mine.</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {review.byBucket.on_count.flatMap((r) => fixtureRow(r, <Tick on={update.has(r.row.id)} disabled={busy} label={`Update ${r.hers?.fixture ?? r.row.tag}`} onChange={(next) => setUpdate((s) => toggle(s, r.row.id, next))} />, <td style={NUM}><s style={{ color: 'var(--text-muted)' }}>{formatUnitTotal(Number(r.hers?.count ?? 0), unitOf(r))}</s> → <b>{countOf(r)}</b></td>))}
                  </tbody>
                </table>
              </section>
            )}

            {review.byBucket.same.length > 0 && (
              <section data-testid="robot-fixtures-same">
                <div style={{ ...BUCKET_HEAD, background: 'transparent' }}>
                  <span style={MUTED}><b style={{ color: 'var(--text-700)' }}>{review.byBucket.same.length}</b> on your count with the same number.</span>
                  <button type="button" onClick={() => setShowSame((v) => !v)} style={LINK}>{showSame ? 'Hide them' : 'Show them'}</button>
                </div>
                {showSame && <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{review.byBucket.same.flatMap((r) => fixtureRow(r, null, <td style={NUM}>{countOf(r)}</td>))}</tbody></table>}
              </section>
            )}

            {review.byBucket.taken.length > 0 && (
              <section data-testid="robot-fixtures-taken">
                <div style={{ ...BUCKET_HEAD, background: 'transparent' }}>
                  <span style={MUTED}><b style={{ color: 'var(--text-700)' }}>{review.byBucket.taken.length}</b> on your count from the robot.</span>
                  <button type="button" onClick={() => setShowTaken((v) => !v)} style={LINK}>{showTaken ? 'Hide them' : 'Show them'}</button>
                </div>
                {showTaken && <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{review.byBucket.taken.flatMap((r) => fixtureRow(r, null, <td style={NUM}>{countOf(r)}</td>))}</tbody></table>}
              </section>
            )}

            {review.byBucket.set_aside.length > 0 && (
              <section data-testid="robot-fixtures-set-aside">
                <div style={{ ...BUCKET_HEAD, background: 'transparent' }}>
                  <span style={MUTED}><b style={{ color: 'var(--text-700)' }}>{bucketHead('set_aside', review.byBucket.set_aside.length)}</b> · kept here with your reason, never deleted.</span>
                  <button type="button" onClick={() => setShowAside((v) => !v)} style={LINK}>{showAside ? 'Hide them' : 'Show them'}</button>
                </div>
                {showAside && <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{review.byBucket.set_aside.flatMap((r) => fixtureRow(r, null, <td style={NUM}>{countOf(r)}</td>))}</tbody></table>}
              </section>
            )}

            {error && <p style={{ color: 'var(--text-red-700)', fontSize: '0.85rem', margin: 0, padding: '0.5rem 1.1rem 0' }}>{error}</p>}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--surface)' }}>
              <button type="button" onClick={() => onTake(ticks, review)} disabled={busy || button.dead} data-testid="robot-fixtures-take" style={{ padding: '0.5rem 1rem', background: button.dead ? 'var(--border-strong)' : ROBOT_BLUE, color: '#fff', border: 'none', borderRadius: 4, cursor: button.dead ? 'default' : 'pointer', font: 'inherit', fontWeight: 600 }}>
                {busy ? 'Adding…' : button.button}
              </button>
              <span data-testid="robot-fixtures-foot" style={{ ...MUTED, flex: 1, minWidth: 200 }}>{button.foot}</span>
              <button type="button" onClick={onClose} disabled={busy} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
