import type { LienLeaderRow, LienLeaderSeg, LienLeaderSignCard } from '../../lib/jobs/lienLeaderSignCard'

/**
 * The leader's lien notices on the Dashboard's Needs you (v2.7435, Taunya's ask of 2026-11-16, the second drawing she
 * approved). `buildLienLeaderSignCard` decides every word; this draws them.
 *
 * On a computer each notice is a row with its own press: the first signs (*Open 891 to sign ▸*), the others open
 * (*Open 804 ›*). On a phone only the first notice has a button and every other row is the press itself. Past three
 * notices one line opens the Awaiting approval pile. Every press hands its address to the host, which navigates.
 */
export default function LienLeaderSignCardView({
  card,
  phone,
  rail,
  onOpen,
}: {
  card: LienLeaderSignCard
  phone: boolean
  /** The left edge's color, the Needs you rail for the card's tone. */
  rail: string
  /** A press: the address to open, and which press it was for the click record. */
  onOpen: (href: string, press: 'sign' | 'row' | 'more') => void
}) {
  const segs = (line: LienLeaderSeg[]) => line.map((s, i) => (s.strong ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))
  const lines = phone ? card.phoneLines : [card.line]

  const cells = (r: LienLeaderRow) => (
    <>
      <span className="lienLeaderName">{r.label}</span>
      <span className="lienLeaderClaim">{r.claimWords}</span>
      {phone ? null : <span className="lienLeaderGc">{r.gcName}</span>}
      <span className="lienLeaderState">
        {r.chips.map((c) => (
          <span key={c.key} className="lienLeaderChip" data-tone={c.tone} data-lien-leader-chip={c.key}>
            {c.text}
          </span>
        ))}
        {r.monthNamed || !r.monthsWords ? null : <span>{r.monthsWords}</span>}
      </span>
    </>
  )

  return (
    <div className="lienLeaderCard" data-lien-leader-card data-tone={card.tone} data-phone={phone ? 'yes' : 'no'} style={{ borderLeftColor: rail }}>
      <div className="lienLeaderTop">
        <div className="lienLeaderKicker">{card.kicker}</div>
        <div className="lienLeaderTitle" data-lien-leader-title>
          {card.title}
        </div>
        {lines.map((line, i) => (
          <div key={i} className="lienLeaderLine" data-lien-leader-line>
            {segs(line)}
          </div>
        ))}
      </div>
      {card.rows.map((r) =>
        phone && !r.primary ? (
          // A phone's other rows are presses themselves.
          <button key={r.jobId} type="button" className="lienLeaderRow" data-lien-leader-row={r.jobId} aria-label={r.pressTitle} onClick={() => onOpen(r.href, 'row')}>
            {cells(r)}
          </button>
        ) : (
          <div key={r.jobId} className="lienLeaderRow" data-lien-leader-row={r.jobId}>
            {cells(r)}
            <button type="button" className="lienLeaderPress" data-primary={r.primary ? 'yes' : 'no'} data-lien-leader-press={r.jobId} title={r.pressTitle} onClick={() => onOpen(r.href, r.primary ? 'sign' : 'row')}>
              {r.pressLabel}
            </button>
          </div>
        ),
      )}
      {card.more ? (
        <button type="button" className="lienLeaderMore" data-lien-leader-more title="Open the Awaiting approval pile on the Lien desk" onClick={() => onOpen(card.more!.href, 'more')}>
          {card.more.label}
        </button>
      ) : null}
    </div>
  )
}
