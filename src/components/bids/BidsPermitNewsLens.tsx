import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState } from '../EmptyState'
import { emptyWords } from '../../lib/emptyWords'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { RESEARCH_CITIES } from '../../lib/research/permitResearch'
import { permitAnswerKey, type StandingAnswer } from '../../lib/research/bidPermitAnswers'
import { recordPermitAnswer } from '../../lib/research/bidPermitAnswersIo'
import { permitRefOf, permitShortWords, type NewsItem, type PermitInboxSide, type TakenOffPermit } from '../../lib/research/bidPermitNews'
import { answeredWords, CARD_ANSWER_LABEL, CARD_ANSWER_SAVES, permitNewsCard, receiptWords, type CardAnswer, type CardBid, type CardTone } from '../../lib/research/permitNewsCard'

/**
 * Followup → Permit news (punch list #401, PR 3). What the city filed on the addresses of the
 * bids that are not yet won or lost, as cards the reader answers. A card names its kind, the
 * bid, what the city shows and why it looks like that bid (`permitNewsCard`), and under one
 * question takes one press. *We lost it…* opens the board's own outcome across the card and
 * writes no answer. The other presses write one row to `bid_permit_answers`, and the card folds
 * to one line with Undo where it stood. The lists are the kernel's (`permitInbox`): the reader's
 * own bids by default, everyone's on the switch. The red count on Followup is the reader's own
 * new lines, whichever list is open.
 */
const TONE: Record<CardTone, { edge: string; tag: CSSProperties }> = {
  red: { edge: 'var(--text-red-700)', tag: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' } },
  green: { edge: 'var(--text-green-700)', tag: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' } },
  amber: { edge: '#d97706', tag: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' } },
}
const tag: CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '1px 9px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }
// `font` comes first: the shorthand resets the size and weight, so written last it undid both.
const press: CSSProperties = { font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center' }
const link: CSSProperties = { font: 'inherit', background: 'none', border: 0, padding: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }
const countPill: CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }

export type PermitNewsBid = CardBid & { id: string }

const keyOf = (bidId: string, city: string, permit: { permit_number: string; permit_type: string }): string => permitAnswerKey(bidId, permitRefOf(city, permit))
const titleOf = (bid: PermitNewsBid | undefined, fallback: string): string => (bid ? [bid.bid_number?.trim() || null, bid.project_name ?? 'A bid'].filter(Boolean).join(' · ') : fallback)

type Said = { answer: Exclude<CardAnswer, 'lost'>; title: string; bidId: string; city: string; permit: { permit_number: string; permit_type: string } }

export function BidsPermitNewsLens({
  inbox,
  bidsById,
  nameOf,
  onOpenBid,
  onOpenCallQueue,
  renderMarkLost,
  narrow = false,
}: {
  inbox: { mine: PermitInboxSide; others: PermitInboxSide }
  /** The bids the lines are on, for the card's own words about the bid. */
  bidsById: ReadonlyMap<string, PermitNewsBid>
  /** A person's name for "who said so". The reader is "You". */
  nameOf: (userId: string) => string
  onOpenBid: (bidId: string) => void
  onOpenCallQueue: () => void
  /** The board's own window for marking this bid lost, drawn across the card while open. */
  renderMarkLost: (bidId: string, close: () => void) => ReactNode
  narrow?: boolean
}) {
  const today = todayYmdInAppTz()
  const [everyone, setEveryone] = useState(false)
  /** What was answered in this window, by the line's key: the card folds to a receipt where it stood. */
  const [said, setSaid] = useState<ReadonlyMap<string, Said>>(new Map())
  const [lostKey, setLostKey] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  const [answeredOpen, setAnsweredOpen] = useState(false)
  /** The order the lines were first drawn in, so an answered card keeps its place and a line that comes back returns to it. */
  const order = useRef<string[]>([])

  const fresh: NewsItem[] = everyone ? [...inbox.mine.fresh, ...inbox.others.fresh] : inbox.mine.fresh
  const standing: NewsItem[] = everyone ? [...inbox.mine.standing, ...inbox.others.standing] : inbox.mine.standing
  const takenOff: TakenOffPermit[] = everyone ? [...inbox.mine.takenOff, ...inbox.others.takenOff] : inbox.mine.takenOff
  const freshByKey = new Map(fresh.map((n) => [keyOf(n.bidId, n.city, n.permit), n]))
  for (const k of freshByKey.keys()) if (!order.current.includes(k)) order.current.push(k)
  const rows = order.current.filter((k) => freshByKey.has(k) || said.has(k))
  const allFresh = inbox.mine.fresh.length + inbox.others.fresh.length
  const othersHold = inbox.others.fresh.length + inbox.others.standing.length + inbox.others.takenOff.length > 0
  // What this window answered shows as its receipt above, not a second time in the list below.
  const answered = [
    ...standing.filter((n) => !said.has(keyOf(n.bidId, n.city, n.permit))).map((n) => ({ key: keyOf(n.bidId, n.city, n.permit), bidId: n.bidId, title: titleOf(bidsById.get(n.bidId), n.title), city: n.city, permit: n.permit, standing: n.answered as StandingAnswer, back: 'Take back' })),
    ...takenOff.filter((t) => !said.has(keyOf(t.bidId, t.city, t.permit))).map((t) => ({ key: keyOf(t.bidId, t.city, t.permit), bidId: t.bidId, title: titleOf(bidsById.get(t.bidId), t.title), city: t.city, permit: t.permit, standing: { answer: 'not_this_job' as const, by: t.by, at: t.at }, back: 'Put back' })),
  ]

  const save = async (key: string, bidId: string, city: string, permit: { permit_number: string; permit_type: string }, answer: 'this_job' | 'not_this_job' | 'taken_back'): Promise<boolean> => {
    setBusyKey(key)
    setFailed(null)
    try {
      await recordPermitAnswer({ bidId, permit: permitRefOf(city, permit), answer })
      return true
    } catch (e) {
      setFailed({ key, message: formatErrorMessage(e) })
      return false
    } finally {
      setBusyKey(null)
    }
  }
  const answer = async (item: NewsItem, pressed: Exclude<CardAnswer, 'lost'>, title: string) => {
    const key = keyOf(item.bidId, item.city, item.permit)
    if (await save(key, item.bidId, item.city, item.permit, CARD_ANSWER_SAVES[pressed])) setSaid((prev) => new Map(prev).set(key, { answer: pressed, title, bidId: item.bidId, city: item.city, permit: item.permit }))
  }
  const undo = async (key: string, bidId: string, city: string, permit: { permit_number: string; permit_type: string }) => {
    if (!(await save(key, bidId, city, permit, 'taken_back'))) return
    setSaid((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }

  const failure = (key: string) => (failed?.key === key ? <div role="alert" style={{ ...muted, color: 'var(--text-red-700)' }}>{failed.message}</div> : null)

  const card = (key: string, item: NewsItem) => {
    const bid = bidsById.get(item.bidId)
    const title = titleOf(bid, item.title)
    const c = permitNewsCard(item, bid ?? { bid_number: null, project_name: item.title, address: null, bid_date_sent: null, gcName: null }, RESEARCH_CITIES, today)
    const tone = TONE[c.tone]
    const busy = busyKey === key
    const lostOpen = lostKey === key
    return (
      <div key={key} role="group" aria-label={title} data-testid="permit-news-card" style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${tone.edge}`, borderRadius: 8, background: 'var(--surface)', padding: '11px 14px', display: 'grid', gridTemplateColumns: narrow || lostOpen ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 190px', gap: '8px 16px', minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 5, minWidth: 0, alignContent: 'start' }}>
          <div style={{ display: 'flex', gap: '4px 10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ ...tag, ...tone.tag }}>{c.kind}</span>
            {c.notSent ? <span style={{ ...tag, ...TONE.amber.tag }}>Not sent yet</span> : null}
            <span style={{ fontSize: '0.84rem', fontWeight: 600, minWidth: 0 }}>
              <button type="button" onClick={() => onOpenBid(item.bidId)} title="Open the bid" style={{ ...link, fontSize: 'inherit', textDecoration: 'underline' }}>
                {c.bidNumber ?? 'Open the bid'}
              </button>
              {' · '}
              {c.bidName}
            </span>
            {c.bidMeta ? <span style={{ ...muted, fontSize: '0.78rem' }}>{c.bidMeta}</span> : null}
          </div>
          <div style={{ fontSize: '0.97rem', fontWeight: 700, lineHeight: 1.35 }}>{c.head}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>
            {c.cityQuote ? <>The city’s words: “{c.cityQuote}” · </> : null}
            {c.cityFacts}
          </div>
          <div style={{ display: 'flex', gap: '3px 16px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
            {c.reasons.map((r) => (
              <span key={r.words} style={{ color: r.ok ? 'var(--text-700)' : 'var(--text-muted)' }}>
                <span aria-hidden style={{ fontWeight: 700, color: r.ok ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{r.ok ? '✓ ' : '? '}</span>
                {r.words}
              </span>
            ))}
          </div>
          {failure(key)}
        </div>
        {lostOpen ? (
          <div>{renderMarkLost(item.bidId, () => setLostKey(null))}</div>
        ) : (
          <div style={{ display: 'grid', gap: 6, alignContent: 'start', gridTemplateColumns: narrow ? '1fr 1fr' : '1fr', borderLeft: narrow ? undefined : '1px solid var(--border)', borderTop: narrow ? '1px solid var(--border)' : undefined, paddingLeft: narrow ? 0 : 16, paddingTop: narrow ? 9 : 0, opacity: busy ? 0.6 : 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', gridColumn: '1 / -1' }}>{c.question}</div>
            {c.answers.map((a) => (
              <button
                key={a}
                type="button"
                disabled={busy}
                aria-expanded={a === 'lost' ? false : undefined}
                onClick={() => (a === 'lost' ? setLostKey(key) : void answer(item, a, title))}
                style={{ ...press, minHeight: narrow ? 40 : 34, gridColumn: narrow && a === 'not_ours' && c.answers.length === 3 ? '1 / -1' : undefined, cursor: busy ? 'progress' : 'pointer' }}
              >
                {CARD_ANSWER_LABEL[a]}
              </button>
            ))}
            {c.callDoor ? (
              <button type="button" onClick={onOpenCallQueue} style={{ ...link, gridColumn: '1 / -1' }}>
                Open the Call queue ›
              </button>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  const receipt = (key: string, s: Said) => (
    <div key={key} data-testid="permit-news-receipt" style={{ border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '8px 14px', fontSize: '0.8125rem', color: 'var(--text-700)', display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', gap: '6px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ minWidth: 0 }}>
          <strong style={{ color: 'var(--text-strong)' }}>{s.title}</strong> · {receiptWords(s.answer)}
        </span>
        <button type="button" disabled={busyKey === key} onClick={() => void undo(key, s.bidId, s.city, s.permit)} style={{ ...link, marginLeft: 'auto' }}>
          Undo
        </button>
      </div>
      {failure(key)}
    </div>
  )

  return (
    <section aria-label="Permit news" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.9rem', fontWeight: 700 }}>
        {everyone ? 'New on everyone’s bids' : 'New on your bids'}
        <span data-testid="permit-news-count" style={{ ...countPill, ...(fresh.length > 0 ? TONE.red.tag : { background: 'var(--bg-200)', color: 'var(--text-700)' }) }}>{fresh.length}</span>
        {othersHold || everyone ? (
          <span role="group" aria-label="Whose bids" style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden', fontSize: '0.78rem', fontWeight: 600 }}>
            {(
              [
                [false, 'Yours'],
                [true, allFresh > 0 ? `Everyone’s ${allFresh}` : 'Everyone’s'],
              ] as const
            ).map(([all, label]) => (
              <button key={label} type="button" aria-pressed={everyone === all} onClick={() => setEveryone(all)} style={{ font: 'inherit', border: 0, padding: '4px 11px', cursor: 'pointer', background: everyone === all ? 'var(--bg-blue-tint)' : 'transparent', color: everyone === all ? 'var(--text-link)' : 'var(--text-700)' }}>
                {label}
              </button>
            ))}
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
          <EmptyState main={emptyWords({ kind: 'waiting', who: everyone ? 'anyone' : 'you' }).main} tail="A new permit on a bid’s address shows here, with a red count on Followup." compact />
        </div>
      ) : (
        rows.map((k) => {
          const item = freshByKey.get(k)
          const s = said.get(k)
          return item ? card(k, item) : s ? receipt(k, s) : null
        })
      )}

      {answered.length > 0 ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <button type="button" aria-expanded={answeredOpen} onClick={() => setAnsweredOpen((v) => !v)} style={link}>
            {everyone ? 'Answered on everyone’s bids' : 'Answered on your bids'} · {answered.length} {answeredOpen ? '⌄' : '›'}
          </button>
          {answeredOpen ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '2px 14px', fontSize: '0.8125rem' }}>
              {answered.map((a, i) => (
                <div key={a.key} data-testid="permit-news-answered" style={{ display: 'grid', gap: 4, padding: '8px 0', borderTop: i === 0 ? undefined : '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '4px 12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                      <strong style={{ display: 'block' }}>{a.title}</strong>
                      <span style={muted}>
                        {permitShortWords(a.permit, today)} · {answeredWords(a.standing, nameOf(a.standing.by), today)}
                      </span>
                    </div>
                    <button type="button" onClick={() => onOpenBid(a.bidId)} style={link}>
                      Open the bid
                    </button>
                    <button type="button" disabled={busyKey === a.key} onClick={() => void save(a.key, a.bidId, a.city, a.permit, 'taken_back')} style={link}>
                      {a.back}
                    </button>
                  </div>
                  {failure(a.key)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ ...muted, fontSize: '0.75rem' }}>The city’s records are read every morning and run 2 to 3 days behind.</div>
    </section>
  )
}
