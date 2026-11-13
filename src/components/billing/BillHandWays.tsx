import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  BILL_HAND_WAY_LABEL_MAX,
  cleanHandWayLabel,
  handWayAddProblem,
  handWayAddedWords,
  handWayBringBackProblem,
  handWayCountWords,
  handWayMove,
  handWayNameProblem,
  handWayTakeOffProblem,
  handWayTakenOffWords,
  liveBillHandWays,
  retiredBillHandWays,
  type BillHandWay,
} from '../../lib/billing/billHandWays'
import { addBillHandWay, moveBillHandWays, renameBillHandWay, setBillHandWayOnList } from '../../lib/billing/billsSentIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import ResponsiveModalShell from '../ResponsiveModalShell'

/**
 * The list under *How the bill went* on Bills sent (punch list #340, PR 3; the owner picked the chips, 2026-11-13).
 *
 * `BillHandWayPicker` is the form's first field: every way on the list as a chip, one press to pick. When the list
 * is the office's own (`canEdit`: it was read from `bill_hand_ways`), the last chip is **＋ Add a way**, which types a
 * new way in place, and **Edit list** opens `BillHandWaysWindow`: rename, move up or down, take off, bring back.
 * While the list could not be read the form offers the four ways kept in code and neither press is drawn, since
 * there is no list to change.
 *
 * Every refusal is said before the database is asked (`handWay…Problem` in `lib/billing/billHandWays.ts`). A change
 * saves when pressed; the window's **Done** only closes it. A record already made keeps the words it was made with
 * (`source_snapshot.how_label`), so nothing pressed here rewords a line on the list of bills.
 */

/** The list as the form holds it: the ways, whether they can be changed, and the read that fetches them again. */
export interface BillHandWaysCtl {
  ways: ReadonlyArray<BillHandWay>
  /** True when the ways were read from the office's own list. False on the four kept in code. */
  canEdit: boolean
  reload: () => Promise<void>
}

/** A press a thumb can hit. */
const THUMB = 44

const quiet: CSSProperties = { font: 'inherit', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
const box: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0, boxSizing: 'border-box' }
const hint: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem' }

function wayChip(picked: boolean, phone: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: phone ? '0.875rem' : '0.8125rem',
    padding: '0.25rem 0.7rem',
    minHeight: phone ? 40 : undefined,
    borderRadius: 999,
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: picked ? 700 : 500,
    border: `1px solid ${picked ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: picked ? 'var(--text-strong)' : 'var(--surface)',
    color: picked ? 'var(--surface)' : 'var(--text-700)',
  }
}

function goPress(dead: boolean, phone: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: phone ? '0.875rem' : '0.8125rem',
    fontWeight: 700,
    padding: phone ? '0 0.9rem' : '0.35rem 0.8rem',
    minHeight: phone ? THUMB : undefined,
    borderRadius: phone ? 8 : 6,
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
    cursor: dead ? 'default' : 'pointer',
    background: dead ? DEAD_PRESS_FILL : '#2563eb',
    color: dead ? DEAD_PRESS_TEXT : '#fff',
  }
}

export function BillHandWayPicker({ ctl, value, onPick }: { ctl: BillHandWaysCtl; value: string; onPick: (key: string) => void }) {
  const phone = useIsMobile()
  const { showToast } = useToastContext()
  const [adding, setAdding] = useState(false)
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const live = liveBillHandWays(ctl.ways)
  const problem = handWayAddProblem(typed, ctl.ways)
  const closeAdder = () => {
    setAdding(false)
    setTyped('')
  }
  const add = async () => {
    if (problem || saving) return
    setSaving(true)
    try {
      const way = await addBillHandWay(cleanHandWayLabel(typed))
      await ctl.reload()
      onPick(way.key)
      closeAdder()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The new way was not added.'), 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-700)', minWidth: 0 }} data-testid="bill-hand-ways">
      <span>How the bill went</span>
      <div role="group" aria-label="How the bill went" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', minWidth: 0 }}>
        {live.map((w) => (
          <button key={w.key} type="button" aria-pressed={value === w.key} onClick={() => onPick(w.key)} style={wayChip(value === w.key, phone)}>
            {w.label}
          </button>
        ))}
        {ctl.canEdit ? (
          <>
            <button type="button" onClick={() => setAdding(true)} aria-expanded={adding} style={{ ...wayChip(false, phone), borderStyle: 'dashed', color: 'var(--text-blue-700)', fontWeight: 600 }}>
              ＋ Add a way
            </button>
            <button type="button" onClick={() => setEditing(true)} style={{ ...quiet, fontSize: phone ? '0.875rem' : '0.8125rem', minHeight: phone ? 40 : undefined }}>
              Edit list
            </button>
          </>
        ) : null}
      </div>
      {adding ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem' }} data-testid="bill-hand-way-adder">
          <input
            type="text"
            value={typed}
            maxLength={BILL_HAND_WAY_LABEL_MAX}
            autoFocus
            onChange={(ev) => setTyped(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                void add()
              }
            }}
            placeholder="The new way, in a few words"
            aria-label="The new way"
            style={{ ...box, flex: phone ? '1 1 100%' : '1 1 12rem', ...(phone ? { minHeight: THUMB, fontSize: '1rem' } : {}) }}
          />
          <button type="button" onClick={() => void add()} disabled={!!problem || saving} style={goPress(!!problem || saving, phone)}>
            {saving ? 'Adding…' : 'Add to the list'}
          </button>
          <button type="button" onClick={closeAdder} style={{ ...quiet, fontSize: phone ? '0.875rem' : '0.8125rem', minHeight: phone ? THUMB : undefined }}>
            Cancel
          </button>
          <span style={{ ...hint, flexBasis: '100%' }}>{typed.trim() && problem ? problem : `Everyone who opens Bills sent gets the new way. ${handWayCountWords(ctl.ways)}.`}</span>
        </div>
      ) : null}
      {editing ? <BillHandWaysWindow ctl={ctl} onClose={() => setEditing(false)} /> : null}
    </div>
  )
}

const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.1rem 0.5rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }
const words: CSSProperties = { minWidth: 0, overflowWrap: 'anywhere', color: 'var(--text-strong)', fontWeight: 600 }
const under: CSSProperties = { display: 'block', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }

/** The small window that edits the list: rename, move, take off, bring back, add. */
export function BillHandWaysWindow({ ctl, onClose }: { ctl: BillHandWaysCtl; onClose: () => void }) {
  const phone = useIsMobile()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; typed: string } | null>(null)
  const [typed, setTyped] = useState('')
  const [showGone, setShowGone] = useState(false)
  const live = liveBillHandWays(ctl.ways)
  const gone = retiredBillHandWays(ctl.ways)
  const addProblem = handWayAddProblem(typed, ctl.ways)

  /** One change: saved, then the list is read again. A refusal says its reason and nothing is half shown. */
  const change = async (work: () => Promise<void>, failed: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    try {
      await work()
      await ctl.reload()
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, failed), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }
  const move = (way: BillHandWay, dir: 'up' | 'down') => {
    const moves = handWayMove(ctl.ways, way.id, dir)
    if (moves) void change(() => moveBillHandWays(moves), 'The way was not moved.')
  }
  const saveName = async (way: BillHandWay) => {
    if (!renaming || handWayNameProblem(renaming.typed, ctl.ways, way.id)) return
    const label = cleanHandWayLabel(renaming.typed)
    if (label === way.label || (await change(() => renameBillHandWay(way.id, label), 'The name was not saved.'))) setRenaming(null)
  }
  const add = async () => {
    if (addProblem) return
    if (await change(async () => void (await addBillHandWay(cleanHandWayLabel(typed))), 'The new way was not added.')) setTyped('')
  }

  const arrow = (dead: boolean): CSSProperties => ({
    font: 'inherit',
    fontSize: '0.6875rem',
    width: phone ? 40 : 26,
    height: phone ? 40 : 26,
    borderRadius: 6,
    border: `1px solid ${dead ? 'var(--border)' : 'var(--border-strong)'}`,
    background: 'var(--surface)',
    color: dead ? 'var(--border-strong)' : 'var(--text-700)',
    cursor: dead ? 'default' : 'pointer',
    padding: 0,
  })
  const small: CSSProperties = { ...quiet, fontSize: '0.8125rem', minHeight: phone ? 36 : undefined, whiteSpace: 'nowrap' }
  const actions: CSSProperties = phone ? { gridColumn: 2, display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', alignItems: 'center' } : { display: 'flex', gap: '0.75rem', alignItems: 'center' }

  return (
    <ResponsiveModalShell
      title="How a bill went: the list"
      onRequestClose={onClose}
      maxWidthDesktop={540}
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ ...hint, flex: '1 1 14rem' }} data-testid="bill-hand-ways-count">
            A bill already recorded keeps the words it was recorded with. {handWayCountWords(ctl.ways)}.
          </span>
          <button type="button" onClick={onClose} style={goPress(false, phone)}>
            Done
          </button>
        </div>
      }
    >
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-base)' }} data-testid="bill-hand-ways-window">
        <p style={{ margin: '0 0 0.25rem', color: 'var(--text-muted)' }}>Everyone who opens Bills sent picks from this list. Each change saves when you press it.</p>
        {live.map((w, i) => {
          const editing = renaming?.id === w.id ? renaming : null
          const nameProblem = editing ? handWayNameProblem(editing.typed, ctl.ways, w.id) : ''
          const offProblem = handWayTakeOffProblem(w, ctl.ways)
          const added = handWayAddedWords(w)
          return (
            <div key={w.id} style={editing ? { ...row, background: 'var(--bg-blue-tint)', margin: '0 -0.4rem', padding: '0.4rem', borderRadius: 8, borderBottom: 'none' } : row} data-testid="bill-hand-way-row">
              <div style={{ display: 'flex', gap: 2 }}>
                <button type="button" aria-label={`Move ${w.label} up`} disabled={i === 0 || busy} onClick={() => move(w, 'up')} style={arrow(i === 0)}>
                  ▲
                </button>
                <button type="button" aria-label={`Move ${w.label} down`} disabled={i === live.length - 1 || busy} onClick={() => move(w, 'down')} style={arrow(i === live.length - 1)}>
                  ▼
                </button>
              </div>
              {editing ? (
                <div style={words}>
                  <input
                    type="text"
                    value={editing.typed}
                    maxLength={BILL_HAND_WAY_LABEL_MAX}
                    autoFocus
                    aria-label={`New name for ${w.label}`}
                    onChange={(ev) => setRenaming({ id: w.id, typed: ev.target.value })}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') {
                        ev.preventDefault()
                        void saveName(w)
                      }
                    }}
                    style={{ ...box, width: '100%', ...(phone ? { minHeight: THUMB, fontSize: '1rem' } : {}) }}
                  />
                  <span style={under}>{nameProblem || `Was: ${w.label}. A bill already recorded as ${w.label} still reads ${w.label}.`}</span>
                </div>
              ) : (
                <div style={words}>
                  {w.label}
                  {added ? <span style={under}>{added}</span> : null}
                </div>
              )}
              {editing ? (
                <div style={actions}>
                  <button type="button" onClick={() => void saveName(w)} disabled={!!nameProblem || busy} style={goPress(!!nameProblem || busy, phone)}>
                    Save the name
                  </button>
                  <button type="button" onClick={() => setRenaming(null)} style={small}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={actions}>
                  <button type="button" onClick={() => setRenaming({ id: w.id, typed: w.label })} disabled={busy} style={small} aria-label={`Rename ${w.label}`}>
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void change(() => setBillHandWayOnList(w.id, false), 'The way was not taken off.')}
                    disabled={!!offProblem || busy}
                    title={offProblem || undefined}
                    style={offProblem ? { ...small, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'default' } : small}
                    aria-label={`Take ${w.label} off the list`}
                  >
                    Take off
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', padding: '0.6rem 0 0.2rem' }}>
          <input
            type="text"
            value={typed}
            maxLength={BILL_HAND_WAY_LABEL_MAX}
            onChange={(ev) => setTyped(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                void add()
              }
            }}
            placeholder="The new way, in a few words"
            aria-label="The new way"
            style={{ ...box, flex: phone ? '1 1 100%' : '1 1 12rem', ...(phone ? { minHeight: THUMB, fontSize: '1rem' } : {}) }}
          />
          <button type="button" onClick={() => void add()} disabled={!!addProblem || busy} style={goPress(!!addProblem || busy, phone)}>
            Add to the list
          </button>
          {typed.trim() && addProblem ? <span style={{ ...hint, flexBasis: '100%' }}>{addProblem}</span> : null}
        </div>
        {gone.length > 0 ? (
          <div style={{ marginTop: '0.5rem', color: 'var(--text-700)' }} data-testid="bill-hand-ways-gone">
            <b>Taken off ({gone.length})</b>{' '}
            <button type="button" onClick={() => setShowGone((v) => !v)} aria-expanded={showGone} style={small}>
              {showGone ? 'Hide' : 'Show'}
            </button>
            {showGone
              ? gone.map((w) => {
                  const backProblem = handWayBringBackProblem(w, ctl.ways)
                  return (
                    <div key={w.id} style={{ ...row, gridTemplateColumns: 'minmax(0, 1fr) auto', borderBottom: 'none' }}>
                      <div style={{ ...words, color: 'var(--text-muted)', fontWeight: 500 }}>
                        <s>{w.label}</s>
                        <span style={under}>{[handWayTakenOffWords(w), backProblem].filter(Boolean).join('. ')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void change(() => setBillHandWayOnList(w.id, true), 'The way was not brought back.')}
                        disabled={!!backProblem || busy}
                        style={backProblem ? { ...small, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'default' } : small}
                        aria-label={`Bring ${w.label} back`}
                      >
                        Bring back
                      </button>
                    </div>
                  )
                })
              : null}
          </div>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}
