import { Fragment, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { lienStandInWords } from '../../lib/jobs/lienBillMonths'
import type { LienBoardKind } from '../../lib/jobs/lienBoard'
import type { CallerOwnerHit } from '../../lib/jobs/lienCallerMatch'
import { LIEN_DESK_PILES, lienEmptyPileWords, type LienDeskEntry, type LienDeskPile } from '../../lib/jobs/lienDesk'
import { LIEN_SHOW_EVERY_PILE } from '../../lib/jobs/lienDeskEmptyWords'
import { lienFindNothingWords, type LienFindFact } from '../../lib/jobs/lienDeskFind'
import type { LienSupplierMark } from '../../lib/jobs/lienJobSuppliers'
import { letterTwoKindLabel } from '../../lib/jobs/lienLetterTwo'
import { parseLienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import { lienChipSigned, lienFieldsHash, signatureColumnsOf } from '../../lib/jobs/lienNoticeSignature'
import { lienDeskDeadlineWords as deadlineWords } from '../../lib/jobs/lienRowWords'
import { lienRunRowLine } from '../../lib/jobs/lienRunChecklist'
import { lienRunActLabel } from '../../lib/jobs/lienRunWords'
import { sendsTrackingOwed } from '../../lib/jobs/lienSendTracking'
import { wordRecordWords } from '../../lib/jobs/lienWord'
import { filingMailTail } from '../../lib/mail/lienMailPieces'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'
import { lienBtnStyle as btn } from './lienDeskButtonStyles'
import { LienFindHits, LienFindMarked } from './LienDeskFindBox'
import { LIEN_PHONE_PILE_PRESS as PHONE_PILE_PRESS, lienRowChipStyle as chip, lienSeverityColors as severityColors } from './lienDeskRowStyles'
import { LienSupplierMarkLine } from './LienJobSuppliers'
import { LienPileHead, lienPileHeadCount, type LienPileHeads } from './LienPileHeads'

/**
 * By paper → Monthly notices, the list (its own file since v2.7608, out of `LienDesk.tsx` as it stood): each pile
 * under its sticky title (v2.4672) with the run's press on Approved and the deliveries lens on Sent, one row a job
 * with what its find matched, then the notices the desk once sent that a find also reaches (v2.4731). It holds no
 * state: the desk keeps the pick, the pressed pile, the find box, the calendar's filter and the lit title, and
 * hands them in under their own names.
 */
export function LienDeskNoticeList({
  data,
  loading,
  isMobile,
  stacked,
  office,
  entries,
  visible,
  visibleAll,
  pilesShown,
  noticeHeads,
  counts,
  runCount,
  pile,
  setPile,
  finding,
  find,
  findWords,
  findHits,
  alsoSent,
  calendarJobFilter,
  setCalendarJobFilter,
  deliveriesOnly,
  setDeliveriesOnly,
  mailedJobIds,
  selectedJobId,
  setSelectedJobId,
  setMobileListShown,
  setRunOpen,
  setCallerJobId,
  supplierMarks,
  leaderNameFor,
  listLabel,
  onOpenNotice,
}: {
  data: LienDeskData | null
  loading: boolean
  isMobile: boolean
  /** A host stacks the desk: a row's press opens the notice as its own page (`onOpenNotice`). */
  stacked: boolean
  office: boolean
  /** Every notice entry, the ones the pile and the calendar's filter leave, and those a find then keeps. */
  entries: ReadonlyArray<LienDeskEntry>
  visible: ReadonlyArray<LienDeskEntry>
  visibleAll: ReadonlyArray<LienDeskEntry>
  /** The piles to draw with their rows, and their sticky titles (the desk's `useLienPileHeads`). */
  pilesShown: ReadonlyArray<{ p: LienDeskPile; rows: LienDeskEntry[]; total: number }>
  noticeHeads: LienPileHeads<LienDeskPile>
  counts: LienDeskData['queue']['counts'] | undefined
  runCount: number
  pile: LienDeskPile | null
  setPile: Dispatch<SetStateAction<LienDeskPile | null>>
  /** The find box: whether words are typed, the words, what each row matched, and the sent notices it also reaches. */
  finding: boolean
  find: string
  findWords: ReadonlyArray<string>
  findHits: ReadonlyMap<string, LienFindFact[]>
  alsoSent: ReadonlyArray<CallerOwnerHit>
  /** A day pressed on the calendar narrows the list to its jobs. */
  /** The jobs the list is narrowed to: the calendar's *Draft the N*, or (`words`, v2.7853) the Board's *Sign N notices ›*, which says its own words on the chip. */
  calendarJobFilter: { ymd: string; jobIds: ReadonlySet<string>; words?: string } | null
  setCalendarJobFilter: Dispatch<SetStateAction<{ ymd: string; jobIds: ReadonlySet<string>; words?: string } | null>>
  /** Sent's lens: only the notices with a tracked envelope. */
  deliveriesOnly: boolean
  setDeliveriesOnly: Dispatch<SetStateAction<boolean>>
  mailedJobIds: ReadonlySet<string>
  selectedJobId: string | null
  setSelectedJobId: Dispatch<SetStateAction<string | null>>
  setMobileListShown: Dispatch<SetStateAction<boolean>>
  setRunOpen: Dispatch<SetStateAction<boolean>>
  setCallerJobId: Dispatch<SetStateAction<string | null>>
  supplierMarks: ReadonlyMap<string, LienSupplierMark>
  leaderNameFor?: (masterUserId: string | null) => string
  /** A row's job label, with the number as the door to the job where the desk has one. */
  listLabel: (jobId: string, kind: LienBoardKind, marked: boolean) => ReactNode
  onOpenNotice?: (jobId: string, pile: LienDeskPile | null) => void
}) {
  return (
    <div ref={noticeHeads.listRef} onScroll={noticeHeads.onScroll} data-lien-desk-list style={{ position: 'relative', borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }}>
      {visible.length === 0 && finding && visibleAll.length > 0 && alsoSent.length === 0 ? (
        <div data-testid="lien-desk-find-nothing" style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem', display: 'grid', gap: 4 }}>
          <strong style={{ color: 'var(--text-strong)' }}>{lienFindNothingWords(find).head}</strong>
          <span>{lienFindNothingWords(find).tryWords}</span>
          <span>{lienFindNothingWords(find).elsewhere}</span>
        </div>
      ) : visible.length === 0 && pile && !loading && data ? (
        <div data-lien-desk-empty-pile={pile} style={{ fontSize: '0.8125rem' }}>
          <EmptyState
            compact
            main={`${lienEmptyPileWords(pile, entries.length - visibleAll.length).head} ${lienEmptyPileWords(pile, entries.length - visibleAll.length).rest}`}
            next={{ label: LIEN_SHOW_EVERY_PILE, onPress: () => setPile(null) }}
          />
        </div>
      ) : visible.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {loading || data == null ? 'Looking at every unpaid sub job…' : 'Nothing is due — every unpaid month on a sub job is noticed, or is more than 30 days from its deadline.'}
        </p>
      ) : null}
      {calendarJobFilter ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.9rem 0', fontSize: '0.75rem' }} data-testid="lien-desk-calendar-filter">
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontWeight: 700 }}>
            {calendarJobFilter.words ?? `${calendarJobFilter.jobIds.size} ${calendarJobFilter.jobIds.size === 1 ? 'job' : 'jobs'} from the calendar · by ${formatYmdMonthDay(calendarJobFilter.ymd)}`}
          </span>
          <button type="button" onClick={() => setCalendarJobFilter(null)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>
            show every job
          </button>
        </div>
      ) : null}
      {pilesShown.map(({ p, rows, total }, i) => {
        const label = LIEN_DESK_PILES.find((x) => x.key === p)?.label ?? p
        return (
          <Fragment key={p}>
            <LienPileHead pile={p} label={label} count={lienPileHeadCount(rows.length, total, counts?.[p], finding)} i={i} n={pilesShown.length} phone={isMobile} on={noticeHeads.lit === p} empty={finding && rows.length === 0} onPress={() => noticeHeads.scrollToPile(p, i)} onShowEvery={pile ? () => setPile(null) : null}>
              {p === 'ready' && office && runCount > 0 ? (
                <button type="button" data-lien-pile-run onClick={() => setRunOpen(true)} title="Every approved notice as one packet" style={{ padding: '1px 8px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', cursor: 'pointer', whiteSpace: 'nowrap', ...(isMobile ? PHONE_PILE_PRESS : null) }}>
                  {lienRunActLabel('print', runCount)}
                </button>
              ) : null}
              {p === 'sent' && mailedJobIds.size > 0 ? (
                <button type="button" data-lien-pile-deliveries={deliveriesOnly ? 'on' : 'off'} onClick={() => setDeliveriesOnly((v) => !v)} title={deliveriesOnly ? 'Every sent notice' : 'Only the notices mailed through Docsmit, with where each envelope is'} style={{ padding: '1px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', background: deliveriesOnly ? 'var(--bg-blue-tint)' : 'var(--surface)', color: deliveriesOnly ? 'var(--text-blue-700)' : 'var(--text-700)', font: 'inherit', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', cursor: 'pointer', whiteSpace: 'nowrap' , ...(isMobile ? PHONE_PILE_PRESS : null) }}>
                  {deliveriesOnly ? 'Every sent notice' : `Deliveries · ${mailedJobIds.size}`}
                </button>
              ) : null}
            </LienPileHead>
            <div data-lien-pile-rows={p}>
            {rows.map((e) => {
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === selectedJobId
              const sev = severityColors(e.severity)
              const named = e.item && e.item.status !== 'sent' && e.item.status !== 'missed' && e.item.months.length ? e.item.months : e.dueMonths
              const state =
                e.pile === 'awaiting'
                  ? `awaiting approval · ${e.item?.submitted_at ? formatYmdMonthDay(calendarYmdInAppTzFromIso(e.item.submitted_at)) : ''}`
                  : e.pile === 'ready'
                    ? `${
                        e.item?.approval_mode === 'word'
                          ? wordRecordWords(e.item, leaderNameFor?.(data?.jobsById[e.jobId]?.master_user_id ?? null))
                          : e.item?.approval_mode === 'rule'
                            ? 'standing rule'
                            : 'approved'
                      }${e.item && lienChipSigned(signatureColumnsOf(e.item), lienFieldsHash(e.item.fields)) === 'unsigned' ? ' · unsigned' : ''}`
                    : e.pile === 'printed'
                      // Approved · to mail (*In the run* until v2.7434): the row names the tick it waits on, as the run's checklist does.
                      ? lienRunRowLine(true, !!e.item && lienChipSigned(signatureColumnsOf(e.item), lienFieldsHash(e.item.fields)) !== 'unsigned', false)
                    : e.pile === 'held'
                      ? `held · ${e.item?.hold_reason === 'promised' ? 'they promised' : 'call first'} · re-asks ${e.item?.hold_until ? formatYmdMonthDay(e.item.hold_until) : ''}`
                      : e.pile === 'sent'
                        ? `sent ${e.item?.sent_at ? formatYmdMonthDay(calendarYmdInAppTzFromIso(e.item.sent_at)) : ''}${(() => { const f = (data?.filingsByJob[e.jobId] ?? []).find((x) => x.id === e.item?.sent_filing_id); if (!f) return ''; const pieces = data?.mailPiecesByFiling?.[f.id] ?? []; return pieces.length ? filingMailTail(pieces, formatYmdMonthDay) : sendsTrackingOwed(f.sends).length ? ' · tracking owed' : '' })()}`
                        : e.pile === 'missed'
                          ? `window closed on ${e.missedMonths.map(workMonthShort).join(', ')}`
                          : e.pile === 'needs_owner'
                            ? 'owner of record missing'
                            : e.item
                              ? 'draft saved'
                              : ''
              // A notice that went inside thirty days on a row off the Sent pile (v2.6624, punch list #248): the day it went stays in the row's words.
              const sentWords = e.pile !== 'sent' && e.sentItem?.sent_at ? `sent ${formatYmdMonthDay(calendarYmdInAppTzFromIso(e.sentItem.sent_at))}` : ''
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    // Stacked, the notice opens through the address, as a history entry of its own (punch list #182 PR 3).
                    if (stacked && onOpenNotice) onOpenNotice(e.jobId, pile)
                    else {
                      setSelectedJobId(e.jobId)
                      setMobileListShown(false)
                    }
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    {listLabel(e.jobId, 'notice', true)}
                    {g?.name ? <span style={{ color: 'var(--text-muted)' }}> · GC <LienFindMarked text={g.name} words={findWords} /></span> : null}
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.openBalance)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {deadlineWords(e) ? <span style={chip(sev.bg, sev.fg)}>{deadlineWords(e)}</span> : null}
                    {e.pile !== 'missed' && e.missedMonths.length ? (
                      <span style={chip('var(--bg-red-tint)', 'var(--text-red-600)')} data-lien-desk-missed-chip title={e.missedUnrecorded.length ? 'The window closed with nothing recorded — the pane has the note' : 'The window closed; someone noted it'}>
                        {e.missedMonths.map(workMonthShort).join(', ')} window closed{e.missedUnrecorded.length ? ' · not noted' : ''}
                      </span>
                    ) : null}
                    <span>{named.map(workMonthShort).join(' + ')}</span>
                    {e.datedFromCreation ? <span data-lien-desk-dated-from-creation>· {lienStandInWords(e.datedFromBill === true)}</span> : null}
                    {state ? <span>· {state}</span> : null}
                    {sentWords ? <span data-lien-desk-sent-words>· {sentWords}</span> : null}
                    {(() => {
                      // Letter two (v2.3760): the second letter's clock on a sent notice, and its mark on a draft that is one.
                      const lt = data?.letterTwoByJob[e.jobId]
                      const draftTwo = e.item && e.item.status !== 'sent' ? parseLienDeskDraftFields(e.item.fields)?.letterTwo : undefined
                      if (draftTwo) return <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-800)')} data-lien-letter-two="draft">the attorney’s letter · {letterTwoKindLabel(draftTwo.kind)}</span>
                      if (!lt || (e.pile !== 'sent' && !e.sentItem) || lt.state === 'none' || lt.state === 'paid') return null
                      const tone = lt.state === 'overdue' ? chip('var(--bg-red-tint)', 'var(--text-red-600)') : lt.state === 'due' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : lt.state === 'sent' || lt.state === 'gc_authorized' || lt.state === 'owner_called' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : chip('var(--bg-subtle)', 'var(--text-muted)')
                      return <span style={tone} data-lien-letter-two={lt.state}>{lt.words}</span>
                    })()}
                    <LienSupplierMarkLine mark={supplierMarks.get(e.jobId)} />
                    <LienFindHits hits={findHits.get(e.jobId)} words={findWords} />
                  </span>
                </button>
              )
            })}
            </div>
          </Fragment>
        )
      })}
      {alsoSent.length ? (
        <>
          <div className="lienPileHead" data-lien-pile-head="also_sent" data-on="no" style={{ position: 'static', color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)' }}>
            <span className="lienPileHeadBtn" style={{ cursor: 'default' }}>
              Also sent · every notice out
              <span className="n" data-lien-pile-count="also_sent">{alsoSent.length}</span>
            </span>
          </div>
          <div data-lien-pile-rows="also_sent">
            {alsoSent.map((h) => (
              <button
                key={h.itemId}
                type="button"
                onClick={() => setCallerJobId(h.jobId)}
                data-lien-also-sent={h.jobId}
                title="Open the owner’s call on this notice"
                style={{ display: 'grid', gap: '0.2rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong><LienFindMarked text={h.who} words={findWords} /></strong>
                  <span style={{ color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }}>Open the call ›</span>
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span style={{ padding: '0 7px', borderRadius: 999, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontWeight: 700 }}>Sent {formatYmdMonthDay(h.facts.mailedOn)}</span> · <LienFindMarked text={h.what} words={findWords} />
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
