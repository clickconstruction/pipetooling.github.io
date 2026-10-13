/**
 * Messages, residential R8 · 8's screens: *Line on the estimate*, a tool of the message window on a customer's message
 * tied to a Pipeline job, beside cut 4b's *Start a change order* (the thread window's `messageWindowFirst` slot). A
 * press reads the job and the estimates its messages point at, and puts the kernel's line under the tools
 * (`lineDraftFromMessage`): its place on the job's open draft or a new one, the message's first sentence as its
 * description, and a name for the office to give. *Save the line* goes through `draft_estimate_line_from_message`, which
 * stamps the message in the same call. The money team prices it and sends it. A message that cannot take one says why,
 * in the kernel's words.
 */
import { useState } from 'react'
import { hasOptionsWords, lineDraftFromMessage, type LineDraft } from '../../lib/estimates/lineFromMessage'
import type { LineFromMessageIo, LineSaved, LineThreadContact } from '../../lib/estimates/lineFromMessageIo'
import { jobRefOf } from '../../lib/messages/load'
import type { ThreadMessage } from '../../lib/messages/thread'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, input } from '../gc/gcUi'

type Step = { at: 'idle' } | { at: 'reading' } | { at: 'refused'; words: string } | { at: 'form'; draft: LineDraft; seenAt: string | null }

export interface StartEstimateLineProps {
  message: ThreadMessage
  /** The customer the thread is with. */
  contact: LineThreadContact
  io: Pick<LineFromMessageIo, 'loadJob' | 'draft'>
  /** After the line is saved: where it went, and the draft it was read as. */
  onDrafted: (saved: LineSaved, draft: LineDraft) => void | Promise<void>
}

const PRESS_TIP = 'Puts this message on the job’s estimate as a line at $0. The money team prices it and sends it.'

export function StartEstimateLine({ message, contact, io, onDrafted }: StartEstimateLineProps) {
  const [step, setStep] = useState<Step>({ at: 'idle' })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const start = async () => {
    setProblem(null)
    setStep({ at: 'reading' })
    // Only a Pipeline job takes a line: a line on the person, a bid or a GC job reads as no job.
    const ref = jobRefOf(message.jobId)
    const jobId = ref?.kind === 'pipeline' ? ref.id : null
    try {
      const read = jobId ? await io.loadJob(jobId) : null
      const source = { id: message.id, contactId: message.contactId, jobId, channel: message.channel, direction: message.direction, at: message.at, body: message.body }
      const got = lineDraftFromMessage(source, contact, read ? [read.job] : [], read?.estimates ?? [])
      if (!got.ok) {
        setStep({ at: 'refused', words: got.words })
        return
      }
      const joins = got.draft.estimateId ? read?.estimates.find((e) => e.id === got.draft.estimateId) : undefined
      if (joins?.hasOptions) {
        setStep({ at: 'refused', words: hasOptionsWords(joins.number) })
        return
      }
      setName(got.draft.line.line_item)
      setDescription(got.draft.line.description)
      setStep({ at: 'form', draft: got.draft, seenAt: joins?.seenAt ?? null })
    } catch (e) {
      setStep({ at: 'idle' })
      setProblem(formatErrorMessage(e, 'The job could not be read.'))
    }
  }

  const save = async (draft: LineDraft, seenAt: string | null) => {
    if (!name.trim() && !description.trim()) {
      setProblem('Say what the line is for.')
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      const saved = await io.draft(message.id, {
        estimateId: draft.estimateId,
        line: { ...draft.line, line_item: name.trim(), description: description.trim() },
        replacesLast: draft.replacesLast,
        seenAt,
      })
      setStep({ at: 'idle' })
      await onDrafted(saved, draft)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The line was not saved.'))
    } finally {
      setSaving(false)
    }
  }

  const form = step.at === 'form' ? step : null
  const putAway = () => {
    setStep({ at: 'idle' })
    setProblem(null)
  }
  return (
    <>
      <Btn kind={form ? 'primary' : 'plain'} disabled={step.at === 'reading' || saving} title={PRESS_TIP} onClick={() => (form ? putAway() : void start())}>
        Line on the estimate
      </Btn>
      {(step.at === 'refused' || problem || form) && (
        // Its own row under the tools, after Copy, Print and Share.
        <div data-start-estimate-line style={{ order: 1, flexBasis: '100%', display: 'grid', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}>
          {step.at === 'refused' && <div role="status">{step.words}</div>}
          {form && (
            <>
              <strong>{`Line ${form.draft.number} on ${form.draft.estimateNumber != null ? `estimate ${form.draft.estimateNumber}` : 'a new estimate'} for ${form.draft.jobName}`}</strong>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                Line item
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hose bib" style={input} />
              </label>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                Description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...input, font: 'inherit' }} />
              </label>
              <div>{`It goes on at $0 for ${form.draft.signer.name} to approve. The money team prices it and sends it.`}</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Btn kind="primary" disabled={saving} onClick={() => void save(form.draft, form.seenAt)}>
                  {saving ? 'Saving…' : 'Save the line'}
                </Btn>
                <Btn kind="quiet" disabled={saving} onClick={putAway}>
                  Cancel
                </Btn>
              </div>
            </>
          )}
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)' }}>
              {problem}
            </div>
          )}
        </div>
      )}
    </>
  )
}
