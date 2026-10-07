import { useState } from 'react'
import { CARD, HAIR, MUTED, PAPER, PAPER_GREEN, PAPER_RED } from '../../lib/portal/portalTheme'
import { formatPortalDate, type PortalOwnerRecords } from '../../lib/portal/portalPayload'
import { ownerAcknowledgmentLines } from '../../lib/jobs/ownerRecordsDocs'
import { ownerNameLetterMatch } from '../../../supabase/functions/_shared/ownerNameMatch'
import { esignConsentText } from '../../lib/esignConsent'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { ContractAcceptSignatureForm } from '../contracts/ContractAcceptSignatureForm'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'

/**
 * Records for an owner, on their portal (punch list #86, PR 1): the card an owner of record sees
 * once the office has offered them our records. They read the acknowledgment, type their name
 * (letter for letter the name the county lists, or the second name the office allowed), and sign
 * with the type-or-draw pad every signing page shares. `sign-owner-records` files it. Signed, the
 * card thanks them and says the office sends the records once it has checked our contract. The
 * packet itself never shows here (shape B: one Download, after the office sends — PR 4).
 * Customer-facing ⇒ the statement's light palette.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

export function PortalOwnerRecordsCard({ records, token, companyName, phone, todayYmd }: { records: PortalOwnerRecords; token: string; companyName: string; phone: string; todayYmd: string }) {
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [signed, setSigned] = useState<{ on: string; name: string } | null>(records.signed)
  const sent = records.sent
  const nameOk = ownerNameLetterMatch(printedName, [records.ownerName])
  const lines = ownerAcknowledgmentLines(
    { company: companyName, owner: records.ownerName, address: records.address, asOfYmd: todayYmd, requestedOnYmd: records.offeredOn },
    { day: (ymd) => formatPortalDate(ymd) ?? ymd, dateTime: (iso) => iso, money: (n) => `$${n.toFixed(2)}` },
  )

  async function submit(p: EstimateAcceptSubmitPayload) {
    setFormError(null)
    // A name that is not the roll's may still be the second name the office allowed: the function knows it and answers.
    setSubmitting(true)
    try {
      if (sampleStateFromToken(token)) {
        setSigned({ on: todayYmd, name: p.printedName })
        return
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/sign-owner-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, requestId: records.id, printedName: p.printedName, mode: p.mode, signaturePngBase64: p.mode === 'draw' ? p.signaturePngBase64 : undefined, esignConsent: p.consent }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; signedOn?: string; printedName?: string } | null
      if (!res.ok || !json?.ok) {
        setFormError(json?.error ?? 'Something went wrong. Please try again, or call our office.')
        return
      }
      setSigned({ on: json.signedOn ?? todayYmd, name: json.printedName ?? p.printedName })
    } catch {
      setFormError('Something went wrong. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const tel = phone.replace(/[^\d+]/g, '')
  return (
    <div data-portal-owner-records data-state={signed && sent ? 'sent' : signed ? 'signed' : 'to-sign'} style={{ margin: '1.2rem 0', background: CARD, border: `1px solid ${HAIR}`, borderLeft: `3px solid ${PAPER_GREEN}`, padding: '1rem 1.2rem', fontSize: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: PAPER_GREEN, marginBottom: 6 }}>Our records for {records.address || 'your property'}</div>
      {signed && sent ? (
        <>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>The office sent your records on {formatPortalDate(sent.on) ?? sent.on}.</p>
          {sent.downloadUrl ? (
            <a href={sent.downloadUrl} download data-portal-owner-records-download style={{ display: 'inline-block', marginTop: 4, padding: '8px 14px', borderRadius: 8, background: PAPER_GREEN, color: '#fff', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>
              Download the records
            </a>
          ) : (
            <p style={{ margin: 0, color: MUTED }}>The file is being prepared. Open this page again in a minute.</p>
          )}
          <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 12.5 }}>
            One PDF: the cover note and the statement as of the day it was sent. {phone ? <>Questions? Call <a href={`tel:${tel}`} style={{ color: 'inherit' }}>{phone}</a>.</> : null}
          </p>
        </>
      ) : signed ? (
        <>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Thank you, {signed.name || 'you have signed'}. You signed on {formatPortalDate(signed.on) ?? signed.on}.</p>
          <p style={{ margin: 0, color: MUTED }}>
            The office sends the records once it has checked our contract. {phone ? <>Questions? Call <a href={`tel:${tel}`} style={{ color: 'inherit' }}>{phone}</a>.</> : null}
          </p>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 8px' }}>You asked us for our records on your property. They are ready once you sign for them. The records are a statement of each job at this property, each bill, and each payment we received on those bills. They say nothing about anyone else.</p>
          <div style={{ border: `1px solid ${HAIR}`, borderRadius: 8, padding: '10px 12px', margin: '10px 0', background: PAPER }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Acknowledgment of a records request</div>
            <div style={{ color: MUTED, fontSize: 12.5, marginBottom: 6 }}>{records.address}</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: MUTED, fontSize: 13 }}>
              {lines.map((l, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{l}</li>
              ))}
            </ol>
          </div>
          <div data-portal-owner-name-hint style={{ fontSize: 12.5, color: printedName.trim() && !nameOk ? PAPER_RED : MUTED, marginBottom: 4 }}>
            {printedName.trim() && !nameOk ? (
              <>
                Type your name as the county lists it: <b>{records.ownerName}</b>. Every letter must match. Capitals, spaces and dashes do not matter.
              </>
            ) : (
              <>Type your full name as the county lists the owner{records.ownerName ? <>: <b>{records.ownerName}</b></> : null}.</>
            )}
          </div>
          <ContractAcceptSignatureForm
            printedName={printedName}
            agreed={agreed}
            onPrintedNameChange={setPrintedName}
            onAgreedChange={setAgreed}
            formError={formError}
            submitting={submitting}
            onSubmit={(p) => void submit(p)}
            heading="Sign for the records"
            disclosure="Your signature says you asked for these records and will receive them as a business record, not legal advice."
            consent={esignConsentText({ audience: 'customer', documentNoun: 'this acknowledgment' })}
            agreeLabel="I asked for these records and I accept this acknowledgment."
            submitLabel="Sign and send my request"
          />
        </>
      )}
    </div>
  )
}
