/**
 * The sub's Statements view (punch list #371, step 2): their statement of account to date, every work statement
 * with paid ones too, and every payment as one record, each with the PDF the office prints.
 *
 * The rows and the papers come from `subPortalStatements.ts`, over the kernel the office draws from. The page never
 * gives out a number: a statement of account saved here reads *Saved from your page*, and a work statement carries
 * a number only where the office has made the paper. A set that does not add up shows no figure, only that the
 * office is checking, with its phone.
 *
 * The view is screen only. Print prints the page's Today paper, as it always has. The PDFs are in English.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { formatPortalUsd } from '../../lib/portal/portalPayload'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER_GREEN, PAPER_RED, portalPressFill } from '../../lib/portal/portalTheme'
import { formatSubPortalDate, type SubPortalLang, type SubPortalStringKey } from '../../lib/subPortal/subPortalI18n'
import type { SubPortalPapers, SubPortalPapersReady } from '../../lib/subPortal/subPortalPapersPayload'
import { pagePaperContext, pageStatementOfAccount, statementRangeFrom, subPortalHowWords, subPortalStatementsView, type StatementsPaymentRow, type StatementsWorkRow } from '../../lib/subPortal/subPortalStatements'
import { drawSubPaperPdf } from '../../lib/subWorkOrders/subPaperPdfDraw'
import { subPaperAttachmentName, type SubPaper } from '../../lib/subWorkOrders/subPaperSend'
import { saveBlobAs } from '../../lib/storageSave'

type T = (key: SubPortalStringKey, vars?: Record<string, string>) => string

export type SubPortalStatementsViewProps = {
  papers: SubPortalPapers
  subName: string
  lang: SubPortalLang
  t: T
  /** The Today and Statements switch, drawn under the head as on the Today view. */
  switcher: ReactNode
  /** Draws and saves one paper. The page's own by default; a test hands in a recorder. */
  savePaper?: (paper: SubPaper, range: StatementRange) => Promise<void>
}

const TO_DATE: StatementRange = { from: null, to: null }

async function saveToDevice(paper: SubPaper, range: StatementRange): Promise<void> {
  saveBlobAs(await drawSubPaperPdf(paper, range), subPaperAttachmentName(paper))
}

const sectionHead: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${INK}`, paddingBottom: 5, marginTop: '2.1rem' }
const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', margin: 0 }
const sectionNote: CSSProperties = { fontSize: 11.5, color: MUTED }
const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 8, marginTop: 13, padding: '0.85rem 0.95rem' }
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', padding: '0.7rem 0', borderBottom: `1px solid ${HAIR}` }
const numberChip: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, fontWeight: 700, background: NOTE_BAND, color: INK, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }
const quietPress: CSSProperties = { font: 'inherit', fontSize: 13, fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 6, border: `1px solid ${HAIR}`, background: CARD, color: INK, cursor: 'pointer', whiteSpace: 'nowrap' }
const amountStyle: CSSProperties = { fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const smallLine: CSSProperties = { fontSize: 12.5, color: MUTED, marginTop: 2, lineHeight: 1.5 }

export function SubPortalStatementsView({ papers, subName, lang, t, switcher, savePaper = saveToDevice }: SubPortalStatementsViewProps) {
  const view = useMemo(() => (papers.ok ? subPortalStatementsView(papers) : null), [papers])
  const ready = papers.ok && view?.kind === 'ready' ? { papers, view } : null
  const phone = papers.officePhone
  const date = (ymd: string) => formatSubPortalDate(ymd, lang)

  return (
    <div data-screen-only data-testid="sub-portal-statements">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', paddingTop: 22 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{t('statementsTitle')}</h1>
          <div style={{ fontSize: 14.5, marginTop: 3 }}>{subName}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{t('currentAsOfToday')}</div>
        </div>
        {ready ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>{t('stillOpen')}</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }} data-testid="statements-still-open">
              {formatPortalUsd(ready.view.stillOpen)}
            </div>
            <div style={{ height: 3, background: COPPER, marginTop: 5 }} />
          </div>
        ) : null}
      </div>
      {switcher}
      {ready ? (
        <StatementsBody papers={ready.papers} work={ready.view.work} payments={ready.view.payments} stillOpen={ready.view.stillOpen} lastPayment={ready.view.lastPayment} lang={lang} t={t} date={date} savePaper={savePaper} />
      ) : (
        // The papers do not agree with each other. A sub never sees a paper that does not add up, nor the reason.
        <div style={{ ...card, marginTop: 20 }} role="status">
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t('checkingTitle')}</div>
          <div style={smallLine}>
            {t('checkingCall')}
            {phone ? (
              <>
                {': '}
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} style={{ color: INK, fontWeight: 700 }}>
                  {phone}
                </a>
              </>
            ) : (
              '.'
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatementsBody({
  papers,
  work,
  payments,
  stillOpen,
  lastPayment,
  lang,
  t,
  date,
  savePaper,
}: {
  papers: SubPortalPapersReady
  work: StatementsWorkRow[]
  payments: StatementsPaymentRow[]
  stillOpen: number
  lastPayment: { amount: number; ymd: string } | null
  lang: SubPortalLang
  t: T
  date: (ymd: string) => string
  savePaper: (paper: SubPaper, range: StatementRange) => Promise<void>
}) {
  const today = papers.ctx.today
  const [picking, setPicking] = useState(false)
  const [dates, setDates] = useState<{ from: string; to: string }>({ from: '', to: today })
  /** Which paper is being made: `soa`, a sheet id or a payment key. */
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const range = picking ? statementRangeFrom(dates, today) : TO_DATE
  const period = useMemo(() => (picking && range ? pageStatementOfAccount(papers, range, papers.ctx) : null), [picking, range, papers])

  /** The paper is built again at the press, so it says the moment it was saved. */
  const save = (id: string, pick: (rows: { work: StatementsWorkRow[]; payments: StatementsPaymentRow[] }, ctx: ReturnType<typeof pagePaperContext>) => { paper: SubPaper; range: StatementRange } | null) => {
    if (busy) return
    setBusy(id)
    setFailed(false)
    void (async () => {
      try {
        const ctx = pagePaperContext(papers, new Date())
        const fresh = subPortalStatementsView(papers, ctx)
        const made = fresh.kind === 'ready' ? pick(fresh, ctx) : null
        if (!made) throw new Error('no paper')
        await savePaper(made.paper, made.range)
      } catch {
        setFailed(true)
      } finally {
        setBusy(null)
      }
    })()
  }
  const pdfPress = (id: string, pick: Parameters<typeof save>[1], label: string = t('pdfPress')) => (
    <button type="button" style={{ ...quietPress, opacity: busy && busy !== id ? 0.6 : 1 }} disabled={busy != null} aria-busy={busy === id} onClick={() => save(id, pick)}>
      {busy === id ? t('makingPdf') : label}
    </button>
  )
  const sheetName = (s: { number: string; day: string }) => s.number || (s.day ? t('sheetOf', { date: date(s.day) }) : t('sheetNoDate'))
  const canSave = range != null

  return (
    <>
      {/* Statement of account */}
      <div style={{ ...card, marginTop: 20 }} data-testid="statements-soa">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <b style={{ fontSize: 15 }}>{t('soaTitle')}</b>
          <b style={{ ...amountStyle, fontSize: 18 }}>{formatPortalUsd(stillOpen)}</b>
        </div>
        <div style={smallLine}>
          {picking && period && range ? (
            <>
              {range.from ? `${date(range.from)} – ` : ''}
              {date(range.to ?? today)} · {t('soaPeriodOpen', { date: date(range.to ?? today), amount: formatPortalUsd(period.stillOpen) })}
            </>
          ) : picking ? (
            <span style={{ color: PAPER_RED }}>{t('datesNotAPeriod')}</span>
          ) : (
            <>
              {t('soaToDate')} · {stillOpen > 0 ? t('soaStillOpenWord') : t('soaNothingOpen')}
              {lastPayment ? ` · ${t('soaLastPayment', { amount: formatPortalUsd(lastPayment.amount), date: lastPayment.ymd ? date(lastPayment.ymd) : t('payNoDate') })}` : ''}
            </>
          )}
        </div>
        {picking ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('dateFrom')}
              <input type="date" value={dates.from} max={dates.to || today} onChange={(e) => setDates({ ...dates, from: e.target.value })} style={{ font: 'inherit', padding: '0.25rem 0.4rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('dateTo')}
              <input type="date" value={dates.to} max={today} onChange={(e) => setDates({ ...dates, to: e.target.value })} style={{ font: 'inherit', padding: '0.25rem 0.4rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK }} />
            </label>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            disabled={!canSave || busy != null}
            aria-busy={busy === 'soa'}
            onClick={() => (range ? save('soa', (_rows, ctx) => ({ paper: pageStatementOfAccount(papers, range, ctx), range })) : undefined)}
            style={{ font: 'inherit', fontSize: 13, fontWeight: 700, padding: '0.5rem 1rem', borderRadius: 6, border: 'none', cursor: canSave ? 'pointer' : 'default', ...portalPressFill(canSave) }}
          >
            {busy === 'soa' ? t('makingPdf') : t('saveAsPdf')}
          </button>
          <button type="button" style={quietPress} onClick={() => setPicking((v) => !v)}>
            {picking ? t('toDateButton') : t('pickDates')}
          </button>
        </div>
        {failed ? (
          <div role="alert" style={{ ...smallLine, color: PAPER_RED, marginTop: 8 }}>
            {t('pdfFailed')}
          </div>
        ) : null}
      </div>

      {/* Work statements */}
      <div style={sectionHead}>
        <h2 style={sectionTitle}>{t('workStatements')}</h2>
        <span style={sectionNote}>{t('workStatementsNote')}</span>
      </div>
      {work.length === 0 ? <p style={{ fontSize: 13.5, color: MUTED, marginTop: 12 }}>{t('noWorkStatements')}</p> : null}
      {work.map((w) => (
        <div key={w.sheetId} style={rowStyle} data-testid="statements-work-row">
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {w.number ? <span style={numberChip}>{w.number}</span> : null}
              <b style={{ fontSize: 14 }}>{w.job || sheetName({ number: '', day: papers.sheets.find((s) => s.id === w.sheetId)?.day ?? '' })}</b>
            </div>
            <div style={smallLine}>
              {w.paid > 0 ? t('wsLine', { total: formatPortalUsd(w.comesTo), paid: formatPortalUsd(w.paid) }) : t('wsNothingPaid', { total: formatPortalUsd(w.comesTo) })}
              {w.open > 0 ? (
                <>
                  {' · '}
                  <b style={{ color: INK }}>{t('wsOpen', { amount: formatPortalUsd(w.open) })}</b>
                </>
              ) : null}
            </div>
            {w.changedSince ? <div style={{ ...smallLine, color: FAINT }}>{t('wsChanged', { date: date(w.changedSince) })}</div> : null}
          </div>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {w.open > 0 ? <span style={amountStyle}>{formatPortalUsd(w.open)}</span> : <span style={{ fontSize: 11.5, fontWeight: 700, color: PAPER_GREEN, border: `1px solid ${HAIR}`, borderRadius: 999, padding: '1px 9px' }}>{t('paidLabel')}</span>}
            {pdfPress(w.sheetId, (rows) => {
              const row = rows.work.find((r) => r.sheetId === w.sheetId)
              return row ? { paper: row.paper, range: TO_DATE } : null
            })}
          </span>
        </div>
      ))}

      {/* Payments */}
      <div style={sectionHead}>
        <h2 style={sectionTitle}>{t('paymentsTitle')}</h2>
        <span style={sectionNote}>{t('paymentsNote')}</span>
      </div>
      {payments.length === 0 ? <p style={{ fontSize: 13.5, color: MUTED, marginTop: 12 }}>{t('noPaymentsYet')}</p> : null}
      {payments.map((p) => {
        const when = p.ymd ? (p.recorded ? t('payRecorded', { date: date(p.ymd) }) : date(p.ymd)) : t('payNoDate')
        const how = subPortalHowWords(p.how, lang)
        const parts = [...p.applied.map((a) => t('payApplied', { amount: formatPortalUsd(a.amount), statement: sheetName(a) })), ...(p.creditKept > 0 ? [t('payCreditKept', { amount: formatPortalUsd(p.creditKept) })] : []), ...(p.number ? [] : [t('payBeforeNumbers')])]
        return (
          <div key={p.key} style={rowStyle} data-testid="statements-payment-row">
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {p.number ? <span style={numberChip}>{p.number}</span> : null}
                <b style={{ fontSize: 14 }}>{[when, how].filter(Boolean).join(' · ')}</b>
              </div>
              <div style={smallLine}>{parts.join(' · ')}</div>
            </div>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={amountStyle}>{formatPortalUsd(p.amount)}</span>
              {p.received ? <span style={{ fontSize: 11.5, fontWeight: 700, color: PAPER_GREEN, border: `1px solid ${HAIR}`, borderRadius: 999, padding: '1px 9px' }}>{t('receivedOn', { date: date(p.received) })}</span> : null}
              {pdfPress(p.key, (rows) => {
                const row = rows.payments.find((r) => r.key === p.key)
                return row ? { paper: row.paper, range: TO_DATE } : null
              })}
            </span>
          </div>
        )
      })}

      {papers.sharedSheets > 0 || lang === 'es' ? (
        <div style={{ ...smallLine, marginTop: 16, color: FAINT }}>
          {papers.sharedSheets === 1 ? t('sharedOne') : papers.sharedSheets > 1 ? t('sharedMany', { count: String(papers.sharedSheets) }) : ''}
          {papers.sharedSheets > 0 && lang === 'es' ? ' ' : ''}
          {lang === 'es' ? t('pdfInEnglish') : ''}
        </div>
      ) : null}
    </>
  )
}

export default SubPortalStatementsView
