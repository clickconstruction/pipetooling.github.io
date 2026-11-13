/**
 * Codes with no part (punch list #298 PR 2a, v2.7121; frames D and E of the card's mock-up): the Parts Book's list
 * of the supply houses' codes the book does not know yet, the most dollars first. Each row shows the line as
 * printed, how often it was bought and what was spent, the part the book offers, and four presses: **This is ‹part›**,
 * **New part in the book**, **Not a part** and **Later**. One press may take every sure offer; what it leaves is
 * listed with its reason. Teaching a code matches every past line with it and every future one. The list and the
 * offers are `codesWithNoPart.ts`; the write is the crosswalk's own `keepHouseCode`.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { batchOutcomeWords, countedLabel } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import type { BookPart } from '../../lib/materials/partMatch'
import { codesStanding, codesStandingWords, codesWithNoPart, OFFER_HOW_WORDS, offerIsSure, partsMatching, type NoPartCode } from '../../lib/materials/lines/codesWithNoPart'
import type { CodesData, CodesIo } from '../../lib/materials/lines/codesWithNoPartIo'
import { dollarsWords, quantityWords, timesWords } from '../../lib/materials/lines/whatWeBuy'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'

const CODES = ['code', 'codes'] as const
/** Rows drawn before the press that shows the rest. */
const ROWS_AT_FIRST = 50

export function CodesWithNoPartWindow({ io, onClose, onNewPart }: {
  io: CodesIo
  onClose: () => void
  /** Opens the Add Part form with the line's words as the name. The window closes first; the new part is offered here the next time, by its name. */
  onNewPart: (name: string) => void
}) {
  const [data, setData] = useState<CodesData | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [busy, setBusy] = useState(false)
  const [later, setLater] = useState<ReadonlySet<string>>(() => new Set())
  const [working, setWorking] = useState(false)
  const [outcome, setOutcome] = useState<{ line: string; failed: { row: NoPartCode; why: string }[] } | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showHeld, setShowHeld] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setData(await io.load())
      setFailure(null)
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'Could not read the codes with no part.'))
    } finally {
      setBusy(false)
    }
  }, [io])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const all = useMemo(() => (data ? codesWithNoPart(data) : []), [data])
  const rows = useMemo(() => all.filter((r) => !later.has(r.key)), [all, later])
  const sure = rows.filter(offerIsSure)
  const held = rows.filter((r) => !offerIsSure(r))
  const standing = codesStanding(all)
  const shown = showAll ? rows : rows.slice(0, ROWS_AT_FIRST)
  const more = rows.length - shown.length

  /** Keep the given codes one by one. A code that is refused is named with its reason and the rest go on. */
  async function teach(list: { row: NoPartCode; part: BookPart | null }[]) {
    setWorking(true)
    setOutcome(null)
    const failed: { row: NoPartCode; why: string }[] = []
    const done: { row: NoPartCode; part: BookPart | null }[] = []
    for (const item of list) {
      const { error } = await io.keep({ supplyHouseId: item.row.houseId, code: item.row.code, partId: item.part?.id ?? null, notAPart: item.part == null, taughtFrom: 'bill', taughtLineId: item.row.lineId })
      if (error) failed.push({ row: item.row, why: error })
      else done.push(item)
    }
    // The taught codes leave the list at once: the crosswalk the list reads gains them.
    if (done.length) {
      setData((d) => (d ? { ...d, teaches: [...d.teaches, ...done.map((x) => ({ houseId: x.row.houseId, codeKey: x.row.key.slice(x.row.houseId.length + 1), partId: x.part?.id ?? null, notAPart: x.part == null }))] } : d))
    }
    const words = batchOutcomeWords({ verb: 'Match', past: 'matched', done: done.length, failed: failed.length, noun: CODES })
    setOutcome({ line: words.line, failed })
    setPicking(null)
    setTyped('')
    setWorking(false)
  }

  const dead = sure.length === 0 || working
  const cell: CSSProperties = { padding: '0.5rem 0.55rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem', textAlign: 'left' }
  const head: CSSProperties = { ...cell, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }
  const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  const small: CSSProperties = { padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', cursor: working ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }
  const word: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: 'var(--text-base)', textDecoration: 'underline', cursor: working ? 'not-allowed' : 'pointer' }
  const pickMatches = picking ? partsMatching(data?.book ?? [], typed) : []

  return (
    <div role="dialog" aria-modal="true" aria-label="Codes with no part" data-testid="codes-no-part" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 8, width: 'min(1080px, 100%)', maxHeight: '100%', overflow: 'auto', padding: '1rem 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Codes with no part</h2>
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
            Close
          </button>
        </div>
        <p style={{ margin: 0, color: 'var(--text-700)', fontSize: '0.875rem' }}>
          A supply house prints its own code for a part on every bill. Say once which part a code is, and every bill with that code, past and to come, is that part. The most dollars are first.
        </p>

        {failure ? <OfflineRetryPanel failure={failure} onRetry={load} surface="codes-no-part" idempotent busy={busy} /> : null}

        {!data ? (
          failure ? null : <p style={{ margin: 0, color: 'var(--text-muted)' }}>Reading the bills’ lines and the parts book…</p>
        ) : (
          <>
            <div style={{ fontSize: '0.875rem' }} data-testid="codes-standing">
              <strong>{codesStandingWords(standing)}</strong>
            </div>

            {outcome ? (
              <div role="status" data-testid="codes-outcome" style={{ padding: '0.6rem 0.75rem', background: outcome.failed.length ? 'var(--bg-amber-100)' : 'var(--bg-green-100)', borderRadius: 4, fontSize: '0.875rem', display: 'grid', gap: '0.25rem' }}>
                <span>{outcome.line}</span>
                {outcome.failed.map((f) => (
                  <span key={f.row.key} style={{ color: 'var(--text-700)' }}>
                    {f.row.houseName} {f.row.code}: {f.why}
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void teach(sure.map((row) => ({ row, part: row.offer!.part })))} disabled={dead} style={{ padding: '0.45rem 0.9rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {working ? 'Matching…' : countedLabel('Match', sure.length, ['offered code', 'offered codes'])}
              </button>
              {held.length > 0 ? (
                <button type="button" onClick={() => setShowHeld((v) => !v)} aria-expanded={showHeld} style={{ ...word, fontSize: '0.8125rem' }}>
                  {held.length.toLocaleString('en-US')} left for a person {showHeld ? '▾' : '▸'}
                </button>
              ) : null}
            </div>
            {showHeld && held.length > 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }} data-testid="codes-held-why">
                The press takes a code whose part was found by its manufacturer’s number or by the same name. It leaves a code with no offer, one offered by its words alone, and one that two parts fit. Each of those takes a look and its own press below.
              </p>
            ) : null}

            {rows.length === 0 ? (
              <EmptyState compact main="Nothing waiting on a part." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={head}>As printed</th>
                      <th style={{ ...head, ...right }}>Bought</th>
                      <th style={{ ...head, ...right }}>Spent</th>
                      <th style={head}>The book offers</th>
                      <th style={head}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.key} data-testid="codes-row">
                        <td style={{ ...cell, minWidth: 220 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.description || 'No description'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {r.houseName} <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{r.code}</span>
                            {r.mfrNumber ? ` · maker’s number ${r.mfrNumber}` : ''}
                          </div>
                        </td>
                        <td style={{ ...cell, ...right }}>
                          {timesWords(r.bills)}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{quantityWords({ quantity: r.quantity, unit: r.unit, mixedUnits: false })}</div>
                        </td>
                        <td style={{ ...cell, ...right, fontWeight: 600 }}>{dollarsWords(r.spendCents)}</td>
                        <td style={{ ...cell, minWidth: 200 }}>
                          {r.offer ? (
                            <>
                              <div style={{ overflowWrap: 'anywhere' }}>{r.offer.part.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{OFFER_HOW_WORDS[r.offer.how]}</div>
                            </>
                          ) : r.rivals.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.rivals.length} parts fit. Pick one.</span>
                              {r.rivals.map((p) => (
                                <button key={p.id} type="button" disabled={working} onClick={() => void teach([{ row: r, part: p }])} aria-label={`This is ${p.name}: ${r.code}`} style={{ ...word, textAlign: 'left' }}>
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>no part fits yet</span>
                          )}
                          {picking === r.key ? (
                            <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                              <input autoFocus type="search" aria-label={`Find a part for ${r.code}`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="type a few words of the part" style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.8125rem', width: '100%', maxWidth: 280 }} />
                              {pickMatches.map((p) => (
                                <button key={p.id} type="button" disabled={working} onClick={() => void teach([{ row: r, part: p }])} aria-label={`This is ${p.name}: ${r.code}`} style={{ ...word, textAlign: 'left' }}>
                                  {p.name}
                                </button>
                              ))}
                              {typed.trim() && pickMatches.length === 0 ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The book has no part with those words. Press New part in the book.</span> : null}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {r.offer ? (
                              <button type="button" disabled={working} onClick={() => void teach([{ row: r, part: r.offer!.part }])} aria-label={`This is it: ${r.code}`} style={small}>
                                This is it
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={working}
                              onClick={() => {
                                setPicking((k) => (k === r.key ? null : r.key))
                                setTyped('')
                              }}
                              aria-label={`Pick a part: ${r.code}`}
                              style={word}
                            >
                              {r.offer ? 'Another part' : 'Pick a part'}
                            </button>
                            <button type="button" disabled={working} onClick={() => onNewPart(r.description)} aria-label={`New part in the book: ${r.code}`} style={word}>
                              New part in the book
                            </button>
                            <button type="button" disabled={working} onClick={() => void teach([{ row: r, part: null }])} aria-label={`Not a part: ${r.code}`} style={word}>
                              Not a part
                            </button>
                            <button type="button" disabled={working} onClick={() => setLater((s) => new Set(s).add(r.key))} aria-label={`Later: ${r.code}`} style={word}>
                              Later
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {more > 0 ? (
              <div>
                <button type="button" onClick={() => setShowAll(true)} style={{ ...small, cursor: 'pointer' }}>
                  Show {more.toLocaleString('en-US')} more {more === 1 ? 'code' : 'codes'}
                </button>
              </div>
            ) : null}
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Only bills whose lines add up are behind these dollars. Later sets a code aside until this window is opened again. Not a part is for a freight or a fee that prints a code.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
