/**
 * Messages, residential R7: **Sort all**, the desk behind the New lane's header (the customer Messages prototype v0.8,
 * screen 7, mockup C's `deskHtml`). A window over Follow up that walks New's people one card at a time with nothing
 * else on the screen: how far it has come, how the line came in, who it is from, their words, and the lane's own sort
 * card (`NewLaneSlot`, unchanged) for the presses. A press reads Follow up again, the person leaves New and the next
 * card comes up. *Skip for now* puts a person after the rest (`followUp/sortDesk.ts`). *Someone else* closes the desk
 * and opens the thread at the line, where the window's own *Who is this?* is. Empty, it says all are sorted.
 */
import { useMemo, useState } from 'react'
import type { FollowUpContact } from '../../lib/followUp/followUpRows'
import type { NewLaneRow } from '../../lib/followUp/newLane'
import type { NewLaneCardIo } from '../../lib/followUp/newLaneCardIo'
import { DESK_DONE, DESK_OPEN_THREAD, DESK_SKIP, deskContact, deskStep, skipOne, SORT_ALL } from '../../lib/followUp/sortDesk'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { Btn } from '../gc/gcUi'
import { NewLaneSlot, type Say } from './NewLaneSlot'

export interface SortAllDeskProps {
  /** New as Follow up draws it now: re-read after each press, so a sorted person is gone from it. */
  lane: readonly NewLaneRow[]
  /** Follow up's people, for the sort card's person. */
  contacts: readonly FollowUpContact[]
  io: NewLaneCardIo
  me: { id: string; name: string }
  say: Say
  /** Reads Follow up again after a press. */
  reread: () => void
  onClose: () => void
  onOpenThread: (contactId: string, atMessageId?: string) => void
  /** Now, for a smoke; the clock otherwise. */
  nowIso?: string
}

/** Parts side by side with a quiet dot between, as the mockup lays out "New · 3 to sort · 2 of 4". */
function Parts({ parts }: { parts: readonly string[] }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
      {parts.map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', gap: '0.4rem' }}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>{p}</span>
        </span>
      ))}
    </div>
  )
}

export function SortAllDesk({ lane, contacts, io, me, say, reread, onClose, onOpenThread, nowIso }: SortAllDeskProps) {
  // How many waited when the desk opened, so the count reads "2 of 4" as the desk goes.
  const [total] = useState(lane.length)
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set())
  const step = deskStep(lane, skipped, total)
  const row = step.current ? lane.find((r) => r.contactId === step.current) : undefined
  const person = row ? contacts.find((c) => c.id === row.contactId) : undefined
  const contact = useMemo(() => (person ? deskContact(person) : null), [person])

  const toThread = (r: NewLaneRow) => {
    onClose()
    onOpenThread(r.contactId, r.messageId)
  }

  return (
    <ResponsiveModalShell title={SORT_ALL} onRequestClose={onClose} fullScreenKey="follow-up-sort-all" maxWidthDesktop={680}>
      <div data-sort-all-desk style={{ display: 'grid', gap: '0.75rem', padding: '0.25rem 0 0.5rem' }}>
        {!row ? (
          <div data-sort-all-done style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center', textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <strong style={{ fontSize: '1.1rem' }}>{DESK_DONE.title}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{DESK_DONE.note}</span>
            <Btn kind="primary" onClick={onClose}>
              {DESK_DONE.back}
            </Btn>
          </div>
        ) : (
          <>
            <div data-sort-all-progress style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Parts parts={step.progress} />
            </div>
            <section
              aria-label={`Sort ${row.who}`}
              data-sort-all-card={row.contactId}
              style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'grid', gap: '0.5rem' }}
            >
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                <Parts parts={[row.via, row.when]} />
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{row.who}</div>
                {row.company && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.company}</div>}
              </div>
              <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{row.words}</div>
              {contact ? (
                <NewLaneSlot
                  key={row.contactId}
                  contact={contact}
                  acts={{ openWho: () => toThread(row), showContact: () => {} }}
                  io={io}
                  say={say}
                  reread={reread}
                  me={me}
                  {...(nowIso ? { nowIso } : {})}
                />
              ) : (
                <div>
                  <Btn onClick={() => toThread(row)}>{DESK_OPEN_THREAD}</Btn>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Btn kind="quiet" onClick={() => setSkipped((s) => skipOne(lane, s, row.contactId))}>
                  {DESK_SKIP}
                </Btn>
                <span data-sort-all-more style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {step.more}
                </span>
              </div>
            </section>
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
