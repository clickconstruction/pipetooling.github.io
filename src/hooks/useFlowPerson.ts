import { useCallback, useEffect, useMemo, useState } from 'react'
import { firstName } from '../lib/contacts/kernel'
import { findFlowContactId, flowPresses, readFlowPerson, type FlowPersonRead } from '../lib/flows/flowPersonIo'
import type { PersonFlow } from '../lib/flows/nudges'
import { personFlowFrom } from '../lib/flows/person'
import { formatErrorMessage } from '../utils/errorHandling'

/** Whom the panel is for: a contact, or the record a company's or a customer's window is open on. */
export type FlowPersonAt = { contactId?: string | null; gcCompanyId?: string | null; customerId?: string | null }

export type FlowPersonState =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'error'; words: string }
  | { state: 'ready'; person: PersonFlow; read: FlowPersonRead }

/** Every reader of one person, by contact id: a press in one reads them again in all (the side's panel, cut 3's strip). */
const readers = new Set<(contactId: string) => void>()

/** Read this person again wherever they are shown: after a press here, or a write elsewhere that moves their flow. */
export function flowPersonChanged(contactId: string): void {
  for (const reread of readers) reread(contactId)
}

/**
 * One person on their flow, for the flow panel and the step card (Messages cut 4): their contact, their flow, their
 * rows through `flow_rows`, and the presses, each followed by a fresh read in every reader of the person. `now` is read
 * once per load.
 */
export function useFlowPerson(at: FlowPersonAt) {
  const [contactId, setContactId] = useState<string | null>(at.contactId ?? null)
  const [got, setGot] = useState<FlowPersonState>({ state: 'loading' })
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const id = at.contactId ?? (await findFlowContactId({ gcCompanyId: at.gcCompanyId ?? null, customerId: at.customerId ?? null }))
        if (off) return
        setContactId(id)
        if (!id) return setGot({ state: 'none' })
        const read = await readFlowPerson(id)
        if (off) return
        const card = read.rows.card
        const first = firstName({ name: read.contact.name ?? card?.name ?? '', goesBy: read.contact.goes_by ?? card?.goes_by ?? null, kind: read.contact.kind })
        const person = personFlowFrom({
          id,
          first: first || card?.company || 'them',
          flow: read.flow,
          rows: read.rows,
          now: new Date(),
          holds: read.holds,
          sent: read.sent,
          notes: read.notes,
          lines: read.lines,
        })
        setGot({ state: 'ready', person, read })
      } catch (e) {
        if (!off) setGot({ state: 'error', words: formatErrorMessage(e) })
      }
    })()
    return () => {
      off = true
    }
  }, [at.contactId, at.gcCompanyId, at.customerId, tick])

  useEffect(() => {
    if (!contactId) return
    const reread = (id: string) => {
      if (id === contactId) refresh()
    }
    readers.add(reread)
    return () => {
      readers.delete(reread)
    }
  }, [contactId, refresh])

  const read = got.state === 'ready' ? got.read : null
  const presses = useMemo(() => {
    const run =
      <A extends unknown[]>(fn: (...a: A) => Promise<unknown>) =>
      async (...a: A) => {
        await fn(...a)
        if (contactId) flowPersonChanged(contactId)
        else refresh()
      }
    const skipId = (stepId: string, jobId: string | null) =>
      read?.rows.skips?.find((k) => k.step_key === stepId && (k.project_id ?? null) === jobId && !k.undone_at)?.id ?? null
    const holdId = (stepId: string, jobId: string | null) =>
      read?.holds.find((h) => h.step_key === stepId && (h.project_id ?? null) === jobId && !h.released_at)?.id ?? null
    return {
      addNote: run((stepId: string, jobId: string | null, note: string) => flowPresses.addNote(contactId ?? '', stepId, { projectId: jobId }, note)),
      skip: run((stepId: string, jobId: string | null, why: string) => flowPresses.skip(contactId ?? '', stepId, { projectId: jobId }, why)),
      putBack: run(async (stepId: string, jobId: string | null) => {
        const id = skipId(stepId, jobId)
        if (id) await flowPresses.unskip(id)
      }),
      holdUntil: run((stepId: string, jobId: string | null, until: string) => flowPresses.holdUntil(contactId ?? '', stepId, { projectId: jobId }, until)),
      letGo: run(async (stepId: string, jobId: string | null) => {
        const id = holdId(stepId, jobId)
        if (id) await flowPresses.letGo(id)
      }),
      remindNow: run((stepId: string, jobId: string | null, how: 'text' | 'call' | 'email', round: string | null) =>
        flowPresses.remindNow(contactId ?? '', stepId, { projectId: jobId }, how, round),
      ),
      setOff: run((why: string) => flowPresses.setOff(contactId ?? '', why)),
      putBackOn: run(() => flowPresses.putBackOn(contactId ?? '')),
    }
  }, [contactId, read, refresh])

  return { contactId, got, refresh, presses }
}
