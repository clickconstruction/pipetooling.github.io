import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN, PAPER_RED, PORTAL_FONT } from '../lib/portal/portalTheme'
import { formatLegalMoney, type LegalPacket } from '../lib/legal/legalPacket'
import { buildLegalPacketPrintHtml } from '../lib/legal/legalPacketPrint'
import { openHtmlPrintWindow } from '../lib/jobsDocuments/printWindow'
import { legalStageLabel } from '../lib/legal/legalMatters'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel, type LegalPortalMatter, type LegalPortalPayload } from '../lib/legal/legalPortalPayload'

/**
 * The collections law firm's portal (Legal portal PR 3): the no-login page
 * behind the firm's capability link (`/legal?t=<token>`). Every matter the
 * office marked attorney-ready, each as the same five-section packet the
 * office desk shows — Account · Paper · Their word · Evidence · Fees & steps —
 * built by the one packet kernel from the records `legal-portal` returns (held
 * entries never arrive). Plus Click's particulars for filing and the exhibits
 * as links. Read-only; the firm's own acts (fees, steps, questions, payments
 * received) land with PR 4. Same paper as the customer statement, pinned light.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

type PageState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; payload: LegalPortalPayload }

const TABS = ['account', 'paper', 'their_word', 'evidence', 'fees_steps'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = { account: 'Account', paper: 'Paper', their_word: 'Their word', evidence: 'Evidence', fees_steps: 'Fees & steps' }

const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }
const cap: CSSProperties = { fontSize: 11, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em' }
const h: CSSProperties = { margin: '16px 0 6px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT, fontWeight: 700 }
const th: CSSProperties = { textAlign: 'left', fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: FAINT, borderBottom: `1px solid ${HAIR}`, padding: '5px 8px', fontWeight: 700 }
const td: CSSProperties = { padding: '7px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top', fontSize: 13.5 }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 5, border: `1px solid ${COPPER}`, color: COPPER, background: CARD, cursor: 'pointer' }

function Table({ head, rows, empty, numCols = [] }: { head: string[]; rows: Array<Array<string | number | JSX.Element | null>>; empty: string; numCols?: number[] }) {
  if (rows.length === 0) return <p style={{ color: MUTED, fontSize: 13, margin: '4px 0' }}>{empty}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{head.map((x, i) => <th key={`${x}-${i}`} style={{ ...th, ...(numCols.includes(i) ? { textAlign: 'right' } : null) }}>{x}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...td, ...(numCols.includes(ci) ? num : null) }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function LegalPortal() {
  const [params] = useSearchParams()
  const token = params.get('t') || params.get('token') || ''
  const preview = isPreviewFlag(params.get(PUBLIC_PREVIEW_PARAM))
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('account')

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'This link is missing its key. Please use the exact link the office sent you.' })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/legal-portal?token=${encodeURIComponent(token)}${preview ? `&${PUBLIC_PREVIEW_PARAM}=1` : ''}`, { headers: await staffAwarePublicHeaders() })
        const body = (await res.json().catch(() => null)) as unknown
        if (cancelled) return
        if (!res.ok) {
          const msg = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'We could not open the portal.'
          setState({ kind: 'error', message: msg })
          return
        }
        const payload = parseLegalPortalPayload(body)
        if (!payload) {
          setState({ kind: 'error', message: 'The portal answered in a shape this page does not understand. Please contact the office.' })
          return
        }
        setState({ kind: 'ready', payload })
        setSelectedId((prev) => prev ?? payload.matters[0]?.id ?? null)
      } catch {
        if (!cancelled) setState({ kind: 'error', message: 'We could not open the portal. Please check your connection and try again.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, preview])

  const payload = state.kind === 'ready' ? state.payload : null
  const fee = useMemo(() => (payload ? portalFeeModel(payload) : { contingencyPct: 0.33, filingCost: 350 }), [payload])
  const packets = useMemo(() => {
    const out = new Map<string, LegalPacket | null>()
    if (!payload) return out
    for (const m of payload.matters) out.set(m.id, buildMatterPacket(m, payload.preparedOn, fee))
    return out
  }, [payload, fee])
  const selected: LegalPortalMatter | null = payload?.matters.find((m) => m.id === selectedId) ?? payload?.matters[0] ?? null
  const packet = selected ? (packets.get(selected.id) ?? null) : null

  return (
    <div data-theme="light" style={{ background: PAPER, color: INK, minHeight: '100vh', fontFamily: PORTAL_FONT, padding: '26px 20px 60px' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${COPPER}`, paddingBottom: 10, marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{payload?.company.name ?? 'Click Plumbing and Electrical'}</div>
            <div style={{ fontSize: 12, color: MUTED }}>Collections referred to counsel{payload ? ` · prepared ${payload.preparedOn}` : ''} · no sign-in, one revocable link</div>
          </div>
          {payload ? (
            <div style={{ textAlign: 'right', fontSize: 12.5, color: MUTED }}>
              For <b style={{ color: INK }}>{payload.firm.name}</b>{payload.firm.handling_name ? ` · ${payload.firm.handling_name}` : ''}<br />
              {payload.matters.length} matter{payload.matters.length === 1 ? '' : 's'} · {formatLegalMoney(payload.matters.reduce((s, m) => s + (packets.get(m.id)?.account.totals.balance ?? 0), 0))} in balance
            </div>
          ) : null}
        </div>

        {state.kind === 'loading' ? <p style={{ color: MUTED }}>Opening the portal…</p> : null}
        {state.kind === 'error' ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><b>We couldn’t open this page.</b><br /><span style={{ color: MUTED }}>{state.message}</span></div> : null}

        {payload && payload.matters.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}><b>No matters yet.</b><br /><span style={{ color: MUTED }}>Accounts appear here the moment the office marks them attorney-ready.</span></div>
        ) : null}

        {payload && selected ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(260px, 0.85fr)', gap: 16 }}>
            <div>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={cap}>Matter</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.payer.name}</div>
                    <div style={{ fontSize: 12.5, color: MUTED }}>
                      {packet?.account.customerAddress || selected.jobs[0]?.job_address || ''}
                      {packet?.account.properties[0]?.county ? ` · ${packet.account.properties[0].county} County` : ''}
                      {packet?.account.properties[0]?.owner ? ` · owner of record: ${packet.account.properties[0].owner}` : ''}
                      {packet ? <> · theory: <b style={{ color: INK }}>{packet.theory.label}</b></> : null}
                    </div>
                    {selected.noteToFirm ? <div style={{ fontSize: 12.5, marginTop: 4, color: MUTED }}><b style={{ color: INK }}>From Click:</b> {selected.noteToFirm}</div> : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...num, fontSize: 20, fontWeight: 700 }}>{packet ? formatLegalMoney(packet.account.totals.balance + selected.entries.filter((e) => e.kind === 'fee' || e.kind === 'cost').reduce((s, e) => s + Number(e.amount ?? 0), 0)) : '—'}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>total demand · balance {packet ? formatLegalMoney(packet.account.totals.balance) : '—'}</div>
                    <button type="button" style={{ ...btn, marginTop: 6, background: COPPER, color: '#fff' }} onClick={() => { if (packet && !openHtmlPrintWindow(buildLegalPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: payload.company.name }))) alert('Your browser blocked the print window. Allow pop-ups and try again.') }}>
                      ⎙ Print packet
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${HAIR}`, margin: '14px 0 12px', fontSize: 13 }}>
                  {TABS.map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)} style={{ background: 'none', border: 'none', padding: '6px 12px', color: tab === t ? INK : MUTED, borderBottom: tab === t ? `2px solid ${COPPER}` : '2px solid transparent', fontWeight: tab === t ? 700 : 500, cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
                      {TAB_LABELS[t]}
                    </button>
                  ))}
                </div>
                {packet ? <MatterTab tab={tab} packet={packet} matter={selected} /> : <p style={{ color: MUTED }}>Nothing to show on this matter.</p>}
              </div>
              <div style={{ ...card, marginTop: 12 }}>
                <div style={cap}>Exhibits</div>
                {packet && packet.exhibits.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                    <tbody>
                      {packet.exhibits.map((x) => (
                        <tr key={x.letter}>
                          <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}`, color: COPPER, fontWeight: 700, width: 26 }}>{x.letter}</td>
                          <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}` }}>{x.title} <span style={{ color: FAINT }}>· {x.count} item{x.count === 1 ? '' : 's'}</span></td>
                          <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}`, textAlign: 'right', fontSize: 12, color: FAINT }}>
                            {x.title === 'Signed agreements' && selected.contracts.some((c) => c.signedPdfUrl) ? selected.contracts.filter((c) => c.signedPdfUrl).map((c) => <a key={c.id} href={c.signedPdfUrl as string} target="_blank" rel="noreferrer" style={{ color: COPPER, marginLeft: 8 }}>PDF ↗</a>) : 'in the printed packet'}
                          </td>
                        </tr>
                      ))}
                      {packet.account.jobs.some((j) => j.contract.kind !== 'signed') ? <tr><td style={{ padding: '6px 4px', color: FAINT }}>—</td><td colSpan={2} style={{ padding: '6px 4px', color: PAPER_RED }}>No signed agreement on {packet.account.jobs.filter((j) => j.contract.kind !== 'signed').map((j) => j.label).join(', ')}{packet.theory.key === 'sworn' ? ' — proceeds as a sworn account' : ''}</td></tr> : null}
                    </tbody>
                  </table>
                ) : <p style={{ color: MUTED, fontSize: 13 }}>Nothing to letter yet.</p>}
              </div>
            </div>
            <div>
              <div style={cap}>Matters</div>
              {payload.matters.map((m) => {
                const p = packets.get(m.id)
                const on = m.id === selected.id
                return (
                  <button key={m.id} type="button" onClick={() => { setSelectedId(m.id); setTab('account') }} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 12px', marginTop: 8, background: CARD, border: `1px solid ${on ? COPPER : HAIR}`, borderRadius: 6, color: INK, cursor: 'pointer', font: 'inherit' }}>
                    <b style={{ fontSize: 13.5 }}>{m.payer.name}</b>
                    <span style={{ ...num, fontSize: 13.5, fontWeight: 600 }}>{p ? formatLegalMoney(p.account.totals.balance) : '—'}</span>
                    <span style={{ fontSize: 11.5, color: MUTED }}>{m.jobs.length} job{m.jobs.length === 1 ? '' : 's'}{m.releasedAt ? ` · since ${m.releasedAt}` : ''}{m.handling ? ` · handling ${m.handling}` : ''}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: NOTE_BAND, color: MUTED, justifySelf: 'end' }}>{legalStageLabel(m.stage).replace('With the firm · ', '')}</span>
                  </button>
                )
              })}
              <div style={{ ...card, marginTop: 14, fontSize: 12.5, color: MUTED }}>
                <b style={{ color: INK }}>Click’s particulars for filing</b>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', marginTop: 6 }}>
                  <span>Entity</span><span style={{ color: INK }}>{payload.particulars.entity || payload.company.name}</span>
                  <span>License</span><span style={{ color: INK }}>{payload.particulars.license || '—'}</span>
                  <span>Registered agent</span><span style={{ color: INK }}>{payload.particulars.agent || '—'}</span>
                  <span>Custodian of records</span><span style={{ color: INK }}>{payload.particulars.custodian || '—'}</span>
                  <span>Affiant</span><span style={{ color: INK }}>{payload.particulars.affiant || '—'}</span>
                  <span>Office</span><span style={{ color: INK }}>{[payload.particulars.phone || payload.company.phone, payload.particulars.email || payload.company.email].filter(Boolean).join(' · ') || '—'}</span>
                  <span>W-9 / EIN</span><span style={{ color: INK }}>{payload.particulars.w9 || 'on request from the office'}</span>
                </div>
              </div>
              <div style={{ ...card, marginTop: 12, fontSize: 12.5, color: MUTED }}>
                <b style={{ color: INK }}>What you get</b><br />The account, every agreement and notice, Click’s contact history with the customer, their promises, the field evidence, and the steps so far — as one lettered packet. Print packet is the PDF.<br /><br />
                <b style={{ color: INK }}>What is next</b><br />Adding fees and costs, recording steps and payments received, and asking the office arrive with the next release; until then, reply to the office by email.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MatterTab({ tab, packet, matter }: { tab: Tab; packet: LegalPacket; matter: LegalPortalMatter }) {
  const a = packet.account
  if (tab === 'account') {
    return (
      <div>
        <Table head={['Date', 'Entry', 'Amount']} numCols={[2]} rows={a.ledger.map((e) => [e.ymd ?? '—', e.text, <span key="a" style={{ color: e.amount < 0 ? PAPER_GREEN : undefined }}>{formatLegalMoney(e.amount)}</span>])} empty="No billed lines or payments on record." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, fontSize: 13.5, padding: '8px 8px 0', fontWeight: 700 }}><span style={{ color: MUTED, fontWeight: 400 }}>Balance</span><span style={num}>{formatLegalMoney(a.totals.balance)}</span></div>
        <div style={h}>Who owes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px', fontSize: 13.5 }}>
          <span style={{ color: MUTED }}>Payer</span><span>{a.payer.name}{a.payer.viaGc ? ' · general contractor on the job' : ''}{a.customerType ? ` · ${a.customerType}` : ''}</span>
          <span style={{ color: MUTED }}>Address</span><span>{a.customerAddress || '—'}</span>
          <span style={{ color: MUTED }}>Emails</span><span>{a.emails.join(', ') || 'none on file'}</span>
          <span style={{ color: MUTED }}>Phones</span><span>{a.phones.join(', ') || 'none on file'}</span>
          <span style={{ color: MUTED }}>Terms with Click</span><span>{a.paymentTerms}</span>
        </div>
        {a.contacts.length ? (<><div style={h}>Contacts</div><Table head={['Name', 'Email', 'Phone']} rows={a.contacts.map((c) => [c.name, c.email ?? '—', c.phone ?? '—'])} empty="" /></>) : null}
        <div style={h}>Jobs</div>
        <Table head={['Job', 'Name', 'Address', 'Age', 'Basis', 'Balance']} numCols={[3, 5]} rows={a.jobs.map((j) => [<b key="l">{j.label}</b>, j.name, j.address, j.agingDays == null ? '—' : `${j.agingDays}d`, j.contract.kind === 'signed' ? 'signed contract' : j.swornMissing.length === 0 ? 'sworn account holds' : `needs ${j.swornMissing.join(', ')}`, formatLegalMoney(j.balance)])} empty="No jobs." />
        <div style={h}>Property record</div>
        <Table head={['Address', 'County', 'Owner of record', 'Legal description', 'Parcel', 'Kind']} rows={a.properties.map((p) => [p.address, p.county || '—', p.owner || '—', p.legalDescription || '—', p.parcelId || '—', p.propertyKind === 'residential' ? 'residential' : p.propertyKind ? 'non-residential' : '—'])} empty="No property record on file." />
      </div>
    )
  }
  if (tab === 'paper') {
    return (
      <div>
        <div style={h}>Agreements and theory</div>
        <Table head={['Job', 'Agreement', 'Sworn account', '']} rows={a.jobs.map((j) => {
          const c = matter.contracts.find((x) => x.job_id === j.jobId && x.signedPdfUrl)
          return [<b key="l">{j.label}</b>, <span key="s" style={{ color: j.contract.kind === 'signed' ? undefined : PAPER_RED }}>{j.contract.kind === 'signed' ? `Signed${j.contract.signedAt ? ` ${j.contract.signedAt.slice(0, 10)}` : ''}${j.contract.signerName ? ` by ${j.contract.signerName}` : ''} · ${j.contract.source}` : j.contract.kind === 'sent' ? 'Sent, never signed' : 'None on file'}</span>, j.swornMissing.length ? `needs ${j.swornMissing.join(', ')}` : 'holds — bill received, GPS evidence, no dispute', c ? <a key="p" href={c.signedPdfUrl as string} target="_blank" rel="noreferrer" style={{ color: COPPER }}>PDF ↗</a> : null]
        })} empty="No jobs." />
        <div style={h}>Lien clock</div>
        <Table head={['Job', 'Last work', '§ 53.056 notice due', 'Affidavit due', 'Status']} rows={packet.paper.lienClock.map((c) => [<b key="l">{c.jobLabel}</b>, c.lastWorkYmd ?? '—', c.noticeDeadline || 'n/a — original contractor', c.filingDeadline || '—', c.status === 'notice_open' ? `notice open · ${c.noticeLeft}d` : c.status === 'affidavit_open' ? `affidavit open · ${c.filingLeft}d` : c.status === 'filed' ? 'affidavit filed' : c.status === 'closed' ? 'closed' : 'no work day on record'])} empty="No jobs." />
        <div style={h}>Final demand letters</div>
        <Table head={['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount']} numCols={[5]} rows={packet.paper.demandLetters.map((d) => [<b key="l">{d.jobLabel}</b>, d.sentYmd ?? 'not sent', d.method, d.tracking || '—', `${d.deadlineYmd ?? '—'}${d.deadlinePassed ? ' · passed' : ''}`, formatLegalMoney(d.amount)])} empty="No demand letter on record from Click." />
        <div style={h}>Lien notices and filings</div>
        <Table head={['Job', 'Instrument', 'Months', 'Filed', 'Served', 'County', 'Recording no.']} rows={packet.paper.lienFilings.map((f) => [<b key="l">{f.jobLabel}</b>, f.kind, f.monthsCovered.join(', ') || '—', f.filedYmd ?? '—', f.servedYmd ?? '—', f.county || '—', f.recordingNumber || '—'])} empty="None recorded." />
      </div>
    )
  }
  if (tab === 'their_word') {
    const tw = packet.theirWord
    return (
      <div>
        <p style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 8px' }}>Everything the office has on record with this customer that it chose to share — contacts, promises{tw.decided ? ` (keeps ${tw.kept} of ${tw.decided}${tw.broken ? `, ${tw.broken} broken` : ''})` : ''}, collection calls, and why it was parked — oldest first.</p>
        <Table head={['Date', 'Kind', 'Job', 'What was said', 'By']} rows={tw.timeline.filter((e) => e.shared).map((e) => [e.ymd, e.kind === 'note' ? 'collections' : e.kind, e.jobLabel ?? 'account', e.text, e.by ?? 'the customer'])} empty="Nothing on record that the office shared." />
      </div>
    )
  }
  if (tab === 'evidence') {
    return (
      <div>
        <Table head={['Job', 'Field reports', 'Clock sessions', 'Hours', 'Worked', 'Job notes']} numCols={[3]} rows={packet.evidence.map((e) => [<b key="l">{e.jobLabel}</b>, `${e.reports} (${e.reportsWithGps} with GPS)`, `${e.sessions} (${e.approvedSessions} approved, ${e.sessionsWithGps} with GPS)`, `${e.hours}h`, e.firstWorkYmd ? `${e.firstWorkYmd} → ${e.lastWorkYmd}` : '—', String(e.threadNotes)])} empty="No jobs." />
        <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Rejected and revoked clock sessions are left out. Individual reports and sessions come with the printed packet; ask the office for the originals.</p>
      </div>
    )
  }
  const fees = matter.entries.filter((e) => e.kind === 'fee' || e.kind === 'cost')
  const steps = matter.entries.filter((e) => e.kind !== 'fee' && e.kind !== 'cost')
  return (
    <div>
      <div style={h}>Fees and costs</div>
      <Table head={['Date', 'Kind', 'Note', 'Amount']} numCols={[3]} rows={fees.map((e) => [e.occurred_on, e.kind, e.body, formatLegalMoney(Number(e.amount ?? 0))])} empty="None yet — adding fees and costs arrives with the next release." />
      <div style={h}>On this matter</div>
      <Table head={['Date', 'Kind', 'What happened']} rows={steps.map((e) => [e.occurred_on, e.kind.replace('_', ' '), e.body])} empty="No steps recorded." />
      <div style={h}>What Click did, in order</div>
      <Table head={['Date', 'Job', 'Step', 'What happened']} rows={packet.feesAndSteps.steps.map((s) => [s.ymd ?? '—', s.jobLabel ?? '', s.kind, s.text])} empty="No steps recorded." />
    </div>
  )
}
