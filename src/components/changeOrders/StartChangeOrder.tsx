/**
 * Messages, cut 4b's screens: *Start a change order*, a tool of the message window on a customer's message, after cut 2's
 * highlight (the thread window's `messageWindowFirst` slot). A press reads the job the message is tied to and puts the
 * kernel's draft under the tools (`draftFromMessage`): what changes, from the message's first line, why, who signs, and
 * the number it should take. *Save the draft* goes through `gc_draft_change_order_from_message`, which numbers it under
 * the job's lock. The money team prices it and sends it. A message that cannot start one says why, in the kernel's words.
 */
import { useState } from 'react'
import { draftFromMessage, type ChangeOrderFromMessage, type MessageContact } from '../../lib/changeOrders/fromMessage'
import type { FromMessageIo } from '../../lib/changeOrders/fromMessageIo'
import { CHANGE_ORDER_REASON_WORDS } from '../../lib/gc/ownerBilling'
import type { ChangeOrderReason } from '../../lib/gc/types'
import { jobRefOf } from '../../lib/messages/load'
import type { ThreadMessage } from '../../lib/messages/thread'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, input } from '../gc/gcUi'

const REASONS: readonly ChangeOrderReason[] = ['owner', 'field', 'plans']

type Step = { at: 'idle' } | { at: 'reading' } | { at: 'refused'; words: string } | { at: 'form'; order: ChangeOrderFromMessage }

export interface StartChangeOrderProps {
  message: ThreadMessage
  /** The customer the thread is with. */
  contact: MessageContact
  io: Pick<FromMessageIo, 'loadJob' | 'draft'>
  /** After the draft is saved: the order and its job's name. */
  onDrafted: (order: { id: string; number: number }, jobName: string) => void | Promise<void>
}

export function StartChangeOrder({ message, contact, io, onDrafted }: StartChangeOrderProps) {
  const [step, setStep] = useState<Step>({ at: 'idle' })
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState<ChangeOrderReason>('owner')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const start = async () => {
    setProblem(null)
    setStep({ at: 'reading' })
    // Only a GC job takes a change order: a line on the person, a bid or a Pipeline job reads as no job.
    const ref = jobRefOf(message.jobId)
    const projectId = ref?.kind === 'project' ? ref.id : null
    try {
      const job = projectId ? await io.loadJob(projectId) : null
      const source = { id: message.id, contactId: message.contactId, jobId: projectId, channel: message.channel === 'event' ? 'note' : message.channel, direction: message.direction, at: message.at, body: message.body } as const
      const got = draftFromMessage(source, contact, job ? [job] : [])
      if (!got.ok) {
        setStep({ at: 'refused', words: got.words })
        return
      }
      setDescription(got.order.draft.description)
      setReason(got.order.draft.reason)
      setStep({ at: 'form', order: got.order })
    } catch (e) {
      setStep({ at: 'idle' })
      setProblem(formatErrorMessage(e, 'The job could not be read.'))
    }
  }

  const save = async (order: ChangeOrderFromMessage) => {
    if (!description.trim()) {
      setProblem('Say what is changing.')
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      const saved = await io.draft(message.id, { ...order.draft, description: description.trim(), reason })
      setStep({ at: 'idle' })
      await onDrafted(saved, order.jobName)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The change order was not drafted.'))
    } finally {
      setSaving(false)
    }
  }

  const form = step.at === 'form' ? step.order : null
  const putAway = () => {
    setStep({ at: 'idle' })
    setProblem(null)
  }
  return (
    <>
      <Btn
        kind={form ? 'primary' : 'plain'}
        disabled={step.at === 'reading' || saving}
        title="Drafts a change order from this message, on the job it is tied to. The money team prices it and sends it."
        onClick={() => (form ? putAway() : void start())}
      >
        Start a change order
      </Btn>
      {(step.at === 'refused' || problem || form) && (
        // Its own row under the tools, after Copy, Print and Share.
        <div data-start-change-order style={{ order: 1, flexBasis: '100%', display: 'grid', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}>
          {step.at === 'refused' && <div role="status">{step.words}</div>}
          {form && (
            <>
              <strong>{`Change order ${form.nextNumber} on ${form.jobName}`}</strong>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                What changes
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...input, font: 'inherit' }} />
              </label>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                Why it changes
                <select value={reason} onChange={(e) => setReason(e.target.value as ChangeOrderReason)} style={input}>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {CHANGE_ORDER_REASON_WORDS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <div>{`${form.signer.name} signs it. The money team prices it and sends it to sign.`}</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Btn kind="primary" disabled={saving} onClick={() => void save(form)}>
                  {saving ? 'Saving…' : 'Save the draft'}
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
