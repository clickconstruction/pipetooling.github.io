/**
 * The customer's pay-by promise on the bill's own row (punch list #217, outside-12, a prototype):
 * a small strip of days under the bill — *billed* Oct 27, today, *your day* Fri Nov 6, *we call*
 * Nov 13 if it has not come — and, under the first owed bill's strip, the *Changed?* chips with
 * *Tell us*, so the customer moves their day with one tap as before. The strip reads
 * `promiseStrip` (the kernel) and draws it; a send goes the way the statement's ask sends
 * (`postPortalPromise`), and the sample token sends nothing. Customer-facing, so the portal's own
 * paper palette, and screen only: the printed statement asks for money, not a date.
 */
import { useState } from 'react'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER_GREEN, portalPressFill } from '../../lib/portal/portalTheme'
import { promiseChangeChips, promiseStrip, type PromiseStripMark } from '../../lib/portal/portalPromiseStrip'
import { promiseDateProblem } from '../../../supabase/functions/_shared/portalPromise'
import { postPortalPromise } from '../../lib/portal/portalPromiseIo'
import { portalFailure, type PortalFailureCause } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from './PortalFailureNote'

export type PortalPromiseStripAsk = {
  token: string
  phone?: string | null
  /** The day went through: the page keeps it and every strip redraws on it. */
  onSent: (ymd: string) => void
}

export type PortalPromiseStripProps = {
  billedOn: string | null
  promisedYmd: string
  callYmd: string | null
  todayYmd: string
  /** The *Changed?* chips under this strip; null on the other bills, so the account's one day is asked for once. */
  ask: PortalPromiseStripAsk | null
}

const TRACK_H = 62
const AXIS_Y = 34

export function PortalPromiseStrip({ billedOn, promisedYmd, callYmd, todayYmd, ask }: PortalPromiseStripProps) {
  const strip = promiseStrip({ billedOn, promisedYmd, callYmd, todayYmd })
  if (!strip) return null
  return (
    <div data-portal-promise-strip data-screen-only data-billed={billedOn ?? undefined} data-promised={strip.promisedYmd} data-call={strip.callYmd} style={{ padding: '2px 10px 10px', fontSize: 11.5 }}>
      <div role="img" aria-label={strip.words} title={strip.words} style={{ position: 'relative', height: TRACK_H }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: AXIS_Y, height: 2, background: HAIR }} />
        {strip.marks.map((m) => (
          <Mark key={m.kind} mark={m} />
        ))}
      </div>
      {ask ? <ChangeChips ask={ask} promisedYmd={strip.promisedYmd} todayYmd={todayYmd} /> : null}
    </div>
  )
}

/** One mark on the axis with its word and its day: billed and the call read under the axis, today and your day over it. */
function Mark({ mark }: { mark: PromiseStripMark }) {
  const up = mark.kind === 'today' || mark.kind === 'promised'
  const strong = mark.kind === 'promised'
  const at = { position: 'absolute' as const, left: `${mark.x}%`, transform: 'translateX(-50%)' }
  return (
    <>
      {mark.kind === 'today' ? (
        <span aria-hidden data-strip-today style={{ ...at, top: AXIS_Y - 9, width: 2, height: 20, background: INK, opacity: 0.55 }} />
      ) : mark.kind === 'call' ? (
        <span aria-hidden data-strip-call style={{ ...at, top: AXIS_Y - 4, width: 9, height: 9, transform: 'translateX(-50%) rotate(45deg)', border: `1.5px solid ${MUTED}`, background: CARD, boxSizing: 'border-box' }} />
      ) : (
        <span aria-hidden data-strip-mark={mark.kind} style={{ ...at, top: AXIS_Y - 4, width: 10, height: 10, borderRadius: '50%', background: strong ? COPPER : INK, boxSizing: 'border-box' }} />
      )}
      <span
        data-strip-label={mark.kind}
        style={{
          ...at,
          top: up ? 0 : AXIS_Y + 10,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          lineHeight: 1.2,
          color: strong ? COPPER : MUTED,
          fontWeight: strong ? 700 : 600,
          fontSize: mark.kind === 'today' ? 10 : 11.5,
        }}
      >
        <span style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5, color: strong ? COPPER : FAINT }}>{mark.word}</span>
        {mark.day ? <span style={{ display: 'block', color: strong ? COPPER : INK, fontWeight: strong ? 700 : 600 }}>{mark.day}</span> : null}
      </span>
    </>
  )
}

/** *Changed?* and the page's other Fridays, *Pick a date*, and *Tell us*: the statement's ask, under the strip. */
function ChangeChips({ ask, promisedYmd, todayYmd }: { ask: PortalPromiseStripAsk; promisedYmd: string; todayYmd: string }) {
  const chips = promiseChangeChips(todayYmd, promisedYmd)
  const [picked, setPicked] = useState('')
  const [custom, setCustom] = useState(false)
  const [ui, setUi] = useState<{ kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; text: string } | { kind: 'failed'; failure: PortalFailureCause }>({ kind: 'idle' })
  const chipStyle = (on: boolean) => ({
    border: `1px solid ${on ? COPPER : HAIR}`,
    background: on ? COPPER : CARD,
    color: on ? '#fff' : INK,
    borderRadius: 999,
    padding: '4px 11px',
    fontSize: 12,
    fontWeight: on ? 700 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  })
  async function send() {
    const problem = promiseDateProblem(picked, todayYmd)
    if (problem) {
      setUi({ kind: 'error', text: problem })
      return
    }
    setUi({ kind: 'sending' })
    if (!sampleStateFromToken(ask.token)) {
      const sent = await postPortalPromise({ token: ask.token, date: picked })
      if (!sent.ok) {
        setUi({ kind: 'failed', failure: sent.failure })
        return
      }
    }
    setUi({ kind: 'sent' })
    setPicked('')
    setCustom(false)
    ask.onSent(picked)
  }
  return (
    <div data-portal-promise-chips style={{ display: 'grid', gap: 6, marginTop: 2 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: MUTED, fontWeight: 600, marginRight: 2 }}>Changed?</span>
        {chips.map((c) => (
          <button
            key={c.ymd}
            type="button"
            aria-pressed={!custom && picked === c.ymd}
            onClick={() => {
              setCustom(false)
              setPicked(c.ymd)
              if (ui.kind !== 'sending') setUi({ kind: 'idle' })
            }}
            style={chipStyle(!custom && picked === c.ymd)}
          >
            {c.label}
          </button>
        ))}
        <button type="button" aria-pressed={custom} onClick={() => { setCustom(true); setPicked('') }} style={chipStyle(custom)}>
          Pick a date
        </button>
        {custom ? (
          <input
            type="date"
            aria-label="Pay-by date"
            value={picked}
            min={todayYmd}
            onChange={(e) => { setPicked(e.target.value); if (ui.kind !== 'sending') setUi({ kind: 'idle' }) }}
            style={{ padding: '0.3rem 0.45rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, fontSize: 12.5 }}
          />
        ) : null}
        <button
          type="button"
          disabled={ui.kind === 'sending' || !picked}
          onClick={() => void send()}
          style={{ ...portalPressFill(Boolean(picked)), border: 'none', borderRadius: 6, padding: '0.4rem 0.8rem', fontSize: 12.5, fontWeight: 700, cursor: picked ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
        >
          {ui.kind === 'sending' ? '…' : 'Tell us'}
        </button>
      </div>
      {ui.kind === 'error' ? <div style={{ color: '#b42318' }}>{ui.text}</div> : null}
      {ui.kind === 'sent' ? <div style={{ color: PAPER_GREEN, fontWeight: 600 }}>Thank you. We'll hold off on reminders until then.</div> : null}
      <PortalFailureNote failure={ui.kind === 'failed' ? portalFailure(ui.failure, 'send', 'en', { phone: ask.phone ?? null }) : null} onTryAgain={() => void send()} messageStyle={{ color: '#b42318', fontSize: 'inherit' }} />
    </div>
  )
}

export default PortalPromiseStrip
