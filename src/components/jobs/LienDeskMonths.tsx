import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { workMonthLabel, workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { DATED_FROM_CREATION_WORDS } from '../../lib/jobs/lienDesk'
import { LIEN_MONTH_OUTCOME_LABEL, lienMonthMissUnnoted, lienMonthMissedWords, lienMonthOutcomeMeaning, type LienMonthHistoryEntry } from '../../lib/jobs/lienMonthHistory'

/**
 * The Lien desk's Months card (v2.3661). Each open work month is a tickable card that
 * says what the old chip's "by Oct 15" meant — the notice for that month's work has to
 * be mailed by then, or the month can no longer be liened — and the claim the notice
 * states sits beside them. Months whose question is settled (sent, skipped, missed) are
 * a row of dots underneath; a dot opens what happened, so a skip leaves a visible trace.
 */
export type LienDeskMonthCard = {
  key: string
  on: boolean
  locked: boolean
  hours: number
  /** "1 person · 2 days" — '' when the crew evidence is not loaded. */
  crew: string
  deadline: string
  daysLeft: number
  noticed: boolean
  closed: boolean
  /** The month is the job's creation month — no approved hours (v2.3747); the card says so instead of "0 approved hours". */
  fromCreation?: boolean
}

function daysLeftWords(d: number): string {
  if (d === 0) return 'due today'
  if (d === 1) return 'due tomorrow'
  return `${d} days left`
}

const isoDay = (iso: string): string => (iso ? iso.slice(0, 10) : '')

export default function LienDeskMonths({
  cards,
  history,
  claim,
  onToggle,
  onNoteMissed,
  claimNode,
}: {
  cards: LienDeskMonthCard[]
  history: LienMonthHistoryEntry[]
  claim: string
  onToggle: (key: string, on: boolean) => void
  /** Write a closed window down (v2.3679) — the office's door; absent for a role that cannot. */
  onNoteMissed?: (month: string) => void
  /** The claim box, corrected by hand (v2.3682) — replaces the plain figure when given. */
  claimNode?: ReactNode
}) {
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const detail = history.find((h) => h.month === openMonth) ?? null
  const earliest = cards.filter((c) => c.on && !c.noticed && !c.closed).sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
  const manyOn = cards.filter((c) => c.on).length > 1

  return (
    <div className="lienMonths" data-lien-desk-months>
      <div className="lienMonthsHead">
        <strong>Months this notice covers</strong>
        <span>Each month of work has its own deadline — miss it and that month can no longer be liened.</span>
      </div>
      <div className="lienMonthsBody">
        <div className="lienMonthsCards">
          {cards.map((c) => {
            const urgent = c.on && c.daysLeft <= 7 && !c.noticed && !c.closed
            return (
              <label key={c.key} className="lienMonthCard" data-on={c.on ? 'yes' : 'no'} data-urgent={urgent ? 'yes' : 'no'} data-locked={c.locked ? 'yes' : 'no'}>
                <input type="checkbox" checked={c.on} disabled={c.locked} onChange={(ev) => onToggle(c.key, ev.target.checked)} aria-label={workMonthLabel(c.key)} />
                <span className="lienMonthCardName">{workMonthLabel(c.key)}</span>
                <span className="lienMonthCardHours">
                  {c.fromCreation ? DATED_FROM_CREATION_WORDS : <>{c.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} approved hours{c.crew ? ` · ${c.crew}` : ''}</>}
                </span>
                <span className="lienMonthCardDue">
                  {c.noticed ? (
                    '✓ Notice sent'
                  ) : c.closed ? (
                    `✗ Deadline passed ${formatYmdMonthDay(c.deadline)}`
                  ) : (
                    <>
                      Mail by <strong>{formatYmdMonthDay(c.deadline)}</strong> · {daysLeftWords(c.daysLeft)}
                    </>
                  )}
                </span>
              </label>
            )
          })}
          {cards.length === 0 ? <span className="lienMonthsEmpty">No open months on this job.</span> : null}
        </div>
        {claimNode ?? (
          <div className="lienMonthsClaim">
            <span>Claim amount on the notice</span>
            <strong>{claim}</strong>
            <span>Still unpaid on this job</span>
          </div>
        )}
      </div>
      {manyOn && earliest ? (
        <div className="lienMonthsNote">
          One notice can cover several months. The earliest deadline, {formatYmdMonthDay(earliest.deadline)}, is the one this notice has to beat.
        </div>
      ) : null}
      {history.length ? (
        <div className="lienMonthsHistory" data-lien-desk-month-history>
          <span className="lienMonthsHistoryLead">Earlier months</span>
          {history.map((h) => (
            <button key={h.month} type="button" className="lienMonthDot" data-outcome={h.outcome} onClick={() => setOpenMonth(h.month)} title={`${workMonthLabel(h.month)} — ${LIEN_MONTH_OUTCOME_LABEL[h.outcome].toLowerCase()}. Click for the record.`}>
              <i aria-hidden="true" />
              <span>{workMonthShort(h.month)}</span>
              <b>{LIEN_MONTH_OUTCOME_LABEL[h.outcome]}</b>
            </button>
          ))}
        </div>
      ) : null}

      {/* Portalled: `.lienMonths` is a size container, which would otherwise become the fixed scrim's containing block. */}
      {detail ? createPortal(
        <div className="lienMonthDialogScrim" onClick={() => setOpenMonth(null)}>
          <div role="dialog" aria-modal="true" aria-label={`${workMonthLabel(detail.month)} — ${LIEN_MONTH_OUTCOME_LABEL[detail.outcome]}`} className="lienMonthDialog" onClick={(e) => e.stopPropagation()}>
            <div className="lienMonthDialogHead">
              <strong>{workMonthLabel(detail.month)}</strong>
              <span className="lienMonthDialogChip" data-outcome={detail.outcome}>
                {LIEN_MONTH_OUTCOME_LABEL[detail.outcome]}
              </span>
              <button type="button" onClick={() => setOpenMonth(null)} aria-label="Close" className="lienMonthDialogClose">
                ×
              </button>
            </div>
            <dl>
              {detail.outcome === 'sent' ? (
                <>
                  <dt>Notice sent</dt>
                  <dd>{detail.at ? formatYmdMonthDay(isoDay(detail.at)) : 'recorded on the job — the date is in the Lien window'}</dd>
                  {detail.approvalMode ? (
                    <>
                      <dt>Approved</dt>
                      <dd>{detail.approvalMode === 'rule' ? 'by the GC’s standing “send” rule' : detail.approvalMode === 'word' ? 'on the leader’s spoken word' : 'by the leader'}</dd>
                    </>
                  ) : null}
                </>
              ) : null}
              {detail.outcome === 'skipped' ? (
                <>
                  <dt>Skipped</dt>
                  <dd>
                    {detail.at ? formatYmdMonthDay(isoDay(detail.at)) : ''}
                    {detail.byName ? ` by ${detail.byName}` : ''}
                  </dd>
                  <dt>Why</dt>
                  <dd className="lienMonthDialogReason">“{detail.reason}”</dd>
                </>
              ) : null}
              {detail.outcome === 'missed' && (detail.at || detail.byName) ? (
                <>
                  <dt>Noted</dt>
                  <dd data-lien-month-noted>
                    {detail.at ? formatYmdMonthDay(isoDay(detail.at)) : ''}
                    {detail.byName ? ` by ${detail.byName}` : ''}
                  </dd>
                </>
              ) : null}
              {detail.outcome === 'missed' ? (
                <>
                  <dt>Window closed</dt>
                  <dd data-lien-month-closed>
                    {detail.deadline ? formatYmdMonthDay(detail.deadline) : '—'}
                    {lienMonthMissUnnoted(detail) ? ' · no notice, no skip on record' : ' · no notice'}
                  </dd>
                </>
              ) : detail.deadline ? (
                <>
                  <dt>Deadline</dt>
                  <dd>{formatYmdMonthDay(detail.deadline)}</dd>
                </>
              ) : null}
              {detail.approvedHours != null ? (
                <>
                  <dt>Approved hours</dt>
                  <dd>{detail.approvedHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</dd>
                </>
              ) : null}
            </dl>
            {detail.outcome === 'missed' ? (
              // What is lost and what is not (v2.3681): the lien as security for that month's work, never the money.
              (() => {
                const w = lienMonthMissedWords(workMonthLabel(detail.month), { hasOpenNotice: cards.some((c) => c.on && !c.noticed && !c.closed), claim })
                return (
                  <p className="lienMonthDialogMeaning" data-outcome={detail.outcome} data-lien-month-missed-words>
                    <strong style={{ color: 'var(--text-red-700)' }}>Lien:</strong> {w.lien} <strong style={{ color: 'var(--text-green-800)' }}>Money:</strong> {w.money}
                  </p>
                )
              })()
            ) : (
              <p className="lienMonthDialogMeaning" data-outcome={detail.outcome}>
                {lienMonthOutcomeMeaning(detail, workMonthLabel(detail.month))}
              </p>
            )}
            {onNoteMissed && lienMonthMissUnnoted(detail) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Nobody has written this down yet.</span>
                <button
                  type="button"
                  onClick={() => {
                    onNoteMissed(detail.month)
                    setOpenMonth(null)
                  }}
                  style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  title="Record the closed window with your name — not a skip, just that it was seen"
                >
                  Note it as missed
                </button>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
