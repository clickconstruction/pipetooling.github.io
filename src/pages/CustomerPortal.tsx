import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  formatPortalDate,
  formatPortalUsd,
  parsePortalPayload,
  portalDaysSinceBilled,
  PORTAL_TRADE_COLORS,
  splitPortalAddress,
  type PortalBill,
  type PortalPayload,
} from '../lib/portal/portalPayload'
import { groupPortalBillsByJob, portalBillBilledAmount, PORTAL_GENERIC_PAYMENT_METHOD, type PortalJobGroup } from '../lib/portal/portalJobGroups'
import { PORTAL_SHORT_ORIGIN, portalShortUrl } from '../lib/portal/portalShortOrigin'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN } from '../lib/portal/portalTheme'

/**
 * Customer / GC portal (portal train PR 1): the no-login "account statement"
 * page behind a minted capability token — outstanding bills with pay links,
 * set like a beautifully ruled paper statement (letterhead, ledger lines,
 * accounting double-rule total). Customer-facing ⇒ deliberately single-theme
 * light with every color painted explicitly (house convention: customer
 * surfaces pin light). Request forms arrive in the next portal PR.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string


export default function CustomerPortal() {
  const [params] = useSearchParams()
  const { slug: slugParam } = useParams<{ slug?: string }>()
  const token = params.get('t')?.trim() ?? ''
  const slug = (slugParam ?? '').trim().toLowerCase()
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; payload: PortalPayload }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!token && !slug) {
      setState({ kind: 'error', message: 'This link is missing its key. Please use the exact link we sent you.' })
      return
    }
    void (async () => {
      try {
        const query = token ? `token=${encodeURIComponent(token)}` : `slug=${encodeURIComponent(slug)}`
        const res = await fetch(`${supabaseUrl}/functions/v1/customer-portal?${query}`)
        const body: unknown = await res.json().catch(() => null)
        if (cancelled) return
        const payload = parsePortalPayload(body)
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
  }, [token, slug])

  const today = useMemo(() => {
    const d = new Date()
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }, [])

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: `-apple-system, 'Segoe UI', Roboto, sans-serif`, padding: '2rem 1rem 4rem' }}>
      <div style={{ maxWidth: 730, margin: '0 auto' }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', padding: '0.5rem 0 1.1rem' }}>
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
              {[state.payload.company.cityLine, state.payload.company.licenseLine].filter(Boolean).join(' · ')}
              {(state.payload.company.phone || state.payload.company.email) && (
                <>
                  <br />
                  {[state.payload.company.phone, state.payload.company.email].filter(Boolean).join(' · ')}
                </>
              )}
            </div>
          )}
        </div>
        <div style={{ height: 3, background: INK }} />

        {state.kind === 'loading' && (
          <div style={{ padding: '3rem 0', color: MUTED, fontSize: 14 }} aria-busy>
            Opening your statement…
          </div>
        )}

        {state.kind === 'error' && (
          <div style={{ padding: '2.2rem 0', maxWidth: '54ch' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>We couldn&#8217;t open this page</div>
            <p style={{ marginTop: 8, fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{state.message}</p>
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            <PortalStatement payload={state.payload} today={today} />
            <PortalRequestForms token={state.payload.requestToken ?? token} payload={state.payload} />
            {state.payload.slug && <PortalShortAddressCard slug={state.payload.slug} />}
            <div style={{ padding: '2rem 0 0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: MUTED }}>
                Thank you for your business — <i>the Click team</i>
              </span>
              <span style={{ fontSize: 10.5, color: FAINT }}>
                This link is private to you · requests go straight to our dispatch desk
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PortalStatement({ payload, today }: { payload: PortalPayload; today: string }) {
  // Same local-date basis as the header's date line, for the Billed age sub-lines.
  const d = new Date()
  const todayYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return (
    <>
      {/* Statement head */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', padding: '1.3rem 0 0.4rem' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: COPPER }}>
            Account statement
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{payload.customerName}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{today}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED }}>
            Balance due
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {formatPortalUsd(payload.totalDue)}
          </div>
          <div style={{ width: 64, height: 3, background: COPPER, margin: '6px 0 0 auto' }} />
        </div>
      </div>

      {/* Ledger */}
      {payload.bills.length === 0 ? (
        <div style={{ margin: '1.2rem 0', background: CARD, border: `1px solid ${HAIR}`, padding: '1.2rem 1.3rem', fontSize: 14.5 }}>
          <b>You&#8217;re all paid up.</b>{' '}
          <span style={{ color: MUTED }}>No open bills on your account — thank you.</span>
        </div>
      ) : (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: '0 18px', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, padding: '0 0 7px', borderBottom: `1.5px solid ${INK}` }}>
              <span>Billed</span>
              <span />
              <span style={{ textAlign: 'right' }}>Amount due</span>
              {/* Hidden pay-button twin: gives the header's last column the same
                  width as the rows' button column, so "Amount due" sits over
                  the money figures instead of the sheet edge. */}
              <span aria-hidden style={{ visibility: 'hidden', height: 0, overflow: 'hidden', padding: '0 16px', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                PAY ONLINE
              </span>
            </div>
            {(() => {
              const groups = groupPortalBillsByJob(payload.bills)
              return groups.map((g, i) => (
                <PortalJobGroupSection key={i} group={g} todayYmd={todayYmd} isLast={i === groups.length - 1} />
              ))
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: '0 18px', alignItems: 'center', padding: '11px 0 4px', fontSize: 14 }}>
              <span />
              <span style={{ fontWeight: 700, textAlign: 'right' }}>Total due</span>
              <span style={{ textAlign: 'right', fontWeight: 900, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${INK}`, borderBottom: `3px double ${INK}`, padding: '3px 0' }}>
                {formatPortalUsd(payload.totalDue)}
              </span>
              <span />
            </div>
          </div>
        </div>
      )}

    </>
  )
}

/**
 * One job's slice of the statement (v2.2318): a quiet note-band header, the
 * job's bills newest-first, and a right-aligned boxed recap that reads like a
 * little ledger (v2.2320) — Billed to date, every payment received by date,
 * Balance — the same totals grammar the invoice preview, PDF, and email box
 * use (v2.2313).
 */
function PortalJobGroupSection({ group, todayYmd, isLast }: { group: PortalJobGroup; todayYmd: string; isLast: boolean }) {
  const addr = splitPortalAddress(group.jobAddress)
  const headline = addr?.street ?? group.jobName ?? group.jobLabel
  const quiet = [addr?.rest ?? null, group.asGc && group.ownerName ? `owner: ${group.ownerName}` : null]
    .filter(Boolean)
    .join(' — ')
  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${HAIR}`, paddingBottom: 8 }}>
      {/* Trade-first job line (v2.2041), promoted from row to band. */}
      <div style={{ background: NOTE_BAND, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', padding: '8px 10px', marginTop: 16, fontSize: 13.5 }}>
        <span style={{ minWidth: 0 }}>
          {group.serviceTag && (
            <>
              <span style={{ fontWeight: 800, letterSpacing: '0.04em', color: PORTAL_TRADE_COLORS[group.serviceTag] }}>
                {group.serviceTag.toUpperCase()}
              </span>{' '}
            </>
          )}
          {group.jobNumber && (
            <>
              <span style={{ fontWeight: 700 }}>{group.jobNumber}</span>
              <span style={{ color: FAINT, padding: '0 2px' }}>&nbsp;•&nbsp;</span>
            </>
          )}
          <span style={{ fontWeight: 600 }}>{headline}</span>
          {group.asGc && (
            <span
              style={{
                marginLeft: 7,
                verticalAlign: 1,
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: COPPER,
                border: `1px solid ${COPPER}`,
                borderRadius: 3,
                padding: '1.5px 5px',
                whiteSpace: 'nowrap',
              }}
            >
              As GC
            </span>
          )}
        </span>
        {quiet && <span style={{ fontSize: 11.5, color: FAINT }}>{quiet}</span>}
      </div>
      {group.bills.map((b, i) => (
        <PortalBillRow key={i} bill={b} todayYmd={todayYmd} isLast={i === group.bills.length - 1} />
      ))}
      {group.showRecap && (
        <div style={{ margin: '10px 0 2px auto', width: 'min(320px, 100%)', boxSizing: 'border-box', background: CARD, border: `1px solid ${HAIR}`, padding: '10px 14px 11px', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
            <span>Billed to date</span>
            <span style={{ color: INK, fontWeight: 600 }}>{formatPortalUsd(group.billedToDate)}</span>
          </div>
          {/* Each payment by date (v2.2320) — the recap reads like a little
              ledger: billed, minus every payment received, equals balance.
              When the rows can't account for the whole cached total
              (job-remainder bills carry only the aggregate), one Paid-to-date
              line keeps the arithmetic honest instead. A multi-bill job with
              no payments shows neither — "− $0.00" would just be noise. */}
          {group.payments.length > 0 && Math.abs(group.paymentRowsTotal - group.totalPaid) < 0.005 ? (
            group.payments.map((pm, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                <span>
                  Paid {formatPortalDate(pm.date) ?? '—'}
                  {/* The generic label adds nothing after "Paid <date>" (v2.2322);
                      a real method — a check number — is worth the ink. */}
                  {pm.method !== PORTAL_GENERIC_PAYMENT_METHOD && <span style={{ color: FAINT }}> · {pm.method}</span>}
                </span>
                <span style={{ color: PAPER_GREEN, fontWeight: 600, whiteSpace: 'nowrap' }}>&minus; {formatPortalUsd(pm.amount)}</span>
              </div>
            ))
          ) : group.totalPaid > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
              <span>Paid to date</span>
              <span style={{ color: PAPER_GREEN, fontWeight: 600 }}>&minus; {formatPortalUsd(group.totalPaid)}</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${INK}`, fontSize: 13, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>
            <span>Balance on this job</span>
            <span>{formatPortalUsd(group.balance)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** One bill line inside a job group: date + age, what was billed, what's still due, how to pay. */
function PortalBillRow({ bill, todayYmd, isLast }: { bill: PortalBill; todayYmd: string; isLast: boolean }) {
  const age = portalDaysSinceBilled(bill.billedOn, todayYmd)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: '0 18px', alignItems: 'center', padding: '12px 0 12px 10px', borderBottom: isLast ? 'none' : `1px solid ${HAIR}`, fontSize: 13.5 }}>
      <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
        {formatPortalDate(bill.billedOn) ?? '—'}
        {age && (
          <>
            <br />
            <span style={{ fontSize: 10.5, color: age.aging ? COPPER : FAINT, fontWeight: age.aging ? 600 : 400 }}>
              {age.label}
            </span>
          </>
        )}
      </span>
      <span style={{ minWidth: 0, fontSize: 11.5, color: FAINT }}>
        {/* Original billed amount, so billed − paid = due is visible on the
            page. Redundant when nothing's been paid, so it stays quiet then. */}
        {bill.totalPaid > 0 && (
          <>
            billed{' '}
            <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
              {formatPortalUsd(portalBillBilledAmount(bill))}
            </span>
          </>
        )}
      </span>
      <span style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatPortalUsd(bill.amount)}</span>
      {bill.payUrl ? (
        <a
          href={bill.payUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: INK, color: PAPER, padding: '7px 16px', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          PAY ONLINE
        </a>
      ) : (
        <span style={{ border: '1px solid #b9c2cc', color: MUTED, padding: '6px 12px', fontSize: 11.5, whiteSpace: 'nowrap' }}>
          check · ref {bill.checkRef || '—'}
        </span>
      )}
    </div>
  )
}

/**
 * "Your account, any time" — the short address + QR at the foot of the
 * statement (portal custom-links train PR C). Renders only when the company
 * has a custom address, so paper copies and screenshots always carry a way
 * back in. Print keeps it: the page pins light and the QR is inline SVG.
 */
function PortalShortAddressCard({ slug }: { slug: string }) {
  const url = portalShortUrl(slug)
  return (
    <div
      style={{
        marginTop: '1.9rem',
        background: CARD,
        border: `1px solid ${HAIR}`,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
          Your account, any time
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.55 }}>
          See open bills, pay online, or request a visit — no login needed.
        </div>
        <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
          <span style={{ color: FAINT }}>{PORTAL_SHORT_ORIGIN.replace(/^https:\/\//, '')}</span>
          <span style={{ fontWeight: 700 }}>{slug}</span>
        </div>
      </div>
      <QRCodeSVG value={url} size={84} level="M" bgColor={CARD} fgColor={INK} aria-label={`QR code for ${url}`} />
    </div>
  )
}

/** One ruled row of the visit picker: hidden radio + copper pip + address. */
function PropertyRow({
  name,
  selected,
  onSelect,
  street,
  city,
  italic = false,
}: {
  name: string
  selected: boolean
  onSelect: () => void
  street: string
  city: string | null
  italic?: boolean
}) {
  return (
    <label
      className="portal-pickrow"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', borderBottom: `1px solid ${HAIR}`, cursor: 'pointer', fontSize: 13.5, position: 'relative' }}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      <span
        aria-hidden
        data-pip
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          border: `1.5px solid ${selected ? COPPER : FAINT}`,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: COPPER, transform: selected ? 'scale(1)' : 'scale(0)', transition: 'transform 0.12s' }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontStyle: italic ? 'italic' : 'normal' }}>{street}</span>
        {city && <span style={{ fontSize: 11.5, color: FAINT, marginLeft: 7 }}>{city}</span>}
      </span>
    </label>
  )
}

const fieldStyle: CSSProperties = {
  border: 'none',
  borderBottom: '1px solid #b9c2cc',
  background: 'transparent',
  padding: '4px 1px',
  fontSize: 13,
  color: INK,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  borderRadius: 0,
}

function PortalRequestForms({ token, payload }: { token: string; payload: PortalPayload }) {
  return (
    <>
      {/* Tear-off divider (portal train PR 2) */}
      <div style={{ margin: '1.9rem 0 0', display: 'flex', alignItems: 'center', gap: 10, color: FAINT }}>
        <span aria-hidden style={{ fontSize: 13 }}>✂</span>
        <span style={{ flex: 1, borderTop: '2px dashed #c4bfb2' }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Send us work</span>
        <span style={{ flex: 1, borderTop: '2px dashed #c4bfb2' }} />
      </div>
      <div style={{ padding: '1.3rem 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 22 }}>
        <RequestCard
          token={token}
          kind="visit"
          title="Request a visit"
          sub="We'll call to confirm a time."
          submitLabel="Send request"
          properties={payload.requestableProperties}
        />
        <RequestCard
          token={token}
          kind="bid"
          title="Ask us to bid your work"
          sub="Remodels, additions, new construction."
          submitLabel="Request a bid"
          properties={[]}
        />
      </div>
    </>
  )
}

function RequestCard({
  token,
  kind,
  title,
  sub,
  submitLabel,
  properties,
}: {
  token: string
  kind: 'visit' | 'bid'
  title: string
  sub: string
  submitLabel: string
  properties: PortalPayload['requestableProperties']
}) {
  const [jobId, setJobId] = useState('')
  const [showAllProperties, setShowAllProperties] = useState(false)
  const [description, setDescription] = useState('')
  const [availability, setAvailability] = useState('')
  const [phone, setPhone] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (description.trim().length < 5) {
      setStatus('error')
      setErrorMessage('Please tell us a little more about what you need (a sentence or two).')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          kind,
          jobId: jobId || undefined,
          description: description.trim(),
          availability: availability.trim() || undefined,
          phone: phone.trim() || undefined,
          plansLink: plansLink.trim() || undefined,
          website: honeypot,
        }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (res.ok && body?.ok) {
        setStatus('sent')
      } else {
        setStatus('error')
        setErrorMessage(body?.error ?? 'We could not send that. Please try again, or call our office.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('We could not send that. Please check your connection and try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ background: CARD, border: `1px solid ${HAIR}`, padding: '18px 20px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{title}</div>
        <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6 }}>
          <b>Got it — thank you.</b>{' '}
          <span style={{ color: MUTED }}>
            Your request went straight to our dispatch desk; we&#8217;ll reach out
            {phone.trim() ? ` at ${phone.trim()}` : ''} shortly.
          </span>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ background: CARD, border: `1px solid ${HAIR}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{title}</div>
        <div style={{ fontSize: 12, color: FAINT, marginTop: 2 }}>{sub}</div>
      </div>
      {kind === 'visit' && properties.length > 0 && (
        <div>
          {/* Address picker (v2.2037): the customer picks the PROPERTY — ruled
              rows like the ledger, never a job number or internal job name.
              Real radios underneath: keyboard + VoiceOver come free. */}
          <style>{`.portal-pickrow:focus-within [data-pip]{outline:2px solid ${COPPER};outline-offset:2px;border-radius:50%}`}</style>
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 4 }}>For</div>
          <div role="radiogroup" aria-label="Which property is this for?" style={{ borderTop: `1px solid ${HAIR}` }}>
            <PropertyRow name={`for-${kind}`} selected={jobId === ''} onSelect={() => setJobId('')} street="Something new" city={null} italic />
            {(showAllProperties ? properties : properties.slice(0, 5)).map((p) => (
              <PropertyRow
                key={p.jobId}
                name={`for-${kind}`}
                selected={jobId === p.jobId}
                onSelect={() => setJobId(p.jobId)}
                street={p.street}
                city={p.city}
              />
            ))}
          </div>
          {!showAllProperties && properties.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllProperties(true)}
              style={{ border: 'none', background: 'none', fontFamily: 'inherit', cursor: 'pointer', color: COPPER, fontSize: 12, fontWeight: 700, padding: '9px 2px 0', textAlign: 'left' }}
            >
              Show all {properties.length} properties
            </button>
          )}
        </div>
      )}
      <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {kind === 'visit' ? "What's going on?" : 'Describe the project'}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          required
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>
      {kind === 'visit' ? (
        <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
          Best days &amp; times
          <input value={availability} onChange={(e) => setAvailability(e.target.value)} maxLength={300} style={fieldStyle} />
        </label>
      ) : (
        <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
          Link to plans (optional)
          <input value={plansLink} onChange={(e) => setPlansLink(e.target.value)} maxLength={500} placeholder="https://…" style={fieldStyle} />
        </label>
      )}
      <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
        Best number to reach you
        <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} type="tel" style={fieldStyle} />
      </label>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
      />
      {status === 'error' && (
        <div style={{ fontSize: 12.5, color: '#a02c2c' }}>{errorMessage}</div>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        style={{
          alignSelf: 'flex-end',
          background: COPPER,
          color: CARD,
          border: 'none',
          padding: '8px 20px',
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          cursor: status === 'sending' ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {status === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  )
}
