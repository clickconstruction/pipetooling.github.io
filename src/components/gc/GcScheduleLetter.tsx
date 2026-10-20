/**
 * GC mode, the real build, the schedule's PR 15a: the customer's schedule sent on its own (G-94), ported from the GC mode
 * prototype (branch spike/gc-mode, `ScheduleSendCard` in `GcBuildingSchedule.tsx`) with its words; the plan is
 * to-dos/gc-mode/mockups/schedule-pr15.md on that branch. The letter as it would go today (`customerScheduleLetter`), read
 * here, printed to a page (`customerScheduleHtml`), tested to the sender's own address, and sent to the customer's contact
 * through `gc-customer-email`, kind `schedule`. Each send is kept as it went, newest first. A print keeps no letter row
 * (call 7), and like every print it files its copy in Documents (`printAndFile`, docs/SENT_COPIES.md). Its button is
 * **Print the letter**, so it never reads as the chart's **Print or PDF** on the same window.
 * The window keeps the row and sends it (`onSend`); the letter is built from the read's own state, never the money read's,
 * so it reads the same whoever sends it (gc 4's note 1).
 */
import { useState } from 'react'
import { gcCustomerEmailRefusal, type CustomerEmailAnswer } from '../../lib/gc/customerEmail'
import { customerScheduleHtml, customerScheduleLetter, scheduleSends, type ScheduleLetter } from '../../lib/gc/schedule/customerScheduleSend'
import type { GcProject, GcState } from '../../lib/gc/types'
import { weekdayDate } from '../../lib/gc/words'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, Card, Chip } from './gcUi'

/** What a press answered, in the card's words. */
function answerWords(answer: CustomerEmailAnswer, test: boolean): { ok: boolean; words: string } {
  if (answer.ok) return { ok: true, words: test ? `A test copy went to ${answer.email}.` : `Sent to ${answer.to || 'them'} at ${answer.email}.` }
  // The kind's own words where the shared ones speak of a bill.
  if (answer.key === 'alreadySent') return { ok: false, words: 'That letter went already.' }
  return { ok: false, words: gcCustomerEmailRefusal(answer.key) }
}

export function GcScheduleLetter({
  state,
  project,
  by,
  onSend,
}: {
  state: GcState
  project: GcProject
  by: string
  /** Keep the letter and email it, or a test copy of it to the sender. Unset: read and print only. */
  onSend?: (letter: ScheduleLetter, test: boolean) => Promise<CustomerEmailAnswer>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'test' | 'send' | null>(null)
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null)
  const letter = customerScheduleLetter(state, project, by)
  const sends = scheduleSends(project)
  const emailed = sends.filter((s) => s.emailed).length
  const reader = letter.to.split(',')[0] ?? letter.to
  const company = state.customers.find((c) => c.id === project.customerId)?.name || project.owner
  // A print is a send: its copy goes in Documents under the customer, with the emailed letters' kind.
  const print = () => {
    const printed = printAndFile(customerScheduleHtml(letter), { kind: 'field_report_gc_schedule', title: letter.subject, recipientName: company, customerId: project.customerId || null, source: { table: 'gc_schedules', id: project.id } })
    setSaid(printed ? null : { ok: false, words: 'The print window was blocked. Allow pop-ups for this site and press it again.' })
  }
  const send = async (test: boolean) => {
    if (!onSend) return
    setBusy(test ? 'test' : 'send')
    setSaid(null)
    try {
      setSaid(answerWords(await onSend(letter, test), test))
    } catch (e) {
      setSaid({ ok: false, words: formatErrorMessage(e, 'The letter was not kept.') })
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card>
      <div data-gc-schedule-letter style={{ display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong>Send {project.owner} their schedule</strong>
          {emailed > 0 && <Chip tone="grey">{emailed === 1 ? 'sent once' : `sent ${emailed} times`}</Chip>}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: '1 1 16rem' }}>
            <span>Their schedule as a dated letter.</span> <span>It has the finish, each stage, what changed and what we need from them.</span>{' '}
            <span>Each letter is kept as it went.</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Btn kind="plain" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide the letter' : 'Read the letter'}
          </Btn>
          <Btn kind="plain" onClick={print} title="Opens it as a page to print or save as a PDF.">
            Print the letter
          </Btn>
          {onSend && (
            <>
              <Btn kind="plain" disabled={busy !== null} onClick={() => void send(true)} title="The same email, to your own address only.">
                {busy === 'test' ? 'Sending…' : 'Send a test to me'}
              </Btn>
              <Btn kind="primary" disabled={busy !== null} onClick={() => void send(false)}>
                {busy === 'send' ? 'Sending…' : `Send to ${reader}`}
              </Btn>
            </>
          )}
        </div>
        {said && (
          <div role={said.ok ? 'status' : 'alert'} style={{ fontSize: '0.85rem', color: said.ok ? 'var(--text-muted)' : 'var(--text-red-700)' }}>
            {said.words}
          </div>
        )}
        {open && (
          <article data-gc-schedule-letter-text style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', display: 'grid', gap: '0.1rem', background: 'var(--bg-subtle)' }}>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>To </span>
                {letter.to}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{letter.subject}</span>
            </div>
            <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.4rem', lineHeight: 1.45, fontSize: '0.875rem' }}>
              {letter.lines.map((line, i) => (
                <div key={`${i}:${line}`}>{line}</div>
              ))}
            </div>
          </article>
        )}
        {sends.length > 0 && (
          <div data-gc-schedule-sends style={{ display: 'grid', gap: '0.15rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {sends.map((s) => (
              <div key={s.id} data-gc-schedule-send={s.emailed ? 'emailed' : 'kept'}>
                {s.emailed
                  ? `${weekdayDate(s.on)} · ${s.by} sent ${s.to} “${s.subject}”, ${s.lines.length} lines.`
                  : `${weekdayDate(s.on)} · ${s.by} kept “${s.subject}”, not emailed yet.`}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
