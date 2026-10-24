import { lazy, Suspense, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MESSAGES_PATH } from '../../lib/messages/customerThread'
import { JUMP_LANE_COLOR } from '../../lib/messages/jumpStrip'
import { cleanDayWords, TEXTS_LEDGER_WORDS as W, wentOutSummary, type LedgerReplyRow, type LedgerSentRow, type TextsLedger } from '../../lib/quickfill/textsLedger'
import { CallButton } from '../messages/CallButton'

/**
 * Quickfill → Texts (v2.5816, punch list #157): the day's text ledger, read from Messages. Three of Messages' lanes
 * narrowed to texts, in its own words and colors: **Needs a reply** (every text nobody has answered, longest waiting
 * first, with Reply and Call), **Not delivered** (our texts of today and yesterday Quo could not put on a phone, red,
 * with Call them and the thread), and **Went out today** (the receipt, folded until Show). A row opens the thread on
 * Messages, so there is one place to write. Under them a quiet line each for the texts the app prepared (Today's
 * sends, the same window Needs you opens) and the texts from numbers nobody has named (New, on Messages), and one
 * optional line, **Anything else?**, for a text the app cannot see, whose words the page holds (`typed`). The station
 * draws no Mark of its own: the page's Mark, its header's ✓ Mark, Focus's folded line and the round's Looked all write
 * the note from these rows and those words (`textsMarkNoteFor`). Until v2.5816 the body was a free box and a Mark that
 * refused without a note: 126 of its 128 marks read "up to date".
 */

const TodaysSendsWindow = lazy(() => import('../dashboard/TodaysSendsWindow').then((m) => ({ default: m.TodaysSendsWindow })))

export interface QuickfillTextsSectionProps {
  ledger: TextsLedger | null
  /** Texts the app prepared that wait on Today's sends. */
  todaysSends: number
  loading: boolean
  /** The read failed: Messages has the texts. */
  problem: boolean
  /** The office team reads Messages; anyone else keeps the note alone. */
  canRead: boolean
  /** The words under Anything else, held by the page so every Mark carries them into the note. */
  typed: string
  onTyped: (words: string) => void
  /** After the Today's sends window sent, held or put a text away. */
  onReload?: () => void
}

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const nameLink: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)', textDecoration: 'none', minWidth: 0 }
const kindStyle: CSSProperties = { color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem', marginLeft: '0.35rem' }
const wordsStyle: CSSProperties = { color: 'var(--text-700)', fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }
const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, fontWeight: 600, fontSize: '0.8rem', padding: '0.2rem 0.7rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', whiteSpace: 'nowrap', textDecoration: 'none', lineHeight: 1.3, cursor: 'pointer', fontFamily: 'inherit' }
const pillGo: CSSProperties = { ...pill, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const pillCall: CSSProperties = { ...pill, background: '#1d4ed8', borderColor: '#1d4ed8', color: '#fff', fontWeight: 700 }
// One column that may shrink below its content's width (`minmax(0, 1fr)`), so a long line never widens a phone's page.
const rows: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.35rem' }
const quiet: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }
const doorLink: CSSProperties = { color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none', fontSize: '0.8rem', whiteSpace: 'nowrap', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }

function Band({ color, title, count, note, children }: { color: string; title: string; count: number; note?: string; children?: ReactNode }) {
  return (
    <div className="stagesSectionBand messagesLaneBand" style={{ '--stage-color': color, marginBottom: 0 } as CSSProperties} data-testid={`texts-band-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h4 className="stagesBandTitle" style={{ fontSize: '0.95rem' }}>
        {title}{' '}
        <span className="stagesBandCount" aria-label={`${count}`}>
          {count}
        </span>
      </h4>
      {note ? <span className="quickfillTextsNote">{note}</span> : null}
      {children ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.5rem', alignItems: 'baseline' }}>{children}</span> : null}
    </div>
  )
}

function ReplyRow({ r }: { r: LedgerReplyRow }) {
  return (
    <div className="quickfillTextsRow" data-testid="texts-reply-row">
      <span className="quickfillTextsFace" aria-hidden>
        {r.initials}
      </span>
      <Link to={r.href} style={nameLink}>
        {r.name}
        {r.kind ? <span style={kindStyle}>{r.kind}</span> : null}
      </Link>
      <span className="quickfillTextsWhen" style={muted}>
        {r.when} · {r.waiting}
      </span>
      <Link to={r.href} className="quickfillTextsWords" style={wordsStyle}>
        {r.words}
      </Link>
      <span className="quickfillTextsActs">
        <Link to={r.href} style={pillGo} data-testid="texts-reply" title="Opens their thread on Messages, with the box under their text.">
          {W.reply}
        </Link>
        {r.phone ? <CallButton number={r.phone} name={r.name} verb={W.call} glyph="☎ " style={pillCall} testId={`texts-call-${r.contactId}`} /> : null}
      </span>
    </div>
  )
}

function SentRow({ r, bad }: { r: LedgerSentRow; bad: boolean }) {
  return (
    <div className={`quickfillTextsRow${bad ? ' isBad' : ''}`} data-testid={bad ? 'texts-bad-row' : 'texts-sent-row'}>
      <span className="quickfillTextsFace" aria-hidden>
        💬
      </span>
      <Link to={r.href} style={nameLink}>
        {r.name}
      </Link>
      <span className="quickfillTextsWhen" style={muted}>
        {r.when}
      </span>
      <Link to={r.href} className="quickfillTextsWords" style={wordsStyle}>
        {r.words}
      </Link>
      <span className="quickfillTextsActs">
        {r.mark ? (
          <span title={r.mark.title} style={{ fontWeight: 700, fontSize: '0.8rem', color: r.mark.bad ? 'var(--text-red-700)' : '#16a34a' }} data-testid="texts-mark">
            {r.mark.words}
          </span>
        ) : (
          <span style={{ ...muted, fontWeight: 600 }}>waiting on Quo</span>
        )}
        {bad && r.number ? <CallButton number={r.number} name={r.name} verb={W.callThem} glyph="☎ " style={pillCall} testId={`texts-call-them-${r.id}`} /> : null}
        {bad ? (
          <Link to={r.href} style={pill} data-testid="texts-open-thread">
            {W.openThread}
          </Link>
        ) : null}
      </span>
    </div>
  )
}

export function QuickfillTextsSection({ ledger, todaysSends, loading, problem, canRead, typed, onTyped, onReload }: QuickfillTextsSectionProps) {
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [sendsOpen, setSendsOpen] = useState(false)
  const clean = ledger !== null && ledger.count === 0 && ledger.newTexts === 0
  const receipt = ledger?.wentOutToday ?? null
  const elseId = 'quickfill-texts-else'

  return (
    <section style={{ borderRadius: 8, padding: '0.25rem 0 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.6rem' }} data-testid="quickfill-texts">
      {!canRead ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>{W.notOffice}</p>
      ) : problem ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }} data-testid="texts-problem">
          {W.problem}{' '}
          <Link to={MESSAGES_PATH} style={doorLink}>
            {W.openMessages}
          </Link>
        </p>
      ) : !ledger ? (
        <p style={{ margin: 0, ...muted }}>{loading ? W.reading : ''}</p>
      ) : clean ? (
        <div style={{ border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', borderRadius: 10, padding: '0.6rem 0.8rem' }} data-testid="texts-clean">
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-green-700)' }}>{cleanDayWords(ledger).head}</div>
          <div style={{ ...muted, marginTop: '0.15rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>{cleanDayWords(ledger).sub}</span>
            {receipt && receipt.rows.length > 0 ? (
              <button type="button" onClick={() => setReceiptOpen((o) => !o)} style={doorLink} data-testid="texts-receipt-toggle" aria-expanded={receiptOpen}>
                {receiptOpen ? `${W.hide} ▾` : `${W.show} them ▸`}
              </button>
            ) : null}
          </div>
          {receiptOpen && receipt ? (
            <div style={{ ...rows, marginTop: '0.5rem' }}>
              {receipt.rows.map((r) => (
                <SentRow key={r.id} r={r} bad={false} />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <Band color={JUMP_LANE_COLOR.needsReply} title={W.needsReply} count={ledger.needsReply.length} note={W.needsReplyNote}>
            {ledger.needsReply.length > 0 ? (
              <Link to={MESSAGES_PATH} style={doorLink}>
                {W.openMessages}
              </Link>
            ) : null}
          </Band>
          {ledger.needsReply.length > 0 ? (
            <div style={rows}>
              {ledger.needsReply.map((r) => (
                <ReplyRow key={r.contactId} r={r} />
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, ...muted }}>Nobody is waiting on a text from us.</p>
          )}
          <Band color={JUMP_LANE_COLOR.needsYou} title={W.notDelivered} count={ledger.notDelivered.length} note={W.notDeliveredNote} />
          {ledger.notDelivered.length > 0 ? (
            <div style={rows}>
              {ledger.notDelivered.map((r) => (
                <SentRow key={r.id} r={r} bad />
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, ...muted }}>Every text of ours reached its phone.</p>
          )}
          {receipt ? (
            <>
              <Band color={JUMP_LANE_COLOR.wentOut} title={W.wentOut} count={receipt.rows.length} note={wentOutSummary(receipt)}>
                {receipt.rows.length > 0 ? (
                  <button type="button" onClick={() => setReceiptOpen((o) => !o)} style={doorLink} data-testid="texts-receipt-toggle" aria-expanded={receiptOpen}>
                    {receiptOpen ? `${W.hide} ▾` : `${W.show} ▸`}
                  </button>
                ) : null}
              </Band>
              {receiptOpen && receipt.rows.length > 0 ? (
                <div style={rows}>
                  {receipt.rows.map((r) => (
                    <SentRow key={r.id} r={r} bad={false} />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
      {canRead && ledger && todaysSends > 0 ? (
        <div style={quiet} data-testid="texts-todays-sends">
          <span>{W.todaysSends(todaysSends)}</span>
          <button type="button" onClick={() => setSendsOpen(true)} style={doorLink}>
            {W.todaysSendsOpen}
          </button>
        </div>
      ) : null}
      {canRead && ledger && ledger.newTexts > 0 ? (
        <div style={quiet} data-testid="texts-new">
          <span>{W.newTexts(ledger.newTexts)}</span>
          <Link to={MESSAGES_PATH} style={doorLink}>
            {W.newTextsOpen}
          </Link>
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <label htmlFor={elseId} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-700)' }}>
          {W.elseLabel} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{W.elseHint}</span>
        </label>
        <input id={elseId} type="text" value={typed} onChange={(e) => onTyped(e.target.value)} placeholder={W.elsePlaceholder} maxLength={2000} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', padding: '0.45rem 0.6rem', font: 'inherit', fontSize: '0.875rem', color: 'var(--text)' }} />
      </div>
      {sendsOpen ? (
        <Suspense fallback={null}>
          <TodaysSendsWindow onClose={() => setSendsOpen(false)} onChanged={() => onReload?.()} />
        </Suspense>
      ) : null}
    </section>
  )
}
