import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../../contexts/ToastContext'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { useMeasuredWidth } from '../../../hooks/useMeasuredWidth'
import { contactById, firstName, initials, isOptedOut, kindWord, unnamedWords, type Contact } from '../../../lib/contacts/kernel'
import { lastWroteTo } from '../../../lib/messages/boxes'
import type { MessagesView } from '../../../lib/messages/messagesIo'
import { isSentLine } from '../../../lib/messages/sentLines'
import { stampSentence } from '../../../lib/messages/stamps'
import { foldedThreadRows } from '../../../lib/messages/appLines'
import type { SentStampsIo } from '../../../lib/messages/sentStampsIo'
import { courtOf, threadOf } from '../../../lib/messages/thread'
import { isThreadFolded, reachOpen } from '../../../lib/messages/threadFold'
import { noFlowWords } from '../../../lib/flows/facts'
import { tieSheetRows } from '../../../lib/messages/tieSheet'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { PhoneSheet } from '../../PhoneSheet'
import { Chip, type Tone } from '../gcUi'
import { JobPickerWindow } from './JobPickerWindow'
import { JobsRail } from './JobsRail'
import { MessageWindow } from './MessageWindow'
import type { MessagesWrites } from './messagesWrites'
import { OpenThreadContext, type OpenThread } from './openThread'
import { AppFoldLine, EventLine, ThreadLine } from './ThreadLine'
import { useThreadSlots, type ThreadMenuRow, type ThreadSlots } from './threadSlots'
import { useSentLineFacts } from './useSentLineFacts'
import { WhoIsThisWindow } from './WhoIsThisWindow'

export interface ThreadWindowProps {
  contactId: string
  /** The line to show and mark: a message id. */
  at?: string | null
  onClose: () => void
  /** A smoke's slots in place of every cut's (`useThreadSlots`, which the window reads itself). */
  slots?: ThreadSlots
  /** The page's read of the contacts and their lines. Null: still loading. */
  view: MessagesView | null
  problem?: string | null
  nowIso: string
  writes: MessagesWrites
  /** ⧉ on a job: open it. */
  onOpenJob?: (jobKey: string) => void
  /** Open their record, from ⋯: the company window, or the customer. */
  onOpenRecord?: (c: Contact) => void
  /** Who is this? joined the number to a person who already had a thread: show theirs. */
  onShowContact?: (contactId: string) => void
  /** The sent copies' small print (R8 · 1): `sent_copy_stamps`'s read unless a smoke hands it a fake. */
  stampsIo?: SentStampsIo
}

const COURT_TONE: Record<'ours' | 'theirs' | 'none', Tone> = { ours: 'amber', theirs: 'green', none: 'grey' }
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A folded row's fade at its right end, so a pill cut off there says there is more. */
const ROW_FADE = 'linear-gradient(90deg, black calc(100% - 22px), transparent)'
/** One line, cut with an ellipsis: a folded header's name and company. */
const ONE_LINE = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } as const

/**
 * Messages, cut 1's screens: a person's thread, as a window over any view of GC projects (`?thread=<id>&at=<id>`),
 * and a full-screen sheet on a phone. The header in four calm rows (v1.166): the name with ☎ ⋯, what they are to us
 * and their company with the chevron over their numbers and addresses (for a number nobody has named, that fact —
 * `unnamedWords` — and the *Who is this?* button under it asks the question once, v2.5541), one status row that leads
 * with whose move it is, then the stamps sentence; the jobs rail last. Then the lines, a divider at each day, and the slots later cuts
 * fill (`ThreadSlots`). The message window, Who is this? and the job picker are drawn inside the panel.
 *
 * Folded (cut 10, `threadFold.ts`): on a phone, or when the thread's column is 640 px or narrower. The chevron and the
 * face are one press back to everyone in place of ×, the name and the company take one line each, the corner keeps the
 * header slot (as its narrow form), ☎ and ⋯, the numbers and addresses wait under the arrow, the status row scrolls
 * sideways, and the jobs run in one sideways strip.
 */
export function ThreadWindow({ contactId, at = null, onClose, slots: slotsGiven, view, problem = null, nowIso, writes, onOpenJob, onOpenRecord, onShowContact, stampsIo }: ThreadWindowProps) {
  // Every cut's slots, read here and not by the page: under the page's providers (`useMessagesReread`), and only while a
  // thread is open.
  const cutSlots = useThreadSlots()
  const slots = slotsGiven ?? cutSlots
  const phone = useMatchMedia('(max-width: 760px)')
  const [columnRef, columnWidth] = useMeasuredWidth<HTMLDivElement>()
  const folded = isThreadFolded(columnWidth, phone)
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const [contactChosen, setContactChosen] = useState<boolean | null>(null)
  const contactOpen = reachOpen(contactChosen, folded)
  const [showAll, setShowAll] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [openMessageId, setOpenMessageId] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  // The sort card draws *Who is this?* at its own top right while it asks who (spike): the header drops its button then.
  const [whoOnCard, setWhoOnCard] = useState(false)
  // The side folds to a chevron under the × (spike): by itself when it has nothing to show, by the chevron otherwise.
  // The state is keyed by the open person, so a new thread starts afresh without an effect that could race the side's report.
  const [sideState, setSideState] = useState<{ id: string; has: boolean | null; open: boolean | null }>({ id: contactId, has: null, open: null })
  const sideHas = sideState.id === contactId ? sideState.has : null
  const sideOpen = sideState.id === contactId ? sideState.open : null
  const sideShown = sideOpen ?? sideHas !== false
  const setSideHas = useCallback((has: boolean) => setSideState((s) => ({ id: contactId, has, open: s.id === contactId ? s.open : null })), [contactId])
  const setSideOpen = (open: boolean) => setSideState((s) => ({ id: contactId, has: s.id === contactId ? s.has : null, open }))
  const [picker, setPicker] = useState<{ kind: 'add' } | { kind: 'tie'; messageId: string } | null>(null)
  const [tying, setTying] = useState<string | null>(null)
  /** The line *Tie this message to* is open for: a phone's press and hold, or its *no job* (cut 10). */
  const [tieSheetFor, setTieSheetFor] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const contact = view ? contactById(view.contacts, contactId) : undefined
  const lines = useMemo(() => (view && contact ? threadOf(view.messages, contact.id, jobFilter) : []), [view, contact, jobFilter])
  const allLines = useMemo(() => (view && contact ? threadOf(view.messages, contact.id) : []), [view, contact])
  // The app's runs of lines fold to one row each (R8 · 1, card 1); a press opens one in place, for as long as the window is up.
  const [openFolds, setOpenFolds] = useState<ReadonlySet<string>>(() => new Set())
  const rows = useMemo(() => foldedThreadRows(lines, nowIso, { open: openFolds, at }), [lines, nowIso, openFolds, at])
  const toggleFold = (id: string) =>
    setOpenFolds((open) => {
      const next = new Set(open)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const smallPrint = useSentLineFacts(
    useMemo(() => lines.map((m) => m.id), [lines]),
    stampsIo,
  )
  const rail = (contact && view?.rails[contact.id]) || []

  const run = useCallback((press: Promise<unknown>, failed: string) => press.catch((e: unknown) => showToast(formatErrorMessage(e, failed), 'error')), [showToast])
  const tie = (messageId: string, jobKey: string | null) => run(writes.tieMessage(messageId, jobKey), 'The message was not tied.')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (tying) setTying(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, tying])

  // A link's line: brought into view and marked once the thread is drawn.
  useEffect(() => {
    if (!at || !contact) return
    requestAnimationFrame(() => document.querySelector(`[data-thread-line="${at.replace(/["\\]/g, '')}"]`)?.scrollIntoView({ block: 'center' }))
  }, [at, contact])

  const onDragEnd = (e: DragEndEvent) => {
    const jobKey = (e.active.data.current as { jobKey?: string } | undefined)?.jobKey
    const messageId = (e.over?.data.current as { messageId?: string } | undefined)?.messageId
    if (jobKey && messageId) void tie(messageId, jobKey)
  }

  const removeJob = async (key: string) => {
    if (!contact) return
    const tile = view?.tiles[key]
    const ok = await confirm({
      title: `Take ${tile ? `${tile.num} ${tile.name}` : 'this job'} off ${contact.name}?`,
      message: 'Their lines tied to it keep their tie. New messages stop landing there if it has the star.',
      confirmLabel: 'Take it off',
      cancelIsSafe: true,
    })
    if (ok) await run(writes.removeJob(contact.id, key), 'The job was not taken off.')
  }

  const ownRows: ThreadMenuRow[] = contact
    ? [
        { key: 'show-all', label: showAll ? 'Fold long messages' : 'Show all text', tip: 'Long messages show four lines until opened.', onPress: () => setShowAll((v) => !v) },
        { key: 'record', label: 'Open their record', disabled: !contact.record || !onOpenRecord, onPress: () => onOpenRecord?.(contact) },
      ]
    : []
  const menuRows = contact ? [...ownRows, ...(slots.menuRows?.(contact) ?? [])] : []
  const phones = contact?.channels.filter((ch) => ch.kind === 'phone') ?? []
  const emails = contact?.channels.filter((ch) => ch.kind === 'email') ?? []
  // Whose move it is: the lines, and what cut 2 knows (what we owe, a written promise's day; punch list #140 PR 7).
  const court = contact ? courtOf(allLines, contact.id, nowIso, { optedOut: isOptedOut(contact), ...(slots.court?.(contact) ?? {}) }) : null
  const stamps = contact ? stampSentence(contact, allLines, contact.id, nowIso) : null
  const openMessage = openMessageId ? allLines.find((m) => m.id === openMessageId) : undefined
  // The open thread for a slot's component (cut 3's reply box): given around everything the panel draws.
  const searchJobs = writes.searchJobs
  const openThread = useMemo<OpenThread | null>(
    () =>
      contact && view
        ? { contact, lines: allLines, jobFilter, rail: view.rails[contact.id] ?? [], tiles: view.tiles, userNames: view.userNames, nowIso, searchJobs }
        : null,
    [contact, view, allLines, jobFilter, nowIso, searchJobs],
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1200,
        display: 'flex',
        alignItems: phone ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={contact ? `${contact.name}: messages` : 'Messages'}
        data-thread-window={contactId}
        onClick={(e) => e.stopPropagation()}
        style={{
          // The page's ground, so the white lines sit on gray (v2.2203). `--surface-muted` was never a token: the backdrop showed through.
          background: 'var(--bg-page)',
          color: 'var(--text-base)',
          borderRadius: phone ? 0 : 10,
          width: phone ? '100%' : 'min(1100px, 100%)',
          height: phone ? '100%' : 'min(92vh, 100%)',
          display: 'flex',
          overflow: 'hidden',
          border: phone ? 'none' : '1px solid var(--border-strong)',
        }}
      >
        <OpenThreadContext.Provider value={openThread}>
        <div ref={columnRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!contact ? (
            <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, fontSize: '0.875rem', color: problem ? 'var(--text-red-700)' : 'var(--text-muted)' }} role={problem ? 'alert' : undefined}>
                {problem ?? (view ? 'This person is not in Messages.' : 'Loading the thread…')}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)' }}>
                ×
              </button>
            </div>
          ) : (
            <>
              <div data-thread-header={folded ? 'folded' : 'wide'} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: folded ? '0.5rem 0.75rem' : '0.6rem 0.9rem', display: 'grid', gap: folded ? '0.35rem' : '0.45rem' }}>
                <div style={{ display: 'flex', gap: folded ? '0.45rem' : '0.6rem', alignItems: 'center', minWidth: 0 }}>
                  {folded ? (
                    <button
                      type="button"
                      data-thread-back
                      onClick={onClose}
                      aria-label="Back to everyone"
                      title="Back to everyone"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '0.1rem 0.2rem 0.1rem 0', margin: '0 0 0 -0.25rem', borderRadius: 999, cursor: 'pointer', flex: 'none' }}
                    >
                      <span aria-hidden="true" style={{ color: 'var(--text-blue-700)', fontSize: '1.4rem', lineHeight: 1, fontWeight: 600, width: 14, textAlign: 'center' }}>
                        ‹
                      </span>
                      <span
                        aria-hidden="true"
                        style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-600)' }}
                      >
                        {initials(contact)}
                      </span>
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flex: 'none', color: 'var(--text-600)' }}
                    >
                      {initials(contact)}
                    </span>
                  )}
                  <div style={{ minWidth: 0, ...(folded ? { flex: 1 } : null) }}>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: folded ? 'nowrap' : 'wrap', minWidth: 0 }}>
                      {folded ? <span style={ONE_LINE}>{contact.name}</span> : contact.name}
                      {isOptedOut(contact) && <Chip tone="red">opted out</Chip>}
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-600)', display: 'flex', gap: '0.3rem', alignItems: 'center', minWidth: 0 }}>
                      {contact.kind === 'unknown' ? (
                        <span style={folded ? ONE_LINE : undefined}>{unnamedWords({ phones: phones.length, emails: emails.length })}</span>
                      ) : (
                        <span style={folded ? ONE_LINE : undefined}>
                          <strong>{capital(kindWord(contact.kind))}:</strong> {contact.company || contact.name}
                        </span>
                      )}
                      {(phones.length > 0 || emails.length > 0) && contact.kind !== 'unknown' && (
                        <button
                          type="button"
                          aria-expanded={contactOpen}
                          aria-label={contactOpen ? 'Hide their numbers and addresses' : 'Show their numbers and addresses'}
                          onClick={() => setContactChosen(!contactOpen)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0.2rem', flex: 'none' }}
                        >
                          {contactOpen ? '▾' : '›'}
                        </button>
                      )}
                    </div>
                  </div>
                  {!folded && <span style={{ flex: 1 }} />}
                  {folded && slots.headerRight?.(contact, { folded })}
                  {/* ☎, ⋯ and the who-has-it pill wear `.thread-head-control` (v2.5542): no border, one 28px height, a quiet hover. */}
                  <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', position: 'relative', flex: 'none' }}>
                    {phones[0] ? (
                      <a
                        href={`tel:${phones[0].value.replace(/[^\d+]/g, '')}`}
                        aria-label={`Call ${phones[0].value}`}
                        title="Calls their first number from this device. Calls on the company number come with Quo."
                        className="thread-head-control"
                      >
                        ☎
                      </a>
                    ) : (
                      <span aria-label="No number to call" title="No number to call" className="thread-head-control" style={{ opacity: 0.4, cursor: 'default' }}>
                        ☎
                      </span>
                    )}
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      aria-label="More"
                      onClick={() => setMenuOpen((v) => !v)}
                      className="thread-head-control"
                    >
                      ⋯
                    </button>
                    {menuOpen && !phone && (
                      <div role="menu" style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.25rem', display: 'grid', minWidth: 200, zIndex: 1 }}>
                        {menuRows.map((r) => (
                          <button
                            key={r.key}
                            type="button"
                            role="menuitem"
                            disabled={r.disabled}
                            title={r.tip}
                            onClick={() => {
                              setMenuOpen(false)
                              r.onPress()
                            }}
                            style={{ textAlign: 'left', border: 'none', background: 'transparent', padding: '0.4rem 0.55rem', cursor: r.disabled ? 'not-allowed' : 'pointer', opacity: r.disabled ? 0.5 : 1, borderRadius: 6 }}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* On a phone ⋯ is a sheet from the bottom: a row a thumb can hit, and Cancel (cut 10, phone-mockups.html 1c). */}
                    {menuOpen && phone && (
                      <PhoneSheet label="More" onClose={() => setMenuOpen(false)}>
                        <div role="menu" aria-label="More" style={{ display: 'grid', gap: '0.4rem', padding: '0.35rem 1rem 0.9rem', overflowY: 'auto' }}>
                          {menuRows.map((r) => (
                            <button
                              key={r.key}
                              type="button"
                              role="menuitem"
                              disabled={r.disabled}
                              title={r.tip}
                              onClick={() => {
                                setMenuOpen(false)
                                r.onPress()
                              }}
                              style={{ textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, padding: '0.7rem 0.85rem', fontSize: '0.95rem', cursor: r.disabled ? 'not-allowed' : 'pointer', opacity: r.disabled ? 0.5 : 1 }}
                            >
                              {r.label}
                            </button>
                          ))}
                          <button type="button" onClick={() => setMenuOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', padding: '0.6rem', fontSize: '0.95rem', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </PhoneSheet>
                    )}
                  </span>
                  {!folded && slots.headerRight?.(contact, { folded })}
                  {!folded && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                      <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
                        ×
                      </button>
                      {/* The side's fold, under the × (spike): › shows a folded side, ‹ folds it back. */}
                      {!phone && slots.side && (
                        <button
                          type="button"
                          data-thread-side-fold={sideShown ? 'shown' : 'folded'}
                          onClick={() => setSideOpen(!sideShown)}
                          aria-label={sideShown ? 'Hide their flow' : 'Show their flow'}
                          title={sideShown ? 'Hide their flow' : 'Show their flow'}
                          style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-blue-700)', padding: '0 0.4rem 0.1rem', fontWeight: 600 }}
                        >
                          {sideShown ? '‹' : '›'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {contact.kind === 'unknown' ? (
                  whoOnCard ? null : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setNaming(true)}
                        style={{ background: 'var(--text-blue-700)', color: 'white', border: 'none', borderRadius: 6, padding: '0.35rem 0.75rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Who is this?
                      </button>
                    </div>
                  )
                ) : (
                  contactOpen &&
                  (phones.length > 0 || emails.length > 0) && (
                    <div data-thread-reach style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                      {phones.map((ch) => (
                        <a key={ch.id} href={`tel:${ch.value.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--text-blue-700)' }}>
                          {ch.value}
                          {ch.optedOutAt ? ' (sent STOP)' : ''}
                        </a>
                      ))}
                      {emails.map((ch) => (
                        <a key={ch.id} href={`mailto:${ch.value}`} style={{ color: 'var(--text-blue-700)' }}>
                          {ch.value}
                        </a>
                      ))}
                    </div>
                  )
                )}
                <div
                  data-thread-status
                  style={{
                    display: 'flex',
                    gap: '0.4rem',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    ...(folded
                      ? { flexWrap: 'nowrap', whiteSpace: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', maskImage: ROW_FADE, WebkitMaskImage: ROW_FADE }
                      : { flexWrap: 'wrap' }),
                  }}
                >
                  {court && <Chip tone={COURT_TONE[court.side]}>{court.word}</Chip>}
                  {slots.statusRow?.(contact)}
                </div>
                {stamps && (
                  <div data-thread-stamps style={{ fontSize: '0.8rem', color: 'var(--text-600)' }}>
                    {stamps.sentences.map((s, i) => (
                      <Fragment key={i}>
                        {i > 0 && ' '}
                        {s.map((p, j) => (p.strong ? <strong key={j}>{p.text}</strong> : <Fragment key={j}>{p.text}</Fragment>))}
                      </Fragment>
                    ))}
                  </div>
                )}
                <JobsRail
                  contact={contact}
                  keys={rail}
                  tiles={view?.tiles ?? {}}
                  filter={jobFilter}
                  onFilter={setJobFilter}
                  onStar={(key) => void run(writes.setDefaultJob(contact.id, key), 'The star did not move.')}
                  onOpenJob={onOpenJob}
                  onRemove={(key) => void removeJob(key)}
                  onAdd={() => setPicker({ kind: 'add' })}
                  onHold={(key) => setTying(key)}
                  strip={folded}
                />
                {tying && (
                  <div role="status" style={{ fontSize: '0.8rem', background: 'var(--bg-blue-tint)', borderRadius: 6, padding: '0.3rem 0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    Press a line to tie it to {view?.tiles[tying]?.num ?? 'the job'}.
                    <button type="button" onClick={() => setTying(null)} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {/* On a phone the side (cut 4's flow) is a row over the lines, so the lines keep the whole width (cut 10). */}
              {phone && slots.side?.(contact)}
              {/* What a cut draws above the lines (the sort card, Who has it) scrolls on its own when it is taller than the room
                  (v2.5570): the lines keep a few rows and the box at the foot stays in the window. */}
              {slots.aboveLines && (
                <div data-thread-above style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto' }}>
                  {slots.aboveLines(contact, { openWho: () => setNaming(true), showContact: (id) => onShowContact?.(id), whoDrawn: setWhoOnCard })}
                </div>
              )}
              <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                <div data-thread-lines style={{ flex: 1, minHeight: '7rem', overflowY: 'auto', padding: '0.75rem 0.9rem', display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
                  {rows.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{jobFilter ? 'No line is tied to this job yet.' : 'No messages with them yet.'}</div>
                  )}
                  {rows.map((r) =>
                    r.kind === 'day' ? (
                      <div key={`day:${r.ymd}`} data-thread-day={r.ymd} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                        {r.label}
                      </div>
                    ) : r.kind === 'event' ? (
                      <EventLine key={r.message.id} message={r.message} time={r.time} />
                    ) : r.kind === 'fold' ? (
                      <AppFoldLine key={r.id} row={r} onToggle={() => toggleFold(r.id)} />
                    ) : (
                      <ThreadLine
                        key={`${r.message.id}:${r.message.contactId}`}
                        message={r.message}
                        tile={r.message.jobId ? view?.tiles[r.message.jobId] : undefined}
                        job={r.job}
                        showAll={showAll}
                        marked={r.message.id === at}
                        tying={tying}
                        body={slots.lineBody?.(r.message, contact) ?? null}
                        under={slots.underLine?.(r.message, contact)}
                        smallPrint={smallPrint.get(r.message.id)}
                        userNames={view?.userNames ?? {}}
                        onOpen={() => setOpenMessageId(r.message.id)}
                        onTie={() => {
                          if (tying) void tie(r.message.id, tying)
                          setTying(null)
                        }}
                        onJob={() =>
                          r.message.jobId && view?.tiles[r.message.jobId]
                            ? setJobFilter((f) => (f === r.message.jobId ? null : r.message.jobId))
                            : phone
                              ? setTieSheetFor(r.message.id)
                              : setPicker({ kind: 'tie', messageId: r.message.id })
                        }
                        onHold={phone ? () => setTieSheetFor(r.message.id) : undefined}
                      />
                    ),
                  )}
                </div>
              </DndContext>
              {slots.aboveBox?.(contact)}
              {slots.box?.(contact)}
            </>
          )}
        </div>
        {contact && !phone && sideShown && slots.side?.(contact, { has: setSideHas })}
        {/* A side with nothing to show, opened by the chevron (spike): it says so in words, in place of a rail. */}
        {contact && !phone && sideShown && sideHas === false && (
          <aside aria-label="Their flow" data-flow-side="empty" style={{ flex: 'none', width: 190, borderLeft: '1px solid var(--border)', background: 'var(--surface)', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
            {noFlowWords(contact.kind) ?? 'Nothing here yet.'}
          </aside>
        )}
        {contact && openMessage && (
          <MessageWindow
            message={openMessage}
            contact={contact}
            tile={openMessage.jobId ? view?.tiles[openMessage.jobId] : undefined}
            first={slots.messageWindowFirst}
            onChangeJob={isSentLine(openMessage) ? undefined : () => setPicker({ kind: 'tie', messageId: openMessage.id })}
            onClose={() => setOpenMessageId(null)}
          />
        )}
        {contact && naming && (
          <WhoIsThisWindow
            contact={contact}
            box={lastWroteTo(allLines)}
            writes={writes}
            onNamed={(id) => {
              setNaming(false)
              if (id !== contact.id) onShowContact?.(id)
            }}
            onClose={() => setNaming(false)}
          />
        )}
        {contact && tieSheetFor && (
          <TieSheet
            contactName={firstName(contact) || contact.name}
            sheet={tieSheetRows(rail, view?.tiles ?? {}, contact.defaultJobId, allLines.find((m) => m.id === tieSheetFor)?.jobId ?? null)}
            onPick={(key) => {
              const messageId = tieSheetFor
              setTieSheetFor(null)
              void tie(messageId, key)
            }}
            onAnother={() => {
              const messageId = tieSheetFor
              setTieSheetFor(null)
              setPicker({ kind: 'tie', messageId })
            }}
            onClose={() => setTieSheetFor(null)}
          />
        )}
        {contact && picker && (
          <JobPickerWindow
            title={picker.kind === 'add' ? `Put a job on ${contact.name}` : 'Tie this line to a job'}
            theirs={rail.map((k) => view?.tiles[k]).filter((t): t is NonNullable<typeof t> => Boolean(t))}
            untie={picker.kind === 'tie'}
            searchJobs={writes.searchJobs}
            onPick={(key) => {
              const p = picker
              setPicker(null)
              if (p.kind === 'add') {
                if (key) void run(writes.addJob(contact.id, key), 'The job was not put on them.')
              } else void tie(p.messageId, key)
            }}
            onClose={() => setPicker(null)}
          />
        )}
        </OpenThreadContext.Provider>
      </div>
    </div>
  )
}

/**
 * *Tie this message to* (cut 10, `phone-mockups.html` screen 1b): a sheet of the person's jobs, the one their new
 * messages land on first, the line's own job marked; *Another job…* opens the job picker, a tied line offers *Untie it*.
 */
function TieSheet({
  contactName,
  sheet,
  onPick,
  onAnother,
  onClose,
}: {
  contactName: string
  sheet: ReturnType<typeof tieSheetRows>
  /** A job's key, or null to untie the line so it sits on the person. */
  onPick: (key: string | null) => void
  onAnother: () => void
  onClose: () => void
}) {
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.9rem', cursor: 'pointer' }
  return (
    <PhoneSheet label="Tie this message to" title="Tie this message to" width={480} dataAttrs={{ 'data-tie-sheet': '' }} onClose={onClose}>
      <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem 1rem 0.9rem', overflowY: 'auto' }}>
        {sheet.rows.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={r.here}
            onClick={() => (r.here ? onClose() : onPick(r.key))}
            style={{ ...row, ...(r.here ? { borderColor: 'var(--text-blue-500)', background: 'var(--bg-blue-tint)' } : null) }}
          >
            {r.star && (
              <span aria-label="their default" style={{ color: 'var(--text-amber-800)' }}>
                ★
              </span>
            )}
            <span style={{ minWidth: 0 }}>
              <strong>{r.num}</strong> {r.name}
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.here ? 'tied here now' : r.words}</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={onAnother} style={row}>
          Another job…
        </button>
        {sheet.untie && (
          <button type="button" onClick={() => onPick(null)} style={{ ...row, color: 'var(--text-red-700)' }}>
            Untie it
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>it stays on {contactName}</span>
          </button>
        )}
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', padding: '0.6rem', fontSize: '0.95rem', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </PhoneSheet>
  )
}
