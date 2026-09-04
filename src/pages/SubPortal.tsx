import { useEffect, useMemo, useState } from 'react'
import { publicFunctionHeaders, sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'
import type { CSSProperties, FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ContractAcceptSignatureForm } from '../components/contracts/ContractAcceptSignatureForm'
import type { EstimateAcceptSubmitPayload } from '../components/estimates/EstimateAcceptBody'
import { formatPortalUsd } from '../lib/portal/portalPayload'
import { PORTAL_SHORT_ORIGIN, portalShortUrl } from '../lib/portal/portalShortOrigin'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN, PAPER_RED } from '../lib/portal/portalTheme'
import { SUB_PORTAL_DEMO_PAYLOAD } from '../lib/subPortal/subPortalDemoFixture'
import {
  formatPayRunDay,
  formatSubPortalDate,
  subPortalT,
  type SubPortalLang,
  type SubPortalStringKey,
} from '../lib/subPortal/subPortalI18n'
import {
  parseSubPortalPayload,
  type SubPortalDoc,
  type SubPortalOffer,
  type SubPortalPayload,
  type SubPortalSheet,
} from '../lib/subPortal/subPortalPayload'

/**
 * Sub portal (sub-portal train): the no-login "Work & pay statement" behind a
 * minted capability link — the customer portal's sibling for subcontractors.
 * Jobs with agreed line items and open balances, the payment ledger (memos
 * sub-visible by design), sign-to-accept work offers, and paperwork STATUS.
 * Bilingual (EN/ES toggle), print-ready (the Print button is the PDF path),
 * deliberately single-theme light with every color painted explicitly.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; payload: SubPortalPayload }

const sectionHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 10,
  borderBottom: `1px solid ${INK}`,
  paddingBottom: 5,
  marginTop: '2.1rem',
}
const sectionTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  margin: 0,
}
const sectionNoteStyle: CSSProperties = { fontSize: 11.5, color: MUTED }
const cardStyle: CSSProperties = {
  background: CARD,
  border: `1px solid ${HAIR}`,
  borderRadius: 8,
  marginTop: 13,
  overflow: 'hidden',
}

function money(n: number): string {
  return formatPortalUsd(n)
}

export default function SubPortal() {
  const [params] = useSearchParams()
  const { slug: slugParam } = useParams<{ slug?: string }>()
  const token = params.get('t')?.trim() ?? ''
  const slug = (slugParam ?? '').trim().toLowerCase()
  const demoMode = import.meta.env.DEV && params.get('demo') === '1'
  // What customers see (v2.2760): the sample token renders the fixture for a signed-in office user.
  const sample = sampleStateFromToken(token)
  const [lang, setLang] = useState<SubPortalLang>('en')
  const [state, setState] = useState<PageState>({ kind: 'loading' })

  const t = (key: SubPortalStringKey, vars?: Record<string, string>) => subPortalT(lang, key, vars)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    let cancelled = false
    if (demoMode) {
      setState({ kind: 'ready', payload: SUB_PORTAL_DEMO_PAYLOAD })
      return
    }
    if (!token && !slug) {
      setState({ kind: 'error', message: 'This link is missing its key. Please use the exact link we sent you.' })
      return
    }
    void (async () => {
      try {
        const query = token ? `token=${encodeURIComponent(token)}` : `slug=${encodeURIComponent(slug)}`
        const res = await fetch(`${supabaseUrl}/functions/v1/sub-portal?${query}`, sample ? { headers: await publicFunctionHeaders(sample) } : undefined)
        const body: unknown = await res.json().catch(() => null)
        if (cancelled) return
        const payload = parseSubPortalPayload(body)
        if (!res.ok || !payload) {
          const msg =
            body != null && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
              ? String((body as { error: string }).error)
              : 'We could not open your statement. Please try again, or call our office.'
          setState({ kind: 'error', message: msg })
          return
        }
        setState({ kind: 'ready', payload })
      } catch {
        if (!cancelled) {
          setState({ kind: 'error', message: 'We could not open your statement. Please check your connection and try again.' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, slug, demoMode, sample])

  const submitToken = state.kind === 'ready' ? (state.payload.requestToken ?? token) : token

  return (
    <div
      data-theme="light"
      style={{
        minHeight: '100vh',
        background: PAPER,
        color: INK,
        fontFamily: `-apple-system, 'Segoe UI', Roboto, sans-serif`,
        padding: '2rem 1rem 4rem',
      }}
    >
      <style>{`
        @media print {
          body{background:#fff}
          [data-screen-only]{display:none !important}
          [data-print-only]{display:block !important}
          [data-print-page]{break-before:page;page-break-before:always}
          [data-avoid-break]{break-inside:avoid;page-break-inside:avoid}
        }
        [data-print-only]{display:none !important}
        @media print { [data-print-only]{display:block !important} }
        /* Sub sheet stage rail (v2.2767): four dots, one lit */
        .sp-rail{display:grid;grid-template-columns:repeat(4,1fr);position:relative;margin:10px 0 2px;z-index:0}
        .sp-rail::before{content:'';position:absolute;left:12.5%;right:12.5%;top:7px;height:2px;background:${HAIR}}
        .sp-st{position:relative;text-align:center;font-size:10.5px;letter-spacing:.02em;color:${FAINT};line-height:1.25;padding:0 2px}
        .sp-st i{display:block;width:14px;height:14px;border-radius:50%;background:${CARD};border:2px solid ${HAIR};margin:0 auto 5px;font-style:normal;font-size:9px;line-height:10px;color:#fff;box-sizing:border-box}
        .sp-st.done{color:${PAPER_GREEN}}
        .sp-st.done i{background:${PAPER_GREEN};border-color:${PAPER_GREEN}}
        .sp-st.now{color:${COPPER};font-weight:700}
        .sp-st.now i{background:${COPPER};border-color:${COPPER};box-shadow:0 0 0 3px #f6e6d8}
        .sp-st.done::after,.sp-st.now::after{content:'';position:absolute;top:7px;left:-50%;width:100%;height:2px;background:${PAPER_GREEN};z-index:-1}
        .sp-st:first-child::after{display:none}
        @media (max-width:400px){.sp-st{font-size:9.5px}}
      `}</style>
      <div style={{ maxWidth: 730, margin: '0 auto' }}>
        <div data-screen-only style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <button
            type="button"
            aria-pressed={lang === 'es'}
            onClick={() => setLang((l) => (l === 'es' ? 'en' : 'es'))}
            style={{
              background: lang === 'es' ? INK : CARD,
              color: lang === 'es' ? '#fff' : INK,
              border: `1px solid ${lang === 'es' ? INK : HAIR}`,
              borderRadius: 999,
              padding: '0.3rem 0.9rem',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {lang === 'es' ? 'English' : 'Español'}
          </button>
        </div>

        {sample ? <SampleModeBanner /> : null}
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', padding: '0.2rem 0 1.1rem' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
              CLICK<span style={{ color: COPPER }}>.</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: MUTED, marginTop: 4 }}>
              Plumbing, Electrical, and HVAC
            </div>
          </div>
          {state.kind === 'ready' && (
            <div style={{ textAlign: 'right', fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
              {t('statementKind')}
              <br />
              {t('preparedOn')} {formatSubPortalDate(state.payload.preparedOn, lang)}
              {state.payload.company.phone ? (
                <>
                  <br />
                  {state.payload.company.phone}
                </>
              ) : null}
            </div>
          )}
        </div>
        <div style={{ height: 3, background: INK }} />

        {state.kind === 'loading' && (
          <div style={{ padding: '3rem 0', color: MUTED, fontSize: 14 }} aria-busy>
            {t('opening')}
          </div>
        )}

        {state.kind === 'error' && (
          <div style={{ padding: '2.2rem 0', maxWidth: '54ch' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{t('couldNotOpenTitle')}</div>
            <p style={{ marginTop: 8, fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{state.message}</p>
          </div>
        )}

        {state.kind === 'ready' && (
          <SubPortalStatement payload={state.payload} lang={lang} t={t} submitToken={submitToken} />
        )}
      </div>
    </div>
  )
}

function PrintPageHeader({ payload, t, lang }: { payload: SubPortalPayload; t: T; lang: SubPortalLang }) {
  return (
    <div
      data-print-only
      style={{
        fontSize: 10.5,
        color: MUTED,
        borderBottom: `1px solid ${HAIR}`,
        paddingBottom: 4,
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>
          <b style={{ color: INK }}>CLICK.</b> · {payload.subName}
        </span>
        <span>
          {t('statementKind')} · {formatSubPortalDate(payload.preparedOn, lang)}
        </span>
      </div>
    </div>
  )
}

type T = (key: SubPortalStringKey, vars?: Record<string, string>) => string

function SubPortalStatement({
  payload,
  lang,
  t,
  submitToken,
}: {
  payload: SubPortalPayload
  lang: SubPortalLang
  t: T
  submitToken: string
}) {
  const payRunDayLabel = formatPayRunDay(payload.payRun.day, lang)
  const queuedNow = useMemo(() => {
    if (!payload.payRun.nextRun) return 0
    return payload.sheets
      .filter((s) => s.open > 0 && s.payableAfter != null && s.payableAfter <= (payload.payRun.nextRun as string))
      .reduce((sum, s) => sum + s.open, 0)
  }, [payload])
  const laterAmount = Math.max(0, payload.totals.open - queuedNow)

  return (
    <div>
      {/* Statement head */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', paddingTop: 22 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{t('workAndPay')}</h1>
          <div style={{ fontSize: 14.5, marginTop: 3 }}>{payload.subName}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{t('currentAsOfToday')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>
            {t('owedToYou')}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {money(payload.totals.open)}
          </div>
          <div style={{ height: 3, background: COPPER, marginTop: 5 }} />
          {queuedNow > 0 && payRunDayLabel && payload.payRun.nextRun ? (
            <div style={{ fontSize: 12, color: PAPER_GREEN, fontWeight: 700, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {money(queuedNow)} — {t('queuedForRun', { day: payRunDayLabel })}
            </div>
          ) : null}
          {laterAmount > 0 && queuedNow > 0 ? (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {money(laterAmount)} —{' '}
              {lang === 'es' ? 'después (vea cada trabajo abajo)' : 'later (see each job below)'}
            </div>
          ) : null}
        </div>
      </div>

      <div data-screen-only style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <span style={{ fontSize: 11, color: FAINT }}>{t('printHint')}</span>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            background: INK,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '0.5rem 1rem',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🖨 {t('printStatement')}
        </button>
      </div>

      {payload.payRun.explainer ? (
        <div style={{ background: NOTE_BAND, borderRadius: 8, marginTop: 20, padding: '0.7rem 0.95rem', fontSize: 12.5, display: 'flex', gap: 10, lineHeight: 1.55 }} data-avoid-break>
          <span aria-hidden style={{ fontSize: 15 }}>🗓</span>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 2 }}>
              {t('howPayWorks')}
            </div>
            {payload.payRun.explainer}
          </div>
        </div>
      ) : null}

      {/* Jobs */}
      <div style={sectionHeadStyle}>
        <h2 style={sectionTitleStyle}>{t('yourJobs')}</h2>
        <span style={sectionNoteStyle}>{t('yourJobsNote')}</span>
      </div>
      {payload.sheets.length === 0 ? (
        <p style={{ fontSize: 13.5, color: MUTED, marginTop: 12 }}>{t('noOpenJobs')}</p>
      ) : (
        payload.sheets.map((sheet) => (
          <SheetCard key={sheet.id} sheet={sheet} lang={lang} t={t} submitToken={submitToken} preparedOn={payload.preparedOn} />
        ))
      )}

      {/* Offers — screen only: a stale printed offer is a liability */}
      {payload.offers.length > 0 && (
        <div data-screen-only>
          <div style={sectionHeadStyle}>
            <h2 style={sectionTitleStyle}>{t('newWork')}</h2>
            <span style={sectionNoteStyle}>{t('newWorkNote')}</span>
          </div>
          {payload.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} payload={payload} lang={lang} t={t} submitToken={submitToken} />
          ))}
        </div>
      )}

      {/* Payments */}
      <div data-print-page>
        <PrintPageHeader payload={payload} t={t} lang={lang} />
        <div style={sectionHeadStyle}>
          <h2 style={sectionTitleStyle}>{t('paidToYou')}</h2>
          <span style={sectionNoteStyle}>{t('last90')}</span>
        </div>
        {payload.payments.length === 0 ? (
          <p style={{ fontSize: 13.5, color: MUTED, marginTop: 12 }}>{t('noPayments90')}</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 10 }}>
                <thead>
                  <tr>
                    {(['colDate', 'colJob', 'colNote', 'colAmount'] as const).map((k, i) => (
                      <th
                        key={k}
                        style={{
                          textAlign: i === 3 ? 'right' : 'left',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: MUTED,
                          padding: '4px 0',
                          borderBottom: `1px solid ${HAIR}`,
                        }}
                      >
                        {t(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.payments.map((line, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 12px 6px 0', borderBottom: `1px dotted ${HAIR}`, whiteSpace: 'nowrap' }}>
                        {formatSubPortalDate(line.date, lang)}
                      </td>
                      <td style={{ padding: '6px 12px 6px 0', borderBottom: `1px dotted ${HAIR}`, whiteSpace: 'nowrap' }}>
                        {line.jobNumber ?? '—'}
                      </td>
                      <td style={{ padding: '6px 12px 6px 0', borderBottom: `1px dotted ${HAIR}`, color: line.amount < 0 ? PAPER_RED : INK }}>
                        {line.memo ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: '6px 0',
                          borderBottom: `1px dotted ${HAIR}`,
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          color: line.amount < 0 ? PAPER_RED : INK,
                        }}
                      >
                        {line.amount < 0 ? `−${money(Math.abs(line.amount))}` : money(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payload.payments.some((l) => l.amount < 0) && (
              <div style={{ fontSize: 11, color: FAINT, marginTop: 8 }}>{t('minusNote')}</div>
            )}
          </>
        )}
        <div
          data-avoid-break
          style={{
            background: CARD,
            border: `1px solid ${HAIR}`,
            borderRadius: 8,
            marginTop: 16,
            marginLeft: 'auto',
            maxWidth: 340,
            padding: '0.75rem 0.95rem',
            fontSize: 13.5,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '3px 0' }}>
            <span>{t('earnedToDate')}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(payload.totals.earned)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '3px 0' }}>
            <span>{t('paidToDate')}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(payload.totals.paid)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 14,
              fontWeight: 800,
              borderTop: `1px solid ${INK}`,
              marginTop: 5,
              paddingTop: 7,
            }}
          >
            <span>{t('balanceOwed')}</span>
            <span style={{ borderBottom: `3px double ${INK}`, fontVariantNumeric: 'tabular-nums' }}>
              {money(payload.totals.open)}
            </span>
          </div>
        </div>
      </div>

      {/* Paperwork */}
      <div data-print-page>
        <PrintPageHeader payload={payload} t={t} lang={lang} />
        <div style={sectionHeadStyle}>
          <h2 style={sectionTitleStyle}>{t('paperwork')}</h2>
          <span style={sectionNoteStyle}>{t('paperworkNote')}</span>
        </div>
        {payload.documents.length === 0 ? (
          <p style={{ fontSize: 13.5, color: MUTED, marginTop: 12 }}>{t('noPaperwork')}</p>
        ) : (
          payload.documents.map((doc) => (
            <DocRow key={doc.id} doc={doc} payload={payload} lang={lang} t={t} submitToken={submitToken} />
          ))
        )}
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.55 }}>{t('paperworkReassure')}</p>

        {/* The short-address card PRINTS: it is the paper → phone bridge. */}
        {payload.slug ? (
          <div
            data-avoid-break
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              background: CARD,
              border: `1px solid ${HAIR}`,
              borderRadius: 8,
              marginTop: 26,
              padding: '0.9rem 0.95rem',
              flexWrap: 'wrap',
            }}
          >
            <QRCodeSVG value={portalShortUrl(payload.slug)} size={74} bgColor="#ffffff" fgColor={INK} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t('yourPage')}</div>
              <div style={{ color: COPPER, fontWeight: 700, fontSize: 13.5, overflowWrap: 'anywhere' }}>
                {PORTAL_SHORT_ORIGIN.replace(/^https:\/\//, '')}{payload.slug}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.5 }}>{t('yourPageBody')}</div>
            </div>
          </div>
        ) : null}
      </div>

      <AvailabilityCard t={t} submitToken={submitToken} />

      <div style={{ marginTop: 30, fontSize: 11, color: FAINT, textAlign: 'center' }}>
        {t('footer')}
        {payload.company.phone ? `: ${payload.company.phone}` : ''}
      </div>
    </div>
  )
}

type WorkDoneUi = { kind: 'idle' } | { kind: 'asking' } | { kind: 'sending' } | { kind: 'done' }

/**
 * One job card (v2.2767 stages): line items, the Agreed · Paid · Open row,
 * the four-dot tracker rail with its plain-words sentence, the office's
 * pay-when line, and — only while the sheet is waiting on work — the sub's
 * one button: "My work here is done" (optional note → the office walks it).
 */
function SheetCard({
  sheet,
  lang,
  t,
  submitToken,
  preparedOn,
}: {
  sheet: SubPortalSheet
  lang: SubPortalLang
  t: T
  submitToken: string
  preparedOn: string
}) {
  const [stage, setStage] = useState(sheet.stage)
  const [stageChangedOn, setStageChangedOn] = useState(sheet.stageChangedOn)
  const [stageSource, setStageSource] = useState(sheet.stageSource)
  const [ui, setUi] = useState<WorkDoneUi>({ kind: 'idle' })
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const payWhenParts: string[] = []
  if (sheet.payableAfter) payWhenParts.push(t('payableAfter', { date: formatSubPortalDate(sheet.payableAfter, lang) }))
  if (sheet.payHoldReason) payWhenParts.push(sheet.payHoldReason)

  const stageIndex = stage === 'working' ? 0 : stage === 'walkthrough' ? 1 : 2
  const railLabels = [t('railWork'), t('railWalk'), t('railCustomer'), t('railPaid')]
  const chip =
    stage === 'working'
      ? { label: t('inProgress'), bg: '#e7effa', fg: '#1d4e89' }
      : stage === 'walkthrough'
        ? { label: t('chipWalk'), bg: '#f6e6d8', fg: COPPER }
        : { label: t('chipCustomer'), bg: '#f6e6d8', fg: COPPER }
  const changedLabel = stageChangedOn ? formatSubPortalDate(stageChangedOn, lang) : null
  const sentence =
    stage === 'working'
      ? t('stageWorkingLine')
      : stage === 'walkthrough'
        ? stageSource === 'portal' && changedLabel
          ? t('stageWalkPortalLine', { date: changedLabel })
          : t('stageWalkOfficeLine')
        : t('stageCustomerLine', { date: changedLabel ? (lang === 'es' ? ` el ${changedLabel}` : ` ${changedLabel}`) : '' })

  async function markWorkDone() {
    setUi({ kind: 'sending' })
    setError(null)
    const finish = (on: string) => {
      setStage('walkthrough')
      setStageChangedOn(on)
      setStageSource('portal')
      setUi({ kind: 'done' })
    }
    // Nothing is saved in sample mode — the walkthrough just shows the answered state.
    if (sampleStateFromToken(submitToken)) {
      finish(preparedOn)
      return
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-sub-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: submitToken, kind: 'mark_work_done', laborJobId: sheet.id, note: note.trim() }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; stageChangedOn?: string; error?: string } | null
      if (res.ok && json?.ok) {
        finish(typeof json.stageChangedOn === 'string' && json.stageChangedOn ? json.stageChangedOn : preparedOn)
        return
      }
      setError(json?.error ?? 'Something went wrong. Please try again, or call the office.')
      setUi({ kind: 'asking' })
    } catch {
      setError('Something went wrong. Please check your connection.')
      setUi({ kind: 'asking' })
    }
  }

  const where = sheet.address ?? sheet.jobNumber ?? t('workOrder')

  return (
    <div style={cardStyle} data-avoid-break>
      <div
        style={{
          background: NOTE_BAND,
          padding: '0.5rem 0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 13.5 }}>
          <span style={{ fontWeight: 700 }}>{sheet.jobNumber ?? t('workOrder')}</span>
          {sheet.address ? <span style={{ color: MUTED }}> · {sheet.address}</span> : null}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            borderRadius: 999,
            padding: '3px 9px',
            background: chip.bg,
            color: chip.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {chip.label}
        </span>
      </div>
      <div style={{ padding: '0.65rem 0.9rem 0.8rem' }}>
        {sheet.items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 13,
              padding: '4px 0',
              borderBottom: `1px dotted ${HAIR}`,
            }}
          >
            <span>{item.label}</span>
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(item.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 26, marginTop: 9, fontSize: 13, flexWrap: 'wrap' }}>
          {(
            [
              ['agreed', sheet.agreed, INK],
              ['paidLabel', sheet.paid + sheet.backcharges, PAPER_GREEN],
              ['openLabel', sheet.open, COPPER],
            ] as const
          ).map(([key, value, color]) => (
            <div key={key} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>
                {t(key)}
              </div>
              <div style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{money(value)}</div>
            </div>
          ))}
        </div>

        {/* The tracker rail: what stands between the sub and this money */}
        <div className="sp-rail" role="list" aria-label={railLabels.join(' → ')}>
          {railLabels.map((label, i) => (
            <div key={label} role="listitem" className={`sp-st${i < stageIndex ? ' done' : i === stageIndex ? ' now' : ''}`} aria-current={i === stageIndex ? 'step' : undefined}>
              <i aria-hidden>{i < stageIndex ? '✓' : ''}</i>
              {label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 12.5, color: MUTED, borderTop: `1px solid ${HAIR}`, paddingTop: 8, lineHeight: 1.5 }}>
          {ui.kind === 'done' ? <strong style={{ color: PAPER_GREEN }}>{t('workDoneThanks')}</strong> : sentence}
        </div>
        {payWhenParts.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            <strong style={{ color: PAPER_GREEN }}>{payWhenParts[0]}</strong>
            {payWhenParts.length > 1 ? <> — {payWhenParts.slice(1).join(' — ')}</> : null}
          </div>
        )}

        {stage === 'working' && ui.kind === 'idle' && (
          <div data-screen-only>
            <button
              type="button"
              onClick={() => setUi({ kind: 'asking' })}
              style={{ background: PAPER_GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 10 }}
            >
              {t('workDoneButton')}
            </button>
          </div>
        )}
        {stage === 'working' && (ui.kind === 'asking' || ui.kind === 'sending') && (
          <div data-screen-only style={{ marginTop: 10, borderTop: `1px solid ${HAIR}`, paddingTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t('workDoneTitle', { where })}</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2, lineHeight: 1.5 }}>{t('workDoneBody')}</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder={t('workDonePlaceholder')}
              disabled={ui.kind === 'sending'}
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${HAIR}`, borderRadius: 6, background: 'var(--surface)', color: INK, padding: '0.5rem 0.6rem', fontSize: 13.5, fontFamily: 'inherit', minHeight: 56, marginTop: 8 }}
            />
            {error ? <div style={{ color: PAPER_RED, fontSize: 12.5, marginTop: 6 }}>{error}</div> : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                disabled={ui.kind === 'sending'}
                onClick={() => void markWorkDone()}
                style={{ background: PAPER_GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', fontSize: 13, fontWeight: 700, cursor: ui.kind === 'sending' ? 'wait' : 'pointer' }}
              >
                {ui.kind === 'sending' ? '…' : t('workDoneConfirm')}
              </button>
              <button
                type="button"
                disabled={ui.kind === 'sending'}
                onClick={() => {
                  setUi({ kind: 'idle' })
                  setError(null)
                }}
                style={{ background: CARD, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '0.5rem 1rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('workDoneNotYet')}
              </button>
            </div>
            <div style={{ fontSize: 11, color: FAINT, marginTop: 8 }}>{t('workDoneFootnote')}</div>
          </div>
        )}
      </div>
    </div>
  )
}

type OfferUiState =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'declining' }
  | { kind: 'submitting' }
  | { kind: 'accepted' }
  | { kind: 'declined' }

function OfferCard({
  offer,
  payload,
  lang,
  t,
  submitToken,
}: {
  offer: SubPortalOffer
  payload: SubPortalPayload
  lang: SubPortalLang
  t: T
  submitToken: string
}) {
  const [ui, setUi] = useState<OfferUiState>({ kind: 'idle' })
  const [printedName, setPrintedName] = useState('')
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const msaLine = useMemo(() => {
    const msa = payload.documents.find(
      (d) => d.detail.kind === 'signed' && /master subcontract/i.test(d.name),
    )
    const base = t('underMsa')
    if (msa && msa.detail.kind === 'signed') {
      const dateLabel = formatSubPortalDate(msa.detail.signedOn, lang)
      return lang === 'es'
        ? `${base.slice(0, -1)}, firmado el ${dateLabel}.`
        : `${base.slice(0, -1)}, signed ${dateLabel}.`
    }
    return base
  }, [payload.documents, lang, t])

  async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    // Nothing is saved in sample mode — the walkthrough just shows the answered state.
    if (sampleStateFromToken(submitToken)) return { ok: true }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-sub-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: submitToken, commitmentId: offer.id, ...body }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) return { ok: false, error: json?.error }
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  async function submitAccept(p: EstimateAcceptSubmitPayload) {
    setUi({ kind: 'submitting' })
    setError(null)
    const result = await post({
      kind: 'accept_offer',
      printedName: p.printedName,
      agreedTerms: true,
      ...(p.mode === 'draw' ? { signaturePngBase64: p.signaturePngBase64 } : {}),
    })
    if (result.ok) {
      setUi({ kind: 'accepted' })
    } else {
      setError(result.error ?? 'Could not record the signature. Try again, or call the office.')
      setUi({ kind: 'signing' })
    }
  }

  async function submitDecline() {
    if (!declineReason.trim()) return
    setUi({ kind: 'submitting' })
    setError(null)
    const result = await post({ kind: 'decline_offer', reason: declineReason.trim() })
    if (result.ok) {
      setUi({ kind: 'declined' })
    } else {
      setError(result.error ?? 'Something went wrong. Try again, or call the office.')
      setUi({ kind: 'declining' })
    }
  }

  return (
    <div style={{ ...cardStyle, border: `2px solid ${COPPER}`, padding: '0.85rem 0.95rem', overflow: 'visible' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{offer.title}</div>
          {offer.startsLabel ? <div style={{ color: MUTED, fontSize: 12.5, marginTop: 2 }}>{offer.startsLabel}</div> : null}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(offer.total)}</div>
      </div>
      <div style={{ marginTop: 8 }}>
        {offer.lines.map((line, i) => (
          <div
            key={i}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '3px 0', borderBottom: `1px dotted ${HAIR}`, color: MUTED }}
          >
            <span>{line.label}</span>
            {line.amount != null ? (
              <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(line.amount)}</span>
            ) : null}
          </div>
        ))}
      </div>
      {offer.expiresOn ? (
        <div style={{ fontSize: 11, color: FAINT, marginTop: 6 }}>
          {t('offerExpires', { date: formatSubPortalDate(offer.expiresOn, lang) })}
        </div>
      ) : null}

      {ui.kind === 'accepted' && (
        <div style={{ marginTop: 12, color: PAPER_GREEN, fontWeight: 700, fontSize: 14 }}>{t('offerAccepted')}</div>
      )}
      {ui.kind === 'declined' && (
        <div style={{ marginTop: 12, color: MUTED, fontWeight: 600, fontSize: 13.5 }}>{t('offerDeclined')}</div>
      )}

      {ui.kind === 'idle' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setUi({ kind: 'signing' })}
            style={{ background: PAPER_GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '0.55rem 1.1rem', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            ✍ {t('signToAccept')}
          </button>
          <button
            type="button"
            onClick={() => setUi({ kind: 'declining' })}
            style={{ background: CARD, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '0.55rem 1.1rem', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {t('pass')}
          </button>
          {payload.company.phone ? (
            <span style={{ fontSize: 12, color: MUTED }}>
              {t('orCallOffice')} {payload.company.phone}
            </span>
          ) : null}
        </div>
      )}

      {(ui.kind === 'signing' || (ui.kind === 'submitting' && !declineReason.trim())) && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${HAIR}` }}>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>{msaLine}</div>
          <ContractAcceptSignatureForm
            printedName={printedName}
            agreed={agreedTerms}
            onPrintedNameChange={setPrintedName}
            onAgreedChange={setAgreedTerms}
            formError={error}
            submitting={ui.kind === 'submitting'}
            onSubmit={(p) => void submitAccept(p)}
            heading={t('signToAccept')}
            disclosure={t('signDisclosure')}
            agreeLabel={t('signAgreeLabel')}
            submitLabel={t('signSubmit')}
          />
          <button
            type="button"
            disabled={ui.kind === 'submitting'}
            onClick={() => {
              setUi({ kind: 'idle' })
              setError(null)
            }}
            style={{ marginTop: 6, background: 'none', border: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {(ui.kind === 'declining' || (ui.kind === 'submitting' && declineReason.trim() !== '')) && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{t('declineWhy')}</label>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            disabled={ui.kind === 'submitting'}
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${HAIR}`, borderRadius: 6, background: 'var(--surface)', color: INK, padding: '0.5rem 0.6rem', fontSize: 13.5, fontFamily: 'inherit', minHeight: 56 }}
          />
          {error ? <div style={{ color: PAPER_RED, fontSize: 12.5, marginTop: 6 }}>{error}</div> : null}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              disabled={ui.kind === 'submitting' || !declineReason.trim()}
              onClick={() => void submitDecline()}
              style={{ background: INK, color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 1rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('declineSend')}
            </button>
            <button
              type="button"
              disabled={ui.kind === 'submitting'}
              onClick={() => {
                setUi({ kind: 'idle' })
                setError(null)
              }}
              style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DocRow({
  doc,
  payload,
  lang,
  t,
  submitToken,
}: {
  doc: SubPortalDoc
  payload: SubPortalPayload
  lang: SubPortalLang
  t: T
  submitToken: string
}) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badge =
    doc.state === 'on_file'
      ? { bg: '#e8f3ea', fg: PAPER_GREEN, glyph: '✓' }
      : doc.state === 'expiring'
        ? { bg: '#fdf1e3', fg: COPPER, glyph: '!' }
        : { bg: '#fbe9e7', fg: PAPER_RED, glyph: doc.signable ? '✍' : '!' }

  const detailText = (() => {
    switch (doc.detail.kind) {
      case 'signed':
        return t('docSigned', { date: formatSubPortalDate(doc.detail.signedOn, lang) })
      case 'on_file':
        return t('docOnFile')
      case 'expires':
        return t('docExpires', { date: formatSubPortalDate(doc.detail.on, lang) })
      case 'expired':
        return t('docExpired', { date: formatSubPortalDate(doc.detail.on, lang) })
      case 'needs_signature':
        return t('docNeedsSignature')
    }
  })()

  async function openSigningPage() {
    if (sampleStateFromToken(submitToken)) {
      // The sample agreement lives on the same sample token.
      window.location.href = `/contract/accept?t=${submitToken}`
      return
    }
    setOpening(true)
    setError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-sub-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: submitToken, kind: 'sign_link', documentId: doc.id }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; signPath?: string; error?: string } | null
      if (json?.ok && typeof json.signPath === 'string' && json.signPath.startsWith('/contract/accept?')) {
        window.location.href = json.signPath
        return
      }
      setError(json?.error ?? 'Something went wrong. Please call the office.')
    } catch {
      setError('Something went wrong. Please check your connection.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.1rem', borderBottom: `1px dotted ${HAIR}`, flexWrap: 'wrap' }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          flexShrink: 0,
          background: badge.bg,
          color: badge.fg,
        }}
      >
        {badge.glyph}
      </span>
      <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 160 }}>{doc.name}</span>
      <span style={{ color: MUTED, fontSize: 12 }}>{detailText}</span>
      {doc.signable && (
        <>
          <button
            data-screen-only
            type="button"
            disabled={opening}
            onClick={() => void openSigningPage()}
            style={{ background: COPPER, color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.9rem', fontSize: 12.5, fontWeight: 700, cursor: opening ? 'wait' : 'pointer' }}
          >
            {opening ? '…' : t('signNow')}
          </button>
          {payload.slug ? (
            <span data-print-only style={{ fontSize: 12, width: '100%' }}>
              {t('signAt')} {PORTAL_SHORT_ORIGIN.replace(/^https:\/\//, '')}{payload.slug}
            </span>
          ) : null}
        </>
      )}
      {error ? <span style={{ color: PAPER_RED, fontSize: 12, width: '100%' }}>{error}</span> : null}
    </div>
  )
}

function AvailabilityCard({ t, submitToken }: { t: T; submitToken: string }) {
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setError(null)
    if (sampleStateFromToken(submitToken)) {
      setStatus('sent')
      return
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-sub-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: submitToken, kind: 'availability', description, phone, website }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (json?.ok) {
        setStatus('sent')
      } else {
        setError(json?.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setError('Something went wrong. Please check your connection.')
      setStatus('error')
    }
  }

  return (
    <div data-screen-only style={{ marginTop: 34, borderTop: `2px dashed ${HAIR}`, paddingTop: 6 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT, textAlign: 'center' }}>
        ✂ · · · · · · · · · {t('tearLabel')} · · · · · · · · ·
      </div>
      <form
        onSubmit={(e) => void submit(e)}
        style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 8, marginTop: 10, padding: '0.9rem 0.95rem' }}
      >
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t('moreWork')}</div>
        <p style={{ margin: '3px 0 10px', fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{t('moreWorkBody')}</p>
        {status === 'sent' ? (
          <div style={{ color: PAPER_GREEN, fontWeight: 700, fontSize: 13.5 }}>{t('sentToOffice')}</div>
        ) : (
          <>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('availabilityPlaceholder')}
              disabled={status === 'sending'}
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${HAIR}`, borderRadius: 6, background: 'var(--surface)', color: INK, padding: '0.5rem 0.6rem', fontSize: 13.5, fontFamily: 'inherit', minHeight: 64 }}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              disabled={status === 'sending'}
              autoComplete="tel"
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${HAIR}`, borderRadius: 6, background: 'var(--surface)', color: INK, padding: '0.5rem 0.6rem', fontSize: 13.5, fontFamily: 'inherit', marginTop: 8 }}
            />
            {/* Honeypot — hidden from real people */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
            />
            {error ? <div style={{ color: PAPER_RED, fontSize: 12.5, marginTop: 6 }}>{error}</div> : null}
            <button
              type="submit"
              disabled={status === 'sending' || description.trim().length < 5}
              style={{ marginTop: 10, background: PAPER_GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '0.55rem 1.2rem', fontSize: 13.5, fontWeight: 700, cursor: status === 'sending' ? 'wait' : 'pointer' }}
            >
              {status === 'sending' ? '…' : t('sendToOffice')}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
