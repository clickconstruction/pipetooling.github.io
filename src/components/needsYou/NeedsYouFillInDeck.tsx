import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserRole } from '../../hooks/useAuth'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { NEEDS_YOU_ACTION_BG, NEEDS_YOU_ACTION_FG, NEEDS_YOU_RAIL, NEEDS_YOU_WALK_TINT } from '../../lib/dashboard/needsYouPalette'
import {
  FILL_IN_KIND_WORDS,
  fillInDoneWords,
  fillInKindPositionWords,
  fillInOrder,
  fillInProgressWords,
  fillInStartIndex,
  pushFillInHandled,
  type FillInHandled,
  type FillInKind,
} from '../../lib/needsYou/fillIn'
import {
  EMPTY_LOST_BID_DECISION,
  LOST_BID_CATEGORY_CHIPS,
  lostBidDecisionReady,
  lostBidTrailWords,
  lostBidWrites,
  type LostBidDecision,
  type LostBidFillInRow,
} from '../../lib/needsYou/fillInLostBids'
import { lostBidFillInIo } from '../../lib/needsYou/fillInLostBidsIo'
import { emptyVehicleDecision, vehicleDecisionReady, vehicleTrailWords, vehicleWrites, type VehicleDecision } from '../../lib/needsYou/fillInVehicles'
import { vehicleFillInIo } from '../../lib/needsYou/fillInVehiclesIo'
import { EMPTY_JOB_ACCOUNT_DECISION, jobAccountDecisionReady, jobAccountTrailWords, jobAccountWrites, type JobAccountDecision } from '../../lib/needsYou/fillInJobAccounts'
import { jobAccountFillInIo } from '../../lib/needsYou/fillInJobAccountsIo'
import { JobAccountFields } from './JobAccountFields'
import { suggestLossCategoryFromNote } from '../../lib/bidLossCategories'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { FillInIo, FillInRow } from '../../hooks/useFillInRows'
import { VehicleFields } from './VehicleFields'

/**
 * Fill them in (v2.5774, punch list #145, PR 2): the deck over the rows behind the Needs you
 * lines an assistant clears with a few fields. One row at a time, worst first: the row's
 * sentence, what the app already knows, the fields for its kind, **Save and next**, **Skip**,
 * the door to the record for what the fields do not cover. Saved rows collect in a trail
 * under the card with Undo; skipped rows go to the back and the trail brings them back. The
 * end says what was saved by kind and offers the station's Mark. The shell is this file; a
 * kind is its kernel (`lib/needsYou/fillIn<Kind>.ts`), its io and its fields component below.
 */
export type NeedsYouFillInDeckProps = {
  rows: FillInRow[]
  loading: boolean
  userId: string | undefined
  role: UserRole | null
  /** Open on the first row of this kind (a line's **Fill them in** button); null opens on the first row. */
  startKind: FillInKind | null
  /** A saved row leaves the list at once; Undo puts it back. */
  onRowSaved: (row: FillInRow) => void
  onRowRestored: (row: FillInRow) => void
  /** Back to Cards. */
  onExit: () => void
  /** The station's Mark, offered at the end. */
  onMarkUpToDate?: () => void
  io?: FillInIo
}

const DEFAULT_IO: FillInIo = { lostBids: lostBidFillInIo, vehicles: vehicleFillInIo, jobAccounts: jobAccountFillInIo }

type Handled = FillInHandled<FillInRow> & { undo: (() => Promise<void>) | null }

/** The kernel's one-per-row rule, with the undo closure riding along. */
function pushHandled(trail: readonly Handled[], entry: Handled): Handled[] {
  const kept = pushFillInHandled(trail, entry)
  return kept.map((h) => (h.row.key === entry.row.key ? entry : (trail.find((t) => t.row.key === h.row.key) ?? { ...h, undo: null })))
}

const chipStyle = (active: boolean, bg?: string, fg?: string): CSSProperties => ({
  padding: '0.3rem 0.75rem',
  minHeight: 32,
  borderRadius: 999,
  border: active ? '1px solid var(--text-strong)' : '1px solid var(--border-strong)',
  background: active ? 'var(--text-strong)' : (bg ?? 'var(--surface)'),
  color: active ? 'var(--bg-page, var(--surface))' : (fg ?? 'var(--text-base)'),
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
})

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0.45rem 0.6rem',
  font: 'inherit',
  fontSize: '0.875rem',
}

const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }

/** The lost-bid kind's fields: six reason chips, what they said, who you talked to. A note suggests a chip until one is tapped. */
function LostBidFields({ decision, onChange, disabled }: { decision: LostBidDecision; onChange: (d: LostBidDecision) => void; disabled: boolean }) {
  const [tapped, setTapped] = useState(false)
  const suggested = !tapped ? suggestLossCategoryFromNote(decision.said) : null
  useEffect(() => {
    if (!tapped && suggested && decision.category !== suggested) onChange({ ...decision, category: suggested })
    if (!tapped && !suggested && decision.category != null && decision.said.trim() === '') onChange({ ...decision, category: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a note's suggestion lands once per note change
  }, [suggested, tapped])
  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>Why did we lose it?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="Why did we lose it?">
          {LOST_BID_CATEGORY_CHIPS.map((c) => {
            const active = decision.category === c.key
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => {
                  setTapped(true)
                  onChange({ ...decision, category: c.key })
                }}
                style={{ ...chipStyle(active, c.chipBg, c.chipFg), outline: active && suggested === c.key ? '2px dashed var(--text-link)' : undefined, outlineOffset: 2 }}
              >
                {c.label}
                {active && suggested === c.key && !tapped ? <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 500, opacity: 0.8 }}>from the note</span> : null}
              </button>
            )
          })}
        </div>
      </div>
      <label>
        <span style={labelStyle}>What they said</span>
        <textarea value={decision.said} disabled={disabled} rows={2} onChange={(e) => onChange({ ...decision, said: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} placeholder="A line or two" />
      </label>
      <label>
        <span style={labelStyle}>Who you talked to</span>
        <input value={decision.who} disabled={disabled} onChange={(e) => onChange({ ...decision, who: e.target.value })} style={inputStyle} placeholder="A name, if you called" />
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>With a name, the call goes on the bid's contact log too.</span>
      </label>
    </div>
  )
}

export function NeedsYouFillInDeck({ rows, loading, userId, role, startKind, onRowSaved, onRowRestored, onExit, onMarkUpToDate, io = DEFAULT_IO }: NeedsYouFillInDeckProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const [skippedKeys, setSkippedKeys] = useState<string[]>([])
  const [revisitKey, setRevisitKey] = useState<string | null>(null)
  const [handled, setHandled] = useState<Handled[]>([])
  const [savedKeys, setSavedKeys] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [lostBid, setLostBid] = useState<LostBidDecision>(EMPTY_LOST_BID_DECISION)
  const [vehicle, setVehicle] = useState<VehicleDecision>(() => emptyVehicleDecision(todayYmdInAppTz()))
  const [jobAccount, setJobAccount] = useState<JobAccountDecision>(EMPTY_JOB_ACCOUNT_DECISION)
  const openedOn = useRef<FillInKind | null>(startKind)

  const order = useMemo(() => fillInOrder(rows, skippedKeys), [rows, skippedKeys])
  const total = rows.length + savedKeys.length
  const saved = savedKeys.length
  const skipped = handled.filter((h) => h.how === 'skipped' && rows.some((r) => r.key === h.row.key)).length

  // The first row: the asked kind's first on open, then the deck's own order; a trail tap brings a row back.
  const startIndex = openedOn.current && handled.length === 0 && skippedKeys.length === 0 ? fillInStartIndex(order, openedOn.current) : 0
  const current = (rows.find((r) => r.key === revisitKey) ?? order[startIndex] ?? order[0]) ?? null
  const position = current ? saved + rows.findIndex((r) => r.key === current.key) + 1 : total
  const ofKind = current ? rows.filter((r) => r.kind === current.kind) : []
  const kindPosition = current ? ofKind.findIndex((r) => r.key === current.key) + 1 : 0
  const upNext = current ? order.filter((r) => r.key !== current.key).slice(0, 2) : []

  // A fresh draft for each row.
  useEffect(() => {
    setLostBid(EMPTY_LOST_BID_DECISION)
    setVehicle(emptyVehicleDecision(todayYmdInAppTz()))
    setJobAccount(EMPTY_JOB_ACCOUNT_DECISION)
  }, [current?.key])

  const ready = current?.kind === 'lost-bid' ? lostBidDecisionReady(lostBid) : current?.kind === 'vehicle' ? vehicleDecisionReady(current, vehicle) : current?.kind === 'job-account' ? jobAccountDecisionReady(jobAccount) : false

  const skip = (row: FillInRow) => {
    recordNavClick(userId, role, 'needs-you', '#fill-skip')
    setHandled((t) => pushHandled(t, { row, how: 'skipped', words: 'skipped · still on the list', undo: null }))
    setRevisitKey(null)
    openedOn.current = null
    setSkippedKeys((keys) => {
      const live = keys.filter((k) => k !== row.key && rows.some((r) => r.key === k))
      return live.length + 1 >= rows.length ? [row.key] : [...live, row.key]
    })
  }

  const save = (row: FillInRow) => {
    if (busy || !userId) return
    if (row.kind === 'lost-bid') {
      const writes = lostBidWrites(row, lostBid, { userId, nowIso: new Date().toISOString() })
      if (!writes) return
      setBusy(true)
      void (async () => {
        try {
          const { entryId } = await io.lostBids.save(writes)
          recordNavClick(userId, role, 'needs-you', '#fill-save-lost-bid')
          const words = lostBidTrailWords(writes.patch.loss_category, entryId != null)
          const undo = async () => {
            await io.lostBids.undo({ bidId: row.bidId, previous: row.previous, entryId })
          }
          setHandled((t) => pushHandled(t, { row, how: 'saved', words, undo }))
          setSavedKeys((k) => [...k, row.key])
          setRevisitKey(null)
          openedOn.current = null
          onRowSaved(row)
        } catch (e) {
          showToast(formatErrorMessage(e, 'Could not save the reason'), 'error')
        } finally {
          setBusy(false)
        }
      })()
    } else if (row.kind === 'vehicle') {
      const writes = vehicleWrites(row, vehicle, { userId })
      if (!writes) return
      setBusy(true)
      void (async () => {
        try {
          const saved = await io.vehicles.save(writes)
          recordNavClick(userId, role, 'needs-you', '#fill-save-vehicle')
          const words = vehicleTrailWords(row, writes)
          const undo = async () => {
            await io.vehicles.undo(saved)
          }
          setHandled((t) => pushHandled(t, { row, how: 'saved', words, undo }))
          setSavedKeys((k) => [...k, row.key])
          setRevisitKey(null)
          openedOn.current = null
          onRowSaved(row)
        } catch (e) {
          showToast(formatErrorMessage(e, 'Could not save the records'), 'error')
        } finally {
          setBusy(false)
        }
      })()
    } else if (row.kind === 'job-account') {
      const writes = jobAccountWrites(row, jobAccount)
      if (!writes) return
      setBusy(true)
      void (async () => {
        try {
          const saved = await io.jobAccounts.save(writes)
          recordNavClick(userId, role, 'needs-you', '#fill-save-job-account')
          const words = jobAccountTrailWords(writes, saved.flaggedInvoiceIds.length)
          const undo = async () => {
            await io.jobAccounts.undo(saved)
          }
          setHandled((t) => pushHandled(t, { row, how: 'saved', words, undo }))
          setSavedKeys((k) => [...k, row.key])
          setRevisitKey(null)
          openedOn.current = null
          onRowSaved(row)
        } catch (e) {
          showToast(formatErrorMessage(e, 'Could not save the job account'), 'error')
        } finally {
          setBusy(false)
        }
      })()
    }
  }

  const undo = (h: Handled) => {
    if (busy || !h.undo) return
    setBusy(true)
    void (async () => {
      try {
        await h.undo!()
        recordNavClick(userId, role, 'needs-you', '#fill-undo')
        setHandled((t) => t.filter((x) => x.row.key !== h.row.key))
        setSavedKeys((k) => k.filter((x) => x !== h.row.key))
        onRowRestored(h.row)
        setRevisitKey(h.row.key)
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not undo'), 'error')
      } finally {
        setBusy(false)
      }
    })()
  }

  const bar = (
    <div style={{ display: 'flex', gap: 3, marginBottom: '0.875rem' }} aria-hidden>
      {savedKeys.map((k) => (
        <div key={`s:${k}`} style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--text-green-700)', opacity: 0.55 }} />
      ))}
      {rows.map((r) => (
        <div key={r.key} style={{ flex: 1, height: 4, borderRadius: 2, background: current && r.key === current.key ? NEEDS_YOU_RAIL[r.severity] : 'var(--bg-200)' }} />
      ))}
    </div>
  )

  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
      <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>Fill them in</span>
      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{current ? fillInProgressWords(position, total, saved) : total > 0 ? `${total} of ${total}` : ''}</span>
    </div>
  )

  let body: ReactNode
  if (loading && rows.length === 0 && saved === 0) {
    body = <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>Reading the rows…</div>
  } else if (!current) {
    const savedOf = (kind: FillInKind) => handled.filter((h) => h.how === 'saved' && h.row.kind === kind).length
    const done = fillInDoneWords({ 'lost-bid': savedOf('lost-bid'), vehicle: savedOf('vehicle'), 'job-account': savedOf('job-account') }, skipped)
    body = (
      <div data-fill-in-done style={{ ...NEEDS_YOU_WALK_TINT.blue, borderRadius: 10, padding: '1.1rem 1.2rem', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Fill them in</div>
        <div style={{ fontSize: '1.1875rem', fontWeight: 700, marginBottom: '0.25rem' }}>{done.title}</div>
        {done.lines.map((l) => (
          <div key={l} style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {l}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
          {onMarkUpToDate ? (
            <button type="button" onClick={() => { onMarkUpToDate(); onExit() }} style={{ background: NEEDS_YOU_ACTION_BG.blue, color: NEEDS_YOU_ACTION_FG.blue, border: 'none', borderRadius: 6, padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              Mark Needs you up to date
            </button>
          ) : null}
          <button type="button" onClick={onExit} style={{ background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.55rem 1.1rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            Back to Cards
          </button>
        </div>
      </div>
    )
  } else {
    const words = FILL_IN_KIND_WORDS[current.kind]
    body = (
      <>
        <div data-fill-in-row={current.key} style={{ ...NEEDS_YOU_WALK_TINT[current.severity], borderRadius: 10, padding: '1.1rem 1.2rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            <span>{words.kicker}</span>
            <span style={{ marginLeft: 'auto', letterSpacing: 0, textTransform: 'none', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fillInKindPositionWords(current.kind, kindPosition, ofKind.length)}</span>
          </div>
          <div data-fill-in-title style={{ fontSize: '1.1875rem', fontWeight: 700, marginBottom: '0.35rem', lineHeight: 1.25 }}>{current.title}</div>
          {current.knows.length > 0 ? (
            <ul style={{ margin: '0 0 0.9rem', padding: 0, listStyle: 'none', color: 'var(--text-700)', fontSize: '0.8125rem', display: 'grid', gap: 2 }}>
              {current.knows.map((k) => (
                <li key={k}>
                  <span style={{ color: 'var(--text-muted)' }}>· </span>
                  {k}
                </li>
              ))}
            </ul>
          ) : null}
          {current.kind === 'lost-bid' ? <LostBidFields decision={lostBid} onChange={setLostBid} disabled={busy} /> : null}
          {current.kind === 'vehicle' ? <VehicleFields row={current} decision={vehicle} onChange={setVehicle} disabled={busy} /> : null}
          {current.kind === 'job-account' ? <JobAccountFields houseName={current.houseName} decision={jobAccount} onChange={setJobAccount} disabled={busy} /> : null}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.9rem' }}>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => save(current)}
              style={{ background: 'var(--text-strong)', color: 'var(--bg-page, var(--surface))', border: 'none', borderRadius: 6, padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: 600, cursor: ready && !busy ? 'pointer' : 'default', opacity: ready && !busy ? 1 : 0.45 }}
            >
              Save and next
            </button>
            {rows.length > 1 ? (
              <button type="button" disabled={busy} onClick={() => skip(current)} style={{ background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.55rem 1.1rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                Skip
              </button>
            ) : null}
            <button type="button" onClick={() => navigate(current.doorHref)} style={{ marginLeft: 'auto', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer' }}>
              {current.doorLabel} ›
            </button>
          </div>
        </div>
        {upNext.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {upNext.map((r, i) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '0.15rem 0.4rem' }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: NEEDS_YOU_RAIL[r.severity], flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  {i === 0 ? 'Next: ' : 'Then: '}
                  {r.title}
                  {i === 1 && rows.length > 3 ? ` · and ${rows.length - 3} more` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div data-needs-you-fill-in>
      {header}
      {total > 0 ? bar : null}
      {body}
      {handled.length > 0 ? (
        <div data-fill-in-trail style={{ display: 'grid', gap: 6, margin: '0 0 0.6rem' }}>
          {handled.map((h) => {
            const open = h.how === 'skipped' && rows.some((r) => r.key === h.row.key)
            const savedLine = h.how === 'saved'
            return (
              <div
                key={h.row.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.5rem 0.75rem',
                  border: `1px solid ${savedLine ? 'var(--border-green)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: savedLine ? 'var(--bg-green-tint)' : 'var(--bg-subtle)',
                  fontSize: '0.8125rem',
                  color: savedLine ? 'var(--text-green-800)' : 'var(--text-muted)',
                }}
              >
                <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: savedLine ? 'var(--text-green-700)' : 'var(--border-400)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0 }}>
                  {savedLine ? '✓' : '›'}
                </span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <strong>{h.row.title}</strong> · {h.words}
                </span>
                {savedLine && h.undo ? (
                  <button type="button" disabled={busy} onClick={() => undo(h)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-green)', background: 'var(--surface)', color: 'var(--text-green-800)', cursor: 'pointer', flexShrink: 0 }}>
                    Undo
                  </button>
                ) : open ? (
                  <button type="button" onClick={() => setRevisitKey(h.row.key)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', flexShrink: 0 }}>
                    Back to it
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export type { LostBidFillInRow }
