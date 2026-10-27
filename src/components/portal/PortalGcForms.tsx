/**
 * The customer's three answers on a GC job in their portal, moved out of `PortalGcJobs.tsx` unchanged (Messages cut
 * 8b-i) so the job's old view and the customer's page (shape B, `PortalGcPage.tsx`) draw the same forms: change orders
 * to sign or decline (a decline may say why, one line, never required), our contract to read and sign (the job and its
 * price as one number, how billing works, the sign-by day, the file, `/contract/accept`'s form), and Accept the work
 * once every line is billed. Each press posts to submit-portal-request (`gc_change_order_answer`,
 * `gc_owner_contract_sign`, `gc_accept_work`), which runs the database's own function as their portal; a sample token
 * only says thank you, and the office's preview (`PortalPreviewContext`, Messages cut 8d) sends nothing and says so.
 * `onOpen` tells the page a paper was opened, for the office's read-back. Customer-facing ⇒
 * single-theme light with the statement's own palette. Their words are English until the customer page's words take
 * them (8b-ii).
 */
import { useContext, useRef, useState } from 'react'
import { ContractAcceptSignatureForm } from '../contracts/ContractAcceptSignatureForm'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'
import { esignConsentText } from '../../lib/esignConsent'
import { formatPortalDate, type PortalGcChangeOrder, type PortalGcContract, type PortalGcJob } from '../../lib/portal/portalPayload'
import { gcContractTermsLines } from '../../../supabase/functions/_shared/gcPortal'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { PortalPreviewContext } from './portalPreviewContext'
import { portalFailure, portalFailureCause, portalFailureKind, type PortalFailureCause } from '../../lib/portal/portalFailure'
import { PortalFailureNote } from './PortalFailureNote'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

/**
 * `error` is the office's preview notice; `failed` a send's failure as kept (v2.5965): its class, or the function's
 * own sentence when it is one we know, worded with the page's number.
 */
type Failed = { kind: 'error'; text: string } | { kind: 'failed'; cause: PortalFailureCause }
type Ui = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; words: string } | Failed

const PREVIEW_WORDS = 'This is the office’s preview. Nothing was sent.'

/** Sends one answer. A failure comes back as kept: its class, or the function's own known sentence, never other text (v2.5965). */
async function post(token: string, body: Record<string, unknown>, preview: boolean): Promise<{ ok: true } | { ok: false; fail: Failed }> {
  if (preview) return { ok: false, fail: { kind: 'error', text: PREVIEW_WORDS } }
  if (sampleStateFromToken(token)) return { ok: true }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: unknown } | null
    if (!res.ok || !json?.ok) return { ok: false, fail: { kind: 'failed', cause: portalFailureCause(res.status, json, 'send') } }
    return { ok: true }
  } catch (e) {
    return { ok: false, fail: { kind: 'failed', cause: portalFailureKind(e) } }
  }
}

const ERROR_RED = '#b42318'

/** The error line: a failure with its presses, or the preview's notice alone. */
function ErrorLine({ ui, onTryAgain, phone }: { ui: Ui; onTryAgain: () => void; phone: string | null | undefined }) {
  if (ui.kind === 'error') return <div style={{ color: ERROR_RED }}>{ui.text}</div>
  if (ui.kind !== 'failed') return null
  return <PortalFailureNote failure={portalFailure(ui.cause, 'send', 'en', { phone })} onTryAgain={onTryAgain} messageStyle={{ color: ERROR_RED, fontSize: 'inherit' }} />
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

export function ChangeOrderRow({ token, co, formatUsd, onOpen, phone }: { token: string; co: PortalGcChangeOrder; formatUsd: (n: number) => string; onOpen?: () => void; phone?: string | null }) {
  const [asking, setAsking] = useState<'sign' | 'decline' | null>(null)
  const [why, setWhy] = useState('')
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  const preview = useContext(PortalPreviewContext)
  const answer = async (signed: boolean) => {
    setUi({ kind: 'sending' })
    const r = await post(token, { kind: 'gc_change_order_answer', changeOrderId: co.id, signed, note: signed ? undefined : why.trim() || undefined }, preview)
    setUi(r.ok ? { kind: 'done', words: signed ? `You signed change order ${co.number}. Thank you.` : `You declined change order ${co.number}. We will be in touch.` } : r.fail)
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
          <button
            type="button"
            onClick={() => {
              onOpen?.()
              setAsking('sign')
            }}
            style={solid()}
          >
            Sign it
          </button>
          <button
            type="button"
            onClick={() => {
              onOpen?.()
              setAsking('decline')
            }}
            style={plain}
          >
            Decline
          </button>
        </div>
      )}
      <ErrorLine ui={ui} onTryAgain={() => void answer(asking === 'sign')} phone={phone} />
    </div>
  )
}

/** A link to the file: to read before they sign, or what they signed. */
function FileLink({ url, name, words, onOpen }: { url: string | null; name: string; words: string; onOpen?: () => void }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" onClick={() => onOpen?.()} style={{ color: COPPER, fontWeight: 700 }}>
      {`${words} (${name})`}
    </a>
  ) : (
    <span style={{ color: MUTED }}>The contract file could not open just now. Please call our office.</span>
  )
}

export function OurContract({ token, job, contract, formatUsd, onOpen, phone }: { token: string; job: PortalGcJob; contract: PortalGcContract; formatUsd: (n: number) => string; onOpen?: () => void; phone?: string | null }) {
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  const preview = useContext(PortalPreviewContext)
  /** The last signature sent, so Try again re-sends exactly it. */
  const lastSignRef = useRef<EstimateAcceptSubmitPayload | null>(null)
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
  const sign = async (p: EstimateAcceptSubmitPayload) => {
    lastSignRef.current = p
    setUi({ kind: 'sending' })
    const r = await post(token, {
      kind: 'gc_owner_contract_sign',
      sendId: contract.sendId,
      printedName: p.printedName,
      ...(p.mode === 'draw' ? { signaturePngBase64: p.signaturePngBase64 } : {}),
      ...(p.consent ? { esignConsent: p.consent } : {}),
    }, preview)
    setUi(r.ok ? { kind: 'done', words: 'You signed our contract. Thank you.' } : r.fail)
  }
  const failed = ui.kind === 'failed' ? portalFailure(ui.cause, 'send', 'en', { phone }) : null
  return (
    <div data-testid="portal-gc-contract" style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontWeight: 700, color: INK }}>Your contract · to sign</div>
      <div style={{ color: INK }}>{`Our contract for ${job.name}: ${formatUsd(contract.total)}.`}</div>
      <div style={{ color: MUTED, fontSize: 12 }}>{gcContractTermsLines(contract, formatUsd).join(' ')}</div>
      <div>
        <FileLink url={contract.fileUrl} name={contract.fileName} words="Read the contract" {...(onOpen ? { onOpen } : {})} />
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
            formError={ui.kind === 'error' ? ui.text : (failed?.message ?? null)}
            submitting={ui.kind === 'sending'}
            onSubmit={(p) => void sign(p)}
            heading="Sign the contract"
            disclosure="Read the contract above first. Signing it here is the same as signing it on paper."
            consent={esignConsentText({ audience: 'customer', lang: 'en', documentNoun: 'contract' })}
            agreeLabel="I have read the contract and agree to it."
            submitLabel="Sign the contract"
            lang="en"
          />
          <PortalFailureNote failure={failed} doorsOnly onTryAgain={() => lastSignRef.current && void sign(lastSignRef.current)} />
        </>
      )}
    </div>
  )
}

export function AcceptWork({ token, job, phone }: { token: string; job: PortalGcJob; phone?: string | null }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [ui, setUi] = useState<Ui>({ kind: 'idle' })
  const preview = useContext(PortalPreviewContext)
  const ready = name.trim() !== '' && ui.kind !== 'sending'
  const accept = async () => {
    setUi({ kind: 'sending' })
    const r = await post(token, { kind: 'gc_accept_work', projectId: job.projectId, byName: name.trim(), note: note.trim() || undefined }, preview)
    setUi(r.ok ? { kind: 'done', words: 'You accepted the work. Thank you.' } : r.fail)
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
      <ErrorLine ui={ui} onTryAgain={() => void accept()} phone={phone} />
    </div>
  )
}
