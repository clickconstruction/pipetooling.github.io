import { useEffect, useRef, useState } from 'react'
import { newestContractSend, type ContractStep } from '../../lib/gc/customerContract'
import { ownerContractWorthNow } from '../../lib/gc/ownerBilling'
import { contractFileProblem, type StoredContractFile } from '../../lib/gc/ownerContractIo'
import { paperDayChoices } from '../../lib/gc/paperSend'
import type { GcCustomer, GcProject, GcState } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'
import { Btn, input } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-d-ii: send our contract from the customer's window, after the design spike's
 * `GcCustomerSend` on the company window's send (`GcPaperSend.tsx`). The office's own contract file (call D1) goes with
 * the price by line it shows (call D2), side by side so the office checks the file says that price before the press. A
 * first send and a new price need a file; a reminder keeps the last one unless another is picked. They sign the newest
 * in their portal (B6-d-iii-a); the email that tells them comes with B6-d-iii-b, so until then nothing is emailed.
 */

export interface ContractSendInput {
  signBy: string
  note: string
  worth: Record<string, number>
  file: File | StoredContractFile
}

export function GcCustomerContractSend({
  state,
  customer,
  project,
  step,
  onSend,
  onDone,
  onCancel,
}: {
  state: GcState
  customer: GcCustomer
  project: GcProject
  step: ContractStep
  onSend: (input: ContractSendInput) => Promise<void>
  onDone: (words: string) => void
  onCancel: () => void
}) {
  const days = paperDayChoices(state.today)
  const [by, setBy] = useState(days[1]?.on ?? state.today)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = box.current
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  const newest = newestContractSend(state, project)
  // A reminder asks them to sign what they have: the last send's price and file. A first send and a new price go with
  // the price we carry today, and a file that says it.
  const reminder = step.mode === 'reminder'
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
      await onSend({ signBy: by, note, worth, file: chosen })
      onDone('On record with its price and file. No email goes yet: they find it when they open their portal.')
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
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>A PDF they read and sign. A file is never replaced once it goes.</span>
        </span>
      </div>
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
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No email goes yet. They read it and sign it when they open their portal.</div>
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
