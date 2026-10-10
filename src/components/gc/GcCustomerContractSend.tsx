import { useEffect, useRef, useState } from 'react'
import { newestContractSend, type ContractStep } from '../../lib/gc/customerContract'
import { contractMail, contractMailFacts } from '../../lib/gc/customerEmail'
import { ownerContractWorthNow } from '../../lib/gc/ownerBilling'
import { contractFileProblem, type StoredContractFile } from '../../lib/gc/ownerContractIo'
import { paperDayChoices } from '../../lib/gc/paperSend'
import type { GcCustomer, GcProject, GcState } from '../../lib/gc/types'
import { money, weekdayDate } from '../../lib/gc/words'
import { Btn, input } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-d-ii: send our contract from the customer's window, after the design spike's
 * `GcCustomerSend` on the company window's send (`GcPaperSend.tsx`). The office's own contract file (call D1) goes with
 * the price by line it shows (call D2), side by side so the office checks the file says that price before the press. A
 * first send and a new price need a file; a reminder keeps the last one unless another is picked. They sign the newest
 * in their portal (B6-d-iii-a). With **Email it to them now** ticked (B6-d-iii-b, a box that starts off, as every GC
 * send's does), the page makes their portal link if they have none and emails them, the file attached by the function.
 */

/** Light like a printed page in either theme, as the paper send draws the email. */
const INK = '#16283c'
const PAPER = '#f6f3ec'

export interface ContractSendInput {
  signBy: string
  note: string
  worth: Record<string, number>
  file: File | StoredContractFile
  /** The email's kind (a send emailed again reads as its first or a reminder) and its price as one number, for its words. */
  mode: Exclude<ContractStep['mode'], 'emailAgain'>
  total: number
  /** Email them now, with their portal link. */
  email: boolean
  /** Email it now: the newest send, emailed again with nothing sent anew. */
  sendId?: string
}

/** What the press did: the words to show, and why the email did not go when it did not. */
export interface ContractSendOutcome {
  words: string
  notEmailed?: string
}

export function GcCustomerContractSend({
  state,
  customer,
  project,
  step,
  onSend,
  onDone,
  onCancel,
  canEmail = false,
}: {
  state: GcState
  customer: GcCustomer
  project: GcProject
  step: ContractStep
  /** The press: keep the send, then email it when asked. Gives back what it did. */
  onSend: (input: ContractSendInput) => Promise<ContractSendOutcome>
  onDone: (outcome: ContractSendOutcome) => void
  onCancel: () => void
  /** The reader may email the customer (the money team). Unset: the box does not show, and nothing is emailed. */
  canEmail?: boolean
}) {
  const days = paperDayChoices(state.today)
  const newest = newestContractSend(state, project)
  // Email it now: the newest send as it went, its day and line too. Nothing about it changes, so nothing is picked.
  const again = step.mode === 'emailAgain' && newest !== null
  const [by, setBy] = useState(again && newest ? newest.by : (days[1]?.on ?? state.today))
  // The email's words: a send emailed again reads as its first send did, or as a reminder.
  const mailMode: ContractSendInput['mode'] = step.mode === 'emailAgain' ? (newest?.first ? 'first' : 'reminder') : step.mode
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [email, setEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = box.current
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  // A reminder asks them to sign what they have: the last send's price and file. A first send and a new price go with
  // the price we carry today, and a file that says it.
  const reminder = step.mode === 'reminder' || again
  const worth = reminder && newest?.worth ? newest.worth : ownerContractWorthNow(project)
  const total = Object.values(worth).reduce((t, n) => t + n, 0)
  const kept = reminder && newest?.file ? newest.file : null
  const fileWords = file ? file.name : kept ? `${kept.name}, as it went last time` : null
  const field = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, auto) minmax(0, 1fr)', gap: '0.5rem', alignItems: 'start', fontSize: '0.88rem' } as const
  const label = { color: 'var(--text-muted)', paddingTop: '0.2rem' } as const

  const send = async () => {
    const chosen = file ?? kept
    if (!chosen) return setProblem('Pick the contract file first.')
    setBusy(true)
    setProblem(null)
    try {
      onDone(
        await onSend({
          signBy: by,
          note: again && newest ? newest.note : note,
          worth,
          file: chosen,
          mode: mailMode,
          total,
          email: again || (canEmail && email),
          ...(again && newest ? { sendId: newest.id } : {}),
        }),
      )
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That did not send.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={box}
      data-gc-customer-send={step.docKey}
      style={{ border: '1px solid var(--text-blue-500)', borderRadius: 8, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'grid', gap: '0.65rem', boxShadow: '0 0 0 3px var(--bg-blue-tint)' }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{step.title}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{step.history}</div>
      </div>
      <div style={field}>
        <span style={label}>To</span>
        <span>{customer.contact || customer.name}, in their portal</span>
      </div>
      <div style={field}>
        <span style={label}>The price</span>
        <span>
          <strong>{money(total)}</strong> for {project.name}
          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {reminder ? 'The price it went with. They sign it as it is.' : 'Our number today. Check the file says this price.'}
          </span>
        </span>
      </div>
      <div style={field}>
        <span style={label}>The file</span>
        <span style={{ display: 'grid', gap: '0.3rem' }}>
          {fileWords && <span data-gc-contract-file>{fileWords}</span>}
          {!again && (
          <input
            type="file"
            accept="application/pdf,.pdf"
            aria-label={kept ? 'Pick another contract PDF' : 'The contract PDF'}
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null
              const why = picked ? contractFileProblem(picked) : null
              setProblem(why)
              setFile(why ? null : picked)
            }}
            style={{ fontSize: '0.82rem' }}
          />
          )}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>A PDF they read and sign. A file is never replaced once it goes.</span>
        </span>
      </div>
      {again && newest ? (
        <div style={field}>
          <span style={label}>{step.dayWord}</span>
          <span>
            {weekdayDate(newest.by)}, as it went
            {newest.note && <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Your line: {newest.note}</span>}
          </span>
        </div>
      ) : (
        <>
      <div style={field}>
        <span style={label}>{step.dayWord}</span>
        <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label={step.dayWord}>
          {days.map((d) => {
            const on = d.on === by
            return (
              <button
                key={d.on}
                type="button"
                aria-pressed={on}
                onClick={() => setBy(d.on)}
                style={{
                  padding: '0.2rem 0.65rem',
                  borderRadius: 999,
                  border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
                  fontWeight: on ? 600 : 400,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {d.label}
              </button>
            )
          })}
        </span>
      </div>
      <label style={field}>
        <span style={label}>Your line</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Optional. Kept with the send, for the email once it can go."
          aria-label="Your line, kept with the send"
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', font: 'inherit', fontSize: '0.88rem' }}
        />
      </label>
        </>
      )}
      {canEmail && !again && (
        <label style={{ fontSize: '0.88rem', display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
          Email it to them now, with their portal link
        </label>
      )}
      {again || (canEmail && email) ? (
        <ContractEmailPreview state={state} customer={customer} project={project} mode={mailMode} total={total} signBy={by} note={again && newest ? newest.note : note} fileName={file?.name ?? kept?.name ?? null} />
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No email goes. They read it and sign it when they open their portal.</div>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn kind="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        <Btn kind="primary" onClick={() => void send()} disabled={busy || (!file && !kept)}>
          {busy ? 'Sending…' : step.sendLabel}
        </Btn>
      </div>
    </div>
  )
}

/** The email as they will get it: our words, the portal line the function adds, and the file attached. */
function ContractEmailPreview({
  state,
  customer,
  project,
  mode,
  total,
  signBy,
  note,
  fileName,
}: {
  state: GcState
  customer: GcCustomer
  project: GcProject
  mode: Exclude<ContractStep['mode'], 'emailAgain'>
  total: number
  signBy: string
  note: string
  fileName: string | null
}) {
  const mail = contractMail(contractMailFacts(state, project, { mode, price: total, signBy, note }))
  return (
    <div data-theme="light" data-gc-contract-email style={{ background: PAPER, color: INK, border: `1px solid ${INK}`, borderRadius: 8, overflow: 'hidden', fontSize: '0.85rem' }}>
      <div style={{ background: INK, color: PAPER, padding: '0.35rem 0.65rem', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>The email {customer.name} gets</div>
      <div style={{ padding: '0.55rem 0.7rem', display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>{mail.subject}</div>
        {mail.lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        <div>Read it and sign it in your portal: their link</div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', border: '1px solid #c9bfa8', borderRadius: 6, padding: '0.4rem 0.55rem', background: '#fffdf8' }}>
          <span aria-hidden style={{ fontSize: '1.1rem' }}>📄</span>
          <span>
            <strong>{fileName ?? 'The contract file'}</strong>
            <span style={{ display: 'block', fontSize: '0.78rem', opacity: 0.75 }}>Attached as it went, the same file they sign in their portal.</span>
          </span>
        </div>
      </div>
    </div>
  )
}
