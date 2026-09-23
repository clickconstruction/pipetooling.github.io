import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { publicFunctionHeaders, SAMPLE_BANNER_TEXT } from '../lib/customerSampleMode'
import { SAMPLE_TOKEN } from '../lib/customerSample'
import { formatPayLinkCents, isPayLinkId } from '../lib/billing/payLink'
import { PAY_LINK_FORWARD_MS, payLinkView, type PayLinkView } from '../lib/billing/payLinkView'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PAPER_GREEN, PORTAL_FONT } from '../lib/portal/portalTheme'

/**
 * `/pay/:id` (punch list #35, v2.3754): what a scanned pay code opens. One small page that
 * knows the bill — it names it, shows what is left, and forwards to Stripe's payment page a
 * moment later, with a button in case the forward is blocked. A paid bill says so and stops,
 * so the same code found on a letter a year on never asks for money twice. Public, light,
 * the portal's paper; the `pay-link` function answers from Stripe at scan time.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
/** What customers see (Settings): the sample token renders this bill and never forwards. */
const SAMPLE_VIEW: PayLinkView = {
  kind: 'open',
  url: '#sample',
  payload: { ok: true, state: 'open', url: '#sample', number: '1025-2609180905', jobName: 'Lago Vista St', company: 'Click Plumbing and Electrical', phone: '(512) 360-0599', amountRemainingCents: 466000, currency: 'usd', paidOn: null },
}
function longDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function PayLink() {
  const { id = '' } = useParams<{ id: string }>()
  const sample = id === SAMPLE_TOKEN
  const [view, setView] = useState<PayLinkView>(() => (sample ? SAMPLE_VIEW : isPayLinkId(id) ? { kind: 'loading' } : { kind: 'not_found' }))

  useEffect(() => {
    document.title = 'Pay your bill · Click Plumbing and Electrical'
  }, [])

  useEffect(() => {
    if (sample || !isPayLinkId(id)) return
    let live = true
    ;(async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/pay-link?id=${encodeURIComponent(id.trim().toLowerCase())}`, { headers: await publicFunctionHeaders(null) })
        const body: unknown = await res.json().catch(() => null)
        if (live) setView(payLinkView(res.status, body))
      } catch {
        if (live) setView({ kind: 'error', message: 'We could not reach our office system. Please check your connection and try again.' })
      }
    })()
    return () => {
      live = false
    }
  }, [id, sample])

  // The forward: `replace`, so the back button on Stripe's page returns to wherever the
  // customer came from, not to a page that would forward them again.
  useEffect(() => {
    if (view.kind !== 'open' || sample) return
    const t = window.setTimeout(() => window.location.replace(view.url), PAY_LINK_FORWARD_MS)
    return () => window.clearTimeout(t)
  }, [view, sample])

  const payload = 'payload' in view ? view.payload : null
  const company = payload?.company || 'Click Plumbing and Electrical'
  const phone = payload?.phone || '(512) 360-0599'
  const billLine = payload ? [payload.number ? `Invoice #${payload.number}` : 'Your bill', payload.jobName].filter(Boolean).join(' · ') : ''

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '3rem 1rem 4rem', display: 'grid', placeItems: 'start center', alignContent: 'start', gap: '0.75rem' }}>
      {sample ? (
        <div data-testid="pay-link-sample" style={{ width: '100%', maxWidth: 380, boxSizing: 'border-box', padding: '0.5rem 0.9rem', borderRadius: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)', fontSize: 12.5, textAlign: 'center' }}>
          {SAMPLE_BANNER_TEXT} The real page opens Stripe's payment page a moment after this.
        </div>
      ) : null}
      <main aria-live="polite" style={{ width: '100%', maxWidth: 380, background: CARD, border: `1px solid ${HAIR}`, borderRadius: 14, padding: '1.6rem 1.25rem 1.4rem', textAlign: 'center', display: 'grid', gap: '0.65rem', justifyItems: 'center', boxShadow: '0 10px 30px rgba(22,40,60,0.08)' }}>
        <img src={`${import.meta.env.BASE_URL}brand/click-mark.png`} alt="" width={64} height={64} style={{ display: 'block' }} />
        <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.02em' }}>{company}</div>

        {view.kind === 'loading' ? (
          <>
            <div style={{ color: MUTED, fontSize: 13.5 }}>Finding your bill…</div>
            <Spinner />
          </>
        ) : null}

        {view.kind === 'open' ? (
          <>
            <div style={{ color: MUTED, fontSize: 13 }}>{billLine}</div>
            {payload?.amountRemainingCents != null ? <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }} data-testid="pay-link-amount">{formatPayLinkCents(payload.amountRemainingCents)}</div> : null}
            <div style={{ fontSize: 13.5 }}>Opening your secure payment page…</div>
            <Spinner />
            <a href={view.url} style={{ ...btn, background: '#fde047', color: INK }} data-testid="pay-link-pay-now">
              Pay now
            </a>
            <div style={{ fontSize: 11, color: FAINT, lineHeight: 1.45 }}>Payments are taken by Stripe. Card or bank transfer.</div>
          </>
        ) : null}

        {view.kind === 'paid' ? (
          <>
            <div style={{ color: MUTED, fontSize: 13 }}>{billLine}</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: PAPER_GREEN }} data-testid="pay-link-paid">
              Paid
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {payload?.paidOn ? `This bill was paid on ${longDate(payload.paidOn)}. ` : 'This bill is paid. '}Nothing is owed on it. Thank you.
            </div>
            <div style={{ ...btn, background: 'var(--bg-green-100)', color: PAPER_GREEN }}>Nothing to pay</div>
            <div style={{ fontSize: 11, color: FAINT }}>
              Questions: <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} style={{ color: COPPER }}>{phone}</a>
            </div>
          </>
        ) : null}

        {view.kind === 'void' ? (
          <>
            <div style={{ color: MUTED, fontSize: 13 }}>{billLine}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>This bill was cancelled by our office. If you were expecting to pay something, please call us.</div>
            <CallButton phone={phone} />
          </>
        ) : null}

        {view.kind === 'no_link' ? (
          <>
            <div style={{ color: MUTED, fontSize: 13 }}>{billLine}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>We could not open the payment page for this bill. Please call us and we will take it over the phone.</div>
            <CallButton phone={phone} />
          </>
        ) : null}

        {view.kind === 'not_found' ? (
          <>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 12 }}>We could not find that bill. The code may be from an old letter.</div>
            <CallButton phone={phone} />
          </>
        ) : null}

        {view.kind === 'error' ? (
          <>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 12 }}>{view.message}</div>
            <CallButton phone={phone} />
          </>
        ) : null}
      </main>
    </div>
  )
}

const btn: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', marginTop: 4 }

function CallButton({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} style={{ ...btn, background: PAPER, color: INK, border: `1px solid ${HAIR}` }}>
      Call {phone}
    </a>
  )
}

function Spinner() {
  return (
    <span aria-hidden style={{ display: 'inline-block', width: 22, height: 22, border: `3px solid ${HAIR}`, borderTopColor: COPPER, borderRadius: '50%', animation: 'pay-link-spin 0.9s linear infinite' }}>
      <style>{'@keyframes pay-link-spin { to { transform: rotate(360deg) } }'}</style>
    </span>
  )
}
