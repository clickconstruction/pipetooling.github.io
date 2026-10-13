import { useEffect, useState } from 'react'
import { firstName, type Contact } from '../../../../lib/contacts/kernel'
import { dayLabel } from '../../../../lib/messages/owed'
import { lastFromThem } from '../../../../lib/messages/replyBox'
import type { ThreadMessage } from '../../../../lib/messages/thread'
import { FIND_NOTE, qrEmpty, qrGroups, qrTotal, type QuickReply, type StepRef } from '../../../../lib/quickReplies/kernel'
import { calendarYmdInAppTzFromIso } from '../../../../utils/dateUtils'
import { input } from '../../gcUi'
import { Marked } from './QuickRepliesStrip'

const CHANNEL_WORD: Partial<Record<ThreadMessage['channel'], string>> = { text: 'text', email: 'email', call: 'call', voicemail: 'voicemail', missed: 'missed call', portal: 'portal' }

/**
 * Messages, cut 3's screens: *Find a reply*, opened from the strip's ⤢ Find. Their last message on top, then where they
 * are in the flow (`where`, from `findWhere`), the narrow box, and every line with room to read, the lines for the step
 * they are on first. A press on a line fills the box and closes the window; nothing sends. When no line fits, the
 * narrowed words can be added as a quick reply.
 */
export function FindReplyWindow({
  contact,
  lines,
  threadLines,
  me,
  nowStepId,
  steps,
  where,
  onOpenStep,
  onUse,
  onAdd,
  onEdit,
  onClose,
}: {
  contact: Contact
  lines: readonly QuickReply[]
  threadLines: readonly ThreadMessage[]
  me: string
  nowStepId: string | null
  steps: readonly StepRef[]
  /** Where they are in the flow (`findWhere`); null while the flow is still being read, so nothing is said yet. */
  where: { head: string[]; sentence: string } | null
  /** Opens the step's card in the thread window's side panel; absent when no step is on. */
  onOpenStep?: () => void
  onUse: (q: QuickReply) => void
  onAdd: (words: string) => void
  /** Closes this window and opens the quick replies editor. */
  onEdit: () => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState('')
  const groups = qrGroups(lines, { kind: contact.kind, nowStepId, steps, me, filter, place: 'find' })
  const last = lastFromThem(threadLines)
  const first = contact.kind === 'unknown' ? contact.name : firstName(contact)
  const empty = qrEmpty(filter, 'find')
  const stepOf = (q: QuickReply) => (q.stepId ? (steps.find((s) => s.id === q.stepId)?.name ?? null) : null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const head = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.04em' } as const

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Find a reply · ${contact.name}`}
        data-find-reply
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: 'min(88vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Find a reply · {contact.name}</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{FIND_NOTE}</span>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.7rem', fontSize: '0.875rem' }}>
          <div data-find-last style={{ display: 'grid', gap: '0.2rem' }}>
            {last ? (
              <>
                <span style={head}>
                  Their last message · {CHANNEL_WORD[last.channel] ?? last.channel} · {dayLabel(calendarYmdInAppTzFromIso(last.at))}
                </span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{last.body}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Nothing from {first} yet.</span>
            )}
          </div>
          {where && (
            <div data-find-where style={{ display: 'grid', gap: '0.2rem' }}>
              <span style={head}>Where {first} is</span>
              <span>
                {where.head.length > 0 && <strong>{where.head.join(' · ')}. </strong>}
                {where.sentence}
                {onOpenStep && (
                  <>
                    {' '}
                    <button type="button" onClick={onOpenStep} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                      the step’s card ›
                    </button>
                  </>
                )}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input aria-label="Narrow the lines" placeholder="⌕ narrow the lines" value={filter} autoFocus onChange={(e) => setFilter(e.target.value)} style={{ ...input, flex: 1, minWidth: 0 }} />
            <button type="button" onClick={onEdit} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
              Edit quick replies
            </button>
          </div>
          <div data-find-lines style={{ display: 'grid', gap: '0.6rem' }}>
            {groups.length === 0 && (
              <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {empty.words}
                {empty.add && (
                  <button type="button" onClick={() => onAdd(filter)} style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.15rem 0.5rem', cursor: 'pointer' }}>
                    {empty.add}
                  </button>
                )}
              </div>
            )}
            {groups.map((g) => (
              <div key={g.key} style={{ display: 'grid', gap: '0.3rem' }}>
                <span style={head}>
                  {g.title}
                  {g.tag && <em style={{ textTransform: 'none', fontWeight: 400 }}> {g.tag}</em>} <span style={{ color: 'var(--text-muted)' }}>{g.rows.length}</span>
                </span>
                {g.rows.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    data-find-line={q.id}
                    onClick={() => onUse(q)}
                    style={{ textAlign: 'left', border: '1px solid var(--border)', borderStyle: q.scope === 'mine' ? 'dashed' : 'solid', borderRadius: 8, background: 'var(--surface)', padding: '0.4rem 0.6rem', cursor: 'pointer', display: 'grid', gap: '0.1rem' }}
                  >
                    <span>
                      <Marked text={q.text} needle={filter} />
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {[stepOf(q), `used ${qrTotal(q)}`, q.scope === 'mine' ? 'mine' : null].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
