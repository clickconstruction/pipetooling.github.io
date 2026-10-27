/**
 * Today's sends (v2.5595, punch list #115): the window behind the Dashboard's Needs you line. The texts the morning
 * run prepared for the office to press, and the ones the office prepared for a morning: each with the person, the
 * step and the words, Send, Edit, Not this one, Hold until a day and Stop reminding on this job; a held one says why
 * and offers the door; Send all that are ready presses the ready ones one by one and says how many went. Nothing on
 * this window sends on its own. The rules are `lib/offers/offers.ts`; the reads and writes are `lib/offers/offersIo.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { readyRows, todaysSends, TODAYS_SENDS_WORDS, type TodaysSend } from '../../lib/offers/offers'
import { supabaseOffersIo, type OffersIo } from '../../lib/offers/offersIo'

export interface TodaysSendsWindowProps {
  onClose: () => void
  /** After a send, a hold, a stop or a put-away: the Dashboard counts again. */
  onChanged?: () => void
  io?: OffersIo
}

const row: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.3rem 0.75rem', alignItems: 'start', padding: '0.65rem 0', borderTop: '1px solid var(--border)' }
const who: CSSProperties = { fontSize: '0.9375rem', fontWeight: 700 }
const step: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 400 }
const words: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.2rem 0 0', whiteSpace: 'pre-wrap' }
const box: CSSProperties = { width: '100%', minHeight: 72, fontSize: '0.875rem', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border-strong)', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginTop: '0.2rem', background: 'var(--surface)', color: 'var(--text-strong)' }
const held: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-amber-800)', margin: '0.2rem 0 0' }
const btn: CSSProperties = { minHeight: 34, padding: '0 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }
const sendBtn: CSSProperties = { ...btn, background: '#16a34a', borderColor: '#16a34a', color: 'white' }
const quiet: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', padding: '0.25rem 0.3rem' }
const actions: CSSProperties = { display: 'grid', gap: '0.3rem', justifyItems: 'end' }
const links: CSSProperties = { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }
const disabled: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }
const dateBox: CSSProperties = { fontSize: '0.8125rem', padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }

export function TodaysSendsWindow({ onClose, onChanged, io: ioProp }: TodaysSendsWindowProps) {
  const { showToast } = useToastContext()
  const io = useMemo(() => ioProp ?? supabaseOffersIo(), [ioProp])
  const [rows, setRows] = useState<TodaysSend[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  /** The office's words for a row, kept after Done editing until the press. */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  /** The row whose words are open in the box. */
  const [editing, setEditing] = useState<string | null>(null)
  const [holding, setHolding] = useState<{ id: string; until: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    io.loadOpen().then(
      (input) => live && setRows(todaysSends(input)),
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'Today’s sends could not be read.')),
    )
    return () => {
      live = false
    }
  }, [io, tick])

  const reload = () => {
    setTick((t) => t + 1)
    onChanged?.()
  }
  const bodyOf = (r: TodaysSend) => drafts[r.id] ?? r.body
  const ready = rows ? readyRows(rows) : []

  const sendOne = async (r: TodaysSend, quiet = false): Promise<boolean> => {
    setBusy(r.id)
    try {
      await io.send({ id: r.id, contactId: r.contactId, channelId: r.channelId, jobKey: r.jobKey, who: r.who }, bodyOf(r).trim())
      if (!quiet) showToast(TODAYS_SENDS_WORDS.sent(r.who), 'success')
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'The text did not go.'), 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  const sendAll = async () => {
    setBusy('all')
    let went = 0
    const failed: string[] = []
    for (const r of ready) {
      try {
        await io.send({ id: r.id, contactId: r.contactId, channelId: r.channelId, jobKey: r.jobKey, who: r.who }, bodyOf(r).trim())
        went += 1
      } catch {
        failed.push(r.who)
      }
    }
    setBusy(null)
    showToast(failed.length ? `${TODAYS_SENDS_WORDS.sentAll(went)} ${TODAYS_SENDS_WORDS.someFailed(failed.length)}` : TODAYS_SENDS_WORDS.sentAll(went), failed.length ? 'error' : 'success')
    reload()
  }

  const act = async (r: TodaysSend, what: 'not this one' | 'hold' | 'stop') => {
    setBusy(r.id)
    try {
      if (what === 'not this one') {
        await io.dismiss(r.id, 'not this one')
        showToast(TODAYS_SENDS_WORDS.putAway, 'success')
      } else if (what === 'hold' && holding?.id === r.id && holding.until) {
        await io.holdUntil({ id: r.id, contactId: r.contactId, jobKey: r.jobKey, stepKey: r.stepKey }, holding.until)
        showToast(TODAYS_SENDS_WORDS.held(holding.until), 'success')
        setHolding(null)
      } else if (what === 'stop') {
        await io.stop({ id: r.id, contactId: r.contactId, jobKey: r.jobKey, stepKey: r.stepKey }, 'Stopped from Today’s sends')
        showToast(TODAYS_SENDS_WORDS.stopped, 'success')
      }
      reload()
    } catch (e) {
      showToast(formatErrorMessage(e, 'That did not take.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <button type="button" style={btn} onClick={onClose}>
        Close
      </button>
      {ready.length > 1 ? (
        <button type="button" style={busy ? { ...sendBtn, ...disabled } : sendBtn} disabled={Boolean(busy)} onClick={() => void sendAll()} data-testid="todays-sends-all">
          {busy === 'all' ? 'Sending…' : TODAYS_SENDS_WORDS.sendAll(ready.length)}
        </button>
      ) : null}
    </div>
  )

  return (
    <ResponsiveModalShell title={TODAYS_SENDS_WORDS.title} onRequestClose={() => !busy && onClose()} footer={footer}>
      <div data-testid="todays-sends">
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>{TODAYS_SENDS_WORDS.hint}</p>
        {problem ? (
          <p role="alert" style={{ fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
            {problem}
          </p>
        ) : null}
        {rows === null && !problem ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Reading…</p> : null}
        {rows && rows.length === 0 ? <p style={{ fontSize: '0.875rem' }}>{TODAYS_SENDS_WORDS.none}</p> : null}
        {rows?.map((r) => {
          const isEditing = editing === r.id
          const stuck = Boolean(r.held) || Boolean(busy)
          return (
            <div key={r.id} style={row} data-testid="todays-send">
              <div>
                <div style={who}>
                  {r.who} <span style={step}>· {r.step}</span>
                </div>
                {isEditing ? (
                  <textarea style={box} value={bodyOf(r)} aria-label={`The text to ${r.who}`} onChange={(e) => setDrafts((m) => ({ ...m, [r.id]: e.target.value }))} data-testid="todays-send-body" />
                ) : (
                  <p style={words} data-testid="todays-send-words">
                    {bodyOf(r)}
                  </p>
                )}
                {r.held ? (
                  <p style={held} data-testid="todays-send-held">
                    Held: {r.held}
                  </p>
                ) : null}
                {r.goesOn && !r.held ? <p style={{ ...words, color: 'var(--text-muted)' }}>{TODAYS_SENDS_WORDS.goesOn(r.goesOn)}</p> : null}
                <div style={links}>
                  {!r.held ? (
                    <button type="button" style={quiet} disabled={Boolean(busy)} onClick={() => setEditing(isEditing ? null : r.id)}>
                      {isEditing ? TODAYS_SENDS_WORDS.save : TODAYS_SENDS_WORDS.edit}
                    </button>
                  ) : null}
                  <button type="button" style={quiet} disabled={Boolean(busy)} onClick={() => setHolding(holding?.id === r.id ? null : { id: r.id, until: todayYmdInAppTz() })} data-testid="todays-send-hold">
                    {TODAYS_SENDS_WORDS.holdUntil}
                  </button>
                  <button type="button" style={quiet} disabled={Boolean(busy)} onClick={() => void act(r, 'stop')} data-testid="todays-send-stop">
                    {TODAYS_SENDS_WORDS.stop}
                  </button>
                  <button type="button" style={{ ...quiet, color: 'var(--text-muted)' }} disabled={Boolean(busy)} onClick={() => void act(r, 'not this one')} data-testid="todays-send-skip">
                    {TODAYS_SENDS_WORDS.notThisOne}
                  </button>
                </div>
                {holding?.id === r.id ? (
                  <div style={{ ...links, alignItems: 'center' }}>
                    <input type="date" style={dateBox} value={holding.until} aria-label={TODAYS_SENDS_WORDS.holdPick} onChange={(e) => setHolding({ id: r.id, until: e.target.value })} data-testid="todays-send-hold-date" />
                    <button type="button" style={btn} disabled={Boolean(busy) || !holding.until} onClick={() => void act(r, 'hold')} data-testid="todays-send-hold-go">
                      {TODAYS_SENDS_WORDS.holdPick}
                    </button>
                  </div>
                ) : null}
              </div>
              <div style={actions}>
                {!r.held && !r.goesOn ? (
                  <button type="button" style={stuck ? { ...sendBtn, ...disabled } : sendBtn} disabled={stuck || !bodyOf(r).trim()} onClick={() => void sendOne(r).then((ok) => ok && reload())} data-testid="todays-send-send">
                    {busy === r.id ? 'Sending…' : TODAYS_SENDS_WORDS.send}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </ResponsiveModalShell>
  )
}
