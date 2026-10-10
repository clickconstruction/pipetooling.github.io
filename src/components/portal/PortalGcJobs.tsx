/**
 * GC mode, Owner Billing's O7c: the customer of a GC job we build answers us in their portal. Each job shows the
 * change orders waiting on them, to sign or decline (a decline may say why, one line, never required), and Accept the
 * work once every line is billed. Each press posts to submit-portal-request (`gc_change_order_answer`,
 * `gc_accept_work`), which runs the database's own function as their portal. A sample token only says thank you.
 * Customer-facing ⇒ single-theme light with the statement's own palette.
 *
 * The Board's B6-d-iii: our contract leads a job while it waits on them, after the design spike's
 * `GcCustomerContractSign`: the job and its price as one number, how billing works, the day we asked them to sign by,
 * the file to read, and `/contract/accept`'s form (a name typed or drawn, and the e-sign consent). It posts
 * `gc_owner_contract_sign`; once signed it reads who signed and when.
 */
import { useState } from 'react'
import { ContractAcceptSignatureForm } from '../contracts/ContractAcceptSignatureForm'
import { esignConsentText } from '../../lib/esignConsent'
import { formatPortalDate, type PortalGcChangeOrder, type PortalGcContract, type PortalGcJob } from '../../lib/portal/portalPayload'
import { gcContractTermsLines } from '../../../supabase/functions/_shared/gcPortal'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

type Ui = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; words: string } | { kind: 'error'; text: string }

async function post(token: string, body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; text: string }> {
  if (sampleStateFromToken(token)) return { ok: true }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) return { ok: false, text: json?.error ?? 'Something went wrong. Please try again, or call our office.' }
    return { ok: true }
  } catch {
    return { ok: false, text: 'Something went wrong. Please check your connection.' }
  }
}

const field = { padding: '0.4rem 0.55rem', border: `1px solid ${HAIR}`, borderRadius: 6, background: CARD, color: INK, fontSize: 13, fontFamily: 'inherit' } as const
const solid = (on = true) => ({ background: on ? COPPER : HAIR, color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 700, cursor: on ? 'pointer' : 'not-allowed' }) as const
const plain = { background: CARD, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const

/** "Adds $1,100 and 3 working days." / "Takes $500 off." */
function changeWords(co: PortalGcChangeOrder, formatUsd: (n: number) => string): string {
  const money = co.price < 0 ? `Takes ${formatUsd(-co.price)} off` : co.price > 0 ? `Adds ${formatUsd(co.price)}` : ''
  const days = co.days > 0 ? `${co.days === 1 ? '1 working day' : `${co.days} working days`}` : ''
  if (money && days) return `${money} and ${days}.`
  if (money) return `${money}.`
  return days ? `Adds ${days}.` : ''
}

function ChangeOrderRow({ token, co, formatUsd }: { token: string; co: PortalGcChangeOrder; formatUsd: (n: number) => string }) {
  const [asking, setAsking] = useState<'sign' | 'decline' | null>(null)
  const [why, setWhy] = useState('')
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  const answer = async (signed: boolean) => {
    setUi({ kind: 'sending' })
    const r = await post(token, { kind: 'gc_change_order_answer', changeOrderId: co.id, signed, note: signed ? undefined : why.trim() || undefined })
    setUi(r.ok ? { kind: 'done', words: signed ? `You signed change order ${co.number}. Thank you.` : `You declined change order ${co.number}. We will be in touch.` } : { kind: 'error', text: r.text })
  }
  const sent = formatPortalDate(co.sentOn) ?? co.sentOn
  return (
    <div data-testid={`portal-gc-co-${co.number}`} style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 8, display: 'grid', gap: 6 }}>
      <div style={{ fontWeight: 700, color: INK }}>Change order {co.number}</div>
      {co.description && <div style={{ color: INK }}>{co.description}</div>}
      <div style={{ color: MUTED, fontSize: 12 }}>{`${changeWords(co, formatUsd)} Sent ${sent}.`.trim()}</div>
      {ui.kind === 'done' ? (
        <div style={{ color: PAPER_GREEN, fontWeight: 700 }}>{ui.words}</div>
      ) : asking === 'sign' ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: INK }}>{`Sign change order ${co.number}?`}</span>
          <button type="button" disabled={ui.kind === 'sending'} onClick={() => void answer(true)} style={solid()}>
            {ui.kind === 'sending' ? '…' : 'Yes, sign it'}
          </button>
          <button type="button" onClick={() => setAsking(null)} style={plain}>
            Not now
          </button>
        </div>
      ) : asking === 'decline' ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <input value={why} onChange={(e) => setWhy(e.target.value.replace(/\n/g, ' ').slice(0, 300))} placeholder="Why? You can leave this blank." aria-label={`Why you are declining change order ${co.number}`} style={field} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={ui.kind === 'sending'} onClick={() => void answer(false)} style={solid()}>
              {ui.kind === 'sending' ? '…' : 'Decline it'}
            </button>
            <button type="button" onClick={() => setAsking(null)} style={plain}>
              Not now
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setAsking('sign')} style={solid()}>
            Sign it
          </button>
          <button type="button" onClick={() => setAsking('decline')} style={plain}>
            Decline
          </button>
        </div>
      )}
      {ui.kind === 'error' && <div style={{ color: '#b42318' }}>{ui.text}</div>}
    </div>
  )
}

/** A link to the file: to read before they sign, or what they signed. */
function FileLink({ url, name, words }: { url: string | null; name: string; words: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" style={{ color: COPPER, fontWeight: 700 }}>
      {`${words} (${name})`}
    </a>
  ) : (
    <span style={{ color: MUTED }}>The contract file could not open just now. Please call our office.</span>
  )
}

function OurContract({ token, job, contract, formatUsd }: { token: string; job: PortalGcJob; contract: PortalGcContract; formatUsd: (n: number) => string }) {
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  if (contract.state === 'signed' || ui.kind === 'done') {
    const words =
      contract.state === 'signed'
        ? `You signed our contract on ${formatPortalDate(contract.signedOn) ?? contract.signedOn}${contract.signer ? `, as ${contract.signer}` : ''}.`
        : ui.kind === 'done'
          ? ui.words
          : ''
    return (
      <div data-testid="portal-gc-contract" style={{ display: 'grid', gap: 4 }}>
        <span style={contract.state === 'signed' ? { color: MUTED } : { color: PAPER_GREEN, fontWeight: 700 }}>{words}</span>
        <span>
          <FileLink url={contract.fileUrl} name={contract.fileName} words="Read what you signed" />
        </span>
      </div>
    )
  }
  const signBy = formatPortalDate(contract.signBy) ?? contract.signBy
  return (
    <div data-testid="portal-gc-contract" style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontWeight: 700, color: INK }}>Your contract · to sign</div>
      <div style={{ color: INK }}>{`Our contract for ${job.name}: ${formatUsd(contract.total)}.`}</div>
      <div style={{ color: MUTED, fontSize: 12 }}>{gcContractTermsLines(contract, formatUsd).join(' ')}</div>
      <div>
        <FileLink url={contract.fileUrl} name={contract.fileName} words="Read the contract" />
      </div>
      {contract.priceChanged ? (
        <div style={{ color: COPPER, fontWeight: 700 }}>Our price changed after we sent this. We will send you the new one.</div>
      ) : (
        <>
          <div style={{ color: COPPER, fontWeight: 700 }}>{`Please sign it by ${signBy}.`}</div>
          <ContractAcceptSignatureForm
            printedName={name}
            agreed={agreed}
            onPrintedNameChange={setName}
            onAgreedChange={setAgreed}
            formError={ui.kind === 'error' ? ui.text : null}
            submitting={ui.kind === 'sending'}
            onSubmit={(p) =>
              void (async () => {
                setUi({ kind: 'sending' })
                const r = await post(token, {
                  kind: 'gc_owner_contract_sign',
                  sendId: contract.sendId,
                  printedName: p.printedName,
                  ...(p.mode === 'draw' ? { signaturePngBase64: p.signaturePngBase64 } : {}),
                  ...(p.consent ? { esignConsent: p.consent } : {}),
                })
                setUi(r.ok ? { kind: 'done', words: 'You signed our contract. Thank you.' } : { kind: 'error', text: r.text })
              })()
            }
            heading="Sign the contract"
            disclosure="Read the contract above first. Signing it here is the same as signing it on paper."
            consent={esignConsentText({ audience: 'customer', lang: 'en', documentNoun: 'contract' })}
            agreeLabel="I have read the contract and agree to it."
            submitLabel="Sign the contract"
            lang="en"
          />
        </>
      )}
    </div>
  )
}

function AcceptWork({ token, job }: { token: string; job: PortalGcJob }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  const ready = name.trim() !== '' && ui.kind !== 'sending'
  const accept = async () => {
    setUi({ kind: 'sending' })
    const r = await post(token, { kind: 'gc_accept_work', projectId: job.projectId, byName: name.trim(), note: note.trim() || undefined })
    setUi(r.ok ? { kind: 'done', words: 'You accepted the work. Thank you.' } : { kind: 'error', text: r.text })
  }
  if (ui.kind === 'done') return <div style={{ color: PAPER_GREEN, fontWeight: 700, borderTop: `1px solid ${HAIR}`, paddingTop: 8 }}>{ui.words}</div>
  return (
    <div data-testid="portal-gc-accept" style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 8, display: 'grid', gap: 6 }}>
      <div style={{ fontWeight: 700, color: INK }}>Accept the work</div>
      <div style={{ color: INK }}>Every line of the work is billed. Once you have walked the job, accept the work here.</div>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} placeholder="Your name" aria-label="Your name, as the one who walked the job" style={field} />
      <input value={note} onChange={(e) => setNote(e.target.value.replace(/\n/g, ' ').slice(0, 300))} placeholder="A note. You can leave this blank." aria-label="A note on the acceptance" style={field} />
      <div>
        <button type="button" disabled={!ready} onClick={() => void accept()} style={solid(ready)}>
          {ui.kind === 'sending' ? '…' : 'Accept the work'}
        </button>
      </div>
      {ui.kind === 'error' && <div style={{ color: '#b42318' }}>{ui.text}</div>}
    </div>
  )
}

export function PortalGcJobs({ token, jobs, formatUsd }: { token: string; jobs: PortalGcJob[]; formatUsd: (n: number) => string }) {
  if (jobs.length === 0) return null
  return (
    <div data-testid="portal-gc-jobs" data-screen-only style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      {jobs.map((job) => (
        <div key={job.projectId} style={{ border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '10px 12px', display: 'grid', gap: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>{job.name}</div>
          {job.contract && <OurContract token={token} job={job} contract={job.contract} formatUsd={formatUsd} />}
          {job.changeOrders.map((co) => (
            <ChangeOrderRow key={co.id} token={token} co={co} formatUsd={formatUsd} />
          ))}
          {job.canAccept && <AcceptWork token={token} job={job} />}
          {job.accepted && (
            <div style={{ color: MUTED, borderTop: `1px solid ${HAIR}`, paddingTop: 8 }}>{`The work was accepted on ${formatPortalDate(job.accepted.on) ?? job.accepted.on}.`}</div>
          )}
        </div>
      ))}
    </div>
  )
}

export default PortalGcJobs
