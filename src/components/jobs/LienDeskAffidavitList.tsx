import { Fragment, type ReactNode } from 'react'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { lienAffidavitSendOutcome } from '../../lib/jobs/lienAffidavitBatch'
import { LIEN_PRINT_WITH_LABEL, lienPrintWithChips } from '../../lib/jobs/lienAffidavitPrintBar'
import { lienAffidavitRedrawOutcome } from '../../lib/jobs/lienAffidavitRedraw'
import { affidavitGateMissingWord, type LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'
import { lienAffidavitsEmptyWords, lienListFindEmptyWords, lienPileEmptyWords } from '../../lib/jobs/lienDeskEmptyWords'
import { lienGateMarks, lienGateRowParts } from '../../lib/jobs/lienGateMarks'
import { lienGatePressByKeyboard } from '../../lib/jobs/lienGateLanding'
import { lienDeskJobLabel as jobLabel } from '../../lib/jobs/lienJobLabel'
import type { LienSupplierMark } from '../../lib/jobs/lienJobSuppliers'
import { AFFIDAVIT_PILE_WORDS, affidavitPileFor } from '../../lib/jobs/lienOwnerCall'
import { lienPhonePrintBoxFold } from '../../lib/jobs/lienPhonePane'
import { EmptyState } from '../EmptyState'
import { LienAffidavitSheetFlags } from './LienAffidavitSheetFlags'
import { affidavitDeadlineWords } from './LienDeskAffidavitPane'
import { lienBtnStyle as btn } from './lienDeskButtonStyles'
import { LIEN_PHONE_LIST_PRESS, lienRowChipStyle as chip, lienSeverityColors as severityColors } from './lienDeskRowStyles'
import { LienGateMarkStrip } from './LienGateMarkStrip'
import { LienSupplierMarkLine } from './LienJobSuppliers'
import { LienPileHead, lienPileHeadCount, type LienPileHeads } from './LienPileHeads'
import { LienSigningCountyBox } from './LienSigningCountyBox'
import type { LienDeskAffidavitsView } from './useLienDeskAffidavits'

/**
 * By paper → Lien affidavits, the list (v2.3412; its own file since v2.7585, out of `LienDesk.tsx` as it stood): the
 * three batch boxes over the rows (redraw on the short form, send the drafted ones, print the ready ones), the
 * held-only strip, then each pile under its sticky title with one row a job. Everything it shows comes from
 * `useLienDeskAffidavits`; the desk keeps the pick, the pressed pile, the find box and the lit title, and hands
 * them in. It holds no state, so nothing is lost while the list is off screen.
 */
export function LienDeskAffidavitList({
  aff,
  heads: affHeads,
  data,
  loading,
  isMobile,
  office,
  finding,
  find,
  onClearFind,
  affPile,
  onShowEveryPile,
  onShowCalendar,
  pileChips,
  supplierMarks,
  rowLabel,
  onPick,
}: {
  /** The list's rows and its batch boxes (`useLienDeskAffidavits`), and the piles' sticky titles (the desk's `useLienPileHeads`). */
  aff: LienDeskAffidavitsView
  heads: LienPileHeads<LienAffidavitPile>
  data: LienDeskData | null
  loading: boolean
  isMobile: boolean
  office: boolean
  /** The find box: whether words are typed, the words, and the press that clears them. */
  finding: boolean
  find: string
  onClearFind: () => void
  /** The pressed pile, and the press that shows every pile again. */
  affPile: LienAffidavitPile | null
  onShowEveryPile: () => void
  /** The empty list's door: By date's calendar, where nothing close shows. */
  onShowCalendar: () => void
  /** A phone's pile chips, at the top of the list where they scroll away with it; nothing on a computer. */
  pileChips: ReactNode
  supplierMarks: ReadonlyMap<string, LienSupplierMark>
  /** A row's job label, with the number as the door to the job where the desk has one. */
  rowLabel: (jobId: string) => ReactNode
  /** A row's press, and the press on a paper a batch names: the desk opens that job's pane. A row's own press says so (`'row'`, v2.8472), and the pane then lands on the row's open gate. */
  onPick: (jobId: string, from?: 'row' | 'row-keys') => void
}) {
  const { affVisible, affSelected, affHeldOnly, affPilesShown, redrawPlan, redrawWords, redrawReady, redrawBusy, redrawFailed, affSendPlan, affSendWords, sendDraftedAffidavits, affSendBusy, affSendFailed, affPrintPlan, affPrintStatus, affPrintWords, affPrintFolded, toggleAffPrintFold, printReadyAffidavits, affNoticeCopyCount, affHelpSheet, setAffHelpSheet, affNoticeRecord, setAffNoticeRecord, affNoticeCopies, setAffNoticeCopies, affSigning, affSheetPapers, affHeldStrip, showHeldAffidavits } = aff
  return (
    <div ref={affHeads.listRef} onScroll={affHeads.onScroll} data-lien-affidavit-list style={{ position: 'relative', borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }}>
      {pileChips}
      {affVisible.length === 0 ? (
        loading || data == null ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Looking at every unpaid job…</p>
        ) : (
          // Empty words (punch list #184, sweep C): a find clears, a pile lifts back to the list, and nothing close points at By date.
          <div data-lien-affidavit-empty={finding ? 'find' : affPile ?? 'list'} style={{ fontSize: '0.8125rem' }}>
            <EmptyState compact {...(finding ? lienListFindEmptyWords(find, onClearFind) : affPile ? lienPileEmptyWords(onShowEveryPile) : lienAffidavitsEmptyWords(onShowCalendar))} />
          </div>
        )
      ) : null}
      {office && (redrawPlan.ready.length > 0 || redrawFailed.length > 0) ? (
        <div data-lien-affidavit-redraw style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {redrawPlan.ready.length > 0 ? (
            <>
              <span>{redrawPlan.ready.length === 1 ? '1 ready affidavit is on the earlier form.' : `${redrawPlan.ready.length} ready affidavits are on the earlier form.`}</span>
              <button type="button" onClick={() => void redrawReady()} disabled={redrawBusy} style={{ ...btn('plain', redrawBusy), justifySelf: 'start', ...(isMobile ? LIEN_PHONE_LIST_PRESS : null) }}>
                {redrawBusy ? 'Redrawing…' : redrawWords.button}
              </button>
              {redrawWords.foot ? <span data-lien-affidavit-redraw-foot>{redrawWords.foot}</span> : null}
            </>
          ) : null}
          {redrawFailed.length > 0 ? (
            <div data-lien-affidavit-redraw-failed style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-red-600)' }}>
              <strong>{lienAffidavitRedrawOutcome(0, redrawFailed.length).head}</strong>
              {redrawFailed.map((f) => (
                <span key={f.jobId}>
                  <button type="button" onClick={() => onPick(f.jobId)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                    {jobLabel(data?.jobsById[f.jobId], f.jobId)}
                  </button>
                  {' · '}
                  {f.reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {office && (affSendPlan.ready.length > 0 || affSendFailed.length > 0) ? (
        <div data-lien-affidavit-send-all style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {affSendPlan.ready.length > 0 ? (
            <>
              <span>{affSendWords.lead}</span>
              <button type="button" onClick={() => void sendDraftedAffidavits()} disabled={affSendBusy} style={{ ...btn('plain', affSendBusy), justifySelf: 'start', ...(isMobile ? LIEN_PHONE_LIST_PRESS : null) }}>
                {affSendBusy ? 'Sending…' : affSendWords.button}
              </button>
              {affSendWords.foot ? <span data-lien-affidavit-send-all-foot>{affSendWords.foot}</span> : null}
              {affSendWords.hidden ? <span data-lien-affidavit-send-all-hidden>{affSendWords.hidden}</span> : null}
            </>
          ) : null}
          {affSendFailed.length > 0 ? (
            <div data-lien-affidavit-send-all-failed style={{ display: 'grid', gap: '0.2rem', color: 'var(--text-red-600)' }}>
              <strong>{lienAffidavitSendOutcome(0, affSendFailed.length).head}</strong>
              {affSendFailed.map((f) => (
                <span key={f.jobId}>
                  <button type="button" onClick={() => onPick(f.jobId)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                    {jobLabel(data?.jobsById[f.jobId], f.jobId)}
                  </button>
                  {' · '}
                  {f.reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {office && affPrintPlan.ready.length > 0 ? (
        <div data-lien-affidavit-print-all style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {/* The status line (v2.7209): what this press prints, and beside it the one warning as a press. On a phone the press sits under the words. */}
          <div data-lien-affidavit-print-status style={{ display: 'flex', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '0.35rem 0.6rem' }}>
            <span data-lien-affidavit-print-ready title={affPrintStatus.readyTip} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{affPrintStatus.ready}</span>
            {affPrintStatus.held ? (
              <button
                type="button"
                data-lien-affidavit-print-held
                aria-pressed={affHeldOnly}
                title={affPrintStatus.held.tip}
                onClick={() => showHeldAffidavits(!affHeldOnly)}
                style={{ padding: '2px 10px', borderRadius: 999, border: `1px solid ${affHeldOnly ? 'var(--text-amber-800)' : 'var(--border-amber)'}`, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {affPrintStatus.held.press} <span aria-hidden>›</span>
              </button>
            ) : null}
          </div>
          {/* On a phone one bar folds the rest of the box away (punch list #352, the leftovers): the count and the held papers stay, and the print press, the chips and the county stay mounted under the bar, so a tick or a typed county is kept (`index.css`). */}
          {isMobile ? (() => {
            const fold = lienPhonePrintBoxFold(affPrintFolded)
            return (
              <button type="button" data-lien-affidavit-print-fold aria-expanded={fold.expanded} onClick={toggleAffPrintFold} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 44, padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                <span>{fold.words}</span>
                <span aria-hidden="true">{fold.mark}</span>
              </button>
            )
          })() : null}
          <button type="button" onClick={printReadyAffidavits} style={{ ...btn('plain'), justifySelf: 'start' }}>
            {affPrintWords.button}
          </button>
          {/* What prints in front of the stack, as three ticked chips under one label (v2.7209). Each is still a tick box, kept on this computer: the help sheet (punch list #314) and the notice records (punch list #322) are on until the office turns them off, and the copies of the notices are off until someone ticks them. */}
          <div role="group" aria-labelledby="lien-affidavit-print-with" data-lien-affidavit-print-with style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.4rem' }}>
            <span id="lien-affidavit-print-with" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.1rem' }}>{LIEN_PRINT_WITH_LABEL}</span>
            {lienPrintWithChips(affNoticeCopyCount).map((c) => {
              const [on, set, hook] =
                c.key === 'help_sheet'
                  ? ([affHelpSheet, setAffHelpSheet, { 'data-lien-affidavit-help-sheet': true }] as const)
                  : c.key === 'notice_record'
                    ? ([affNoticeRecord, setAffNoticeRecord, { 'data-lien-affidavit-notice-record': true }] as const)
                    : ([affNoticeCopies, setAffNoticeCopies, { 'data-lien-affidavit-notice-copies': true }] as const)
              return (
                <label key={c.key} {...hook} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', padding: '2px 9px 2px 6px', borderRadius: 999, border: `1px solid ${on ? 'var(--bg-blue-tint)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ margin: 0 }} />
                  {c.label}
                </label>
              )
            })}
          </div>
          <LienSigningCountyBox id="lien-affidavit-signing-county" county={affSigning.county} onChange={affSigning.setCounty} />
          <LienAffidavitSheetFlags papers={affSheetPapers} labelFor={(jobId) => jobLabel(data?.jobsById[jobId], jobId)} onOpen={onPick} />
          {affPrintWords.foot ? <span data-lien-affidavit-print-all-foot>{affPrintWords.foot}</span> : null}
          {affPrintWords.hidden ? <span data-lien-affidavit-print-all-hidden>{affPrintWords.hidden}</span> : null}
        </div>
      ) : null}
      {/* The list narrowed to the held papers (v2.7209): how many, that each row says why, and the way back. */}
      {affHeldOnly && affPrintStatus.held ? (
        <div ref={affHeldStrip} data-lien-affidavit-held-only style={{ padding: '0.45rem 0.9rem', borderBottom: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem', fontSize: '0.78rem' }}>
          <span>{affPrintStatus.held.showing}</span>
          <button type="button" onClick={() => showHeldAffidavits(false)} style={{ ...btn('plain'), padding: '2px 10px', fontSize: '0.78rem' }}>
            {affPrintStatus.held.back}
          </button>
        </div>
      ) : null}
      {affPilesShown.map(({ p, label, rows, total }, i) => (
          <Fragment key={p}>
            <LienPileHead pile={p} label={label} count={lienPileHeadCount(rows.length, total, affHeldOnly ? undefined : data?.affidavits.counts[p], finding)} i={i} n={affPilesShown.length} phone={isMobile} on={affHeads.lit === p} empty={finding && rows.length === 0} onPress={() => affHeads.scrollToPile(p, i)} onShowEvery={affPile && !affHeldOnly ? onShowEveryPile : null} />
            <div data-lien-pile-rows={p}>
            {rows.map((e) => {
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === affSelected?.jobId
              const missing = e.gates.filter((x) => !x.ok).map((x) => affidavitGateMissingWord(x.key))
              // The pane's five gates as marks on the chip line (v2.7335): in the two early piles, after *last work*; the words stay where the strip is not drawn and on a phone, which has no hover.
              const gateParts = lienGateRowParts(e.pile, isMobile)
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={(ev) => onPick(e.jobId, lienGatePressByKeyboard(ev.detail) ? 'row-keys' : 'row')}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    {rowLabel(e.jobId)}
                    <span style={{ color: 'var(--text-muted)' }}> · {e.isSub ? `GC ${g?.name ?? ''}` : 'with the owner'}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.openBalance)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={chip(severityColors(e.severity).bg, severityColors(e.severity).fg)}>{affidavitDeadlineWords(e)}</span>
                    {(() => {
                      // Counsel's piles (v2.3767): from the owner's answers on the sent notice.
                      const pile = affidavitPileFor(data?.ownerCallByJob[e.jobId])
                      if (!pile) return null
                      const tone = pile === 'A' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : pile === 'B' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : chip('var(--bg-red-tint)', 'var(--text-red-600)')
                      return <span style={tone} data-lien-affidavit-pile={pile}>{pile} · {AFFIDAVIT_PILE_WORDS[pile].short}</span>
                    })()}
                    <span>last work {workMonthShort(e.lastMonth)}</span>
                    {gateParts.strip ? <LienGateMarkStrip marks={lienGateMarks(e.gates, e.isSub)} /> : null}
                    {gateParts.words && missing.length ? <span>· missing {missing.join(', ')}</span> : null}
                    <LienSupplierMarkLine mark={supplierMarks.get(e.jobId)} />
                  </span>
                </button>
              )
            })}
            </div>
          </Fragment>
      ))}
    </div>
  )
}
