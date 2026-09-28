import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ModalShell } from './ModalShell'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport660 } from '../../hooks/useNarrowViewport660'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { BidReplyBook } from '../../hooks/useBidReplyBook'
import {
  BID_REPLY_BODY_MAX,
  BID_REPLY_BOOK_READ_LIMIT,
  BID_REPLY_KINDS,
  BID_REPLY_TITLE_MAX,
  EMPTY_BID_REPLY_DRAFT,
  bidReplyByline,
  bidReplyCopyText,
  bidReplyDraftProblem,
  bidReplyEntryToDraft,
  bidReplyKindCounts,
  bidReplyKindLabel,
  bidReplySignOffName,
  canEditBidReply,
  canPostBidReply,
  filterBidReplies,
  splitTrailingSignOff,
  type BidReplyDraft,
  type BidReplyEntry,
  type BidReplyKind,
} from '../../lib/bids/bidReplyBook'

/**
 * Bid Board → Reply book: wording the estimators reuse when they answer a GC.
 *
 * Everyone with the board reads, copies and posts; Edit and Delete are drawn for the person who
 * posted a reply and for devs (the database holds the same rule). A copy is signed by whoever
 * pressed Copy — the author's name is not part of the wording.
 *
 * The board owns the book (`useBidReplyBook`), so the button's count and this window read the
 * same list. Esc peels one layer at a time: the form → the list → closed.
 */

const BUTTON: CSSProperties = { padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap' }
// Saturated action colors stay literal (theme rules).
const PRIMARY_BUTTON: CSSProperties = { ...BUTTON, background: '#2563eb', border: '1px solid #2563eb', color: '#ffffff' }
const SMALL_BUTTON: CSSProperties = { ...BUTTON, padding: '0.2rem 0.65rem', fontSize: '0.8125rem', background: 'transparent', border: '1px solid var(--border)' }
const FIELD: CSSProperties = { width: '100%', padding: '0.5rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.875rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' }
const LABEL: CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, margin: '0.75rem 0 0.25rem' }
const chipStyle = (on: boolean): CSSProperties => ({
  fontSize: '0.8125rem',
  padding: '0.15rem 0.7rem',
  borderRadius: 999,
  cursor: 'pointer',
  border: `1px solid ${on ? 'var(--text-strong)' : 'var(--border-strong)'}`,
  background: on ? 'var(--text-strong)' : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-base)',
})

type Editing = { id: string | null; draft: BidReplyDraft; initial: BidReplyDraft }

export function BidReplyBookModal({ book, onClose }: { book: BidReplyBook; onClose: () => void }) {
  const { user, role, profileName, readOnly } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const narrow = useNarrowViewport660()

  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<BidReplyKind | 'all'>('all')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const viewer = useMemo(() => ({ userId: user?.id ?? null, role, readOnly }), [user?.id, role, readOnly])
  const signName = bidReplySignOffName(profileName)
  const counts = useMemo(() => bidReplyKindCounts(book.entries), [book.entries])
  const shown = useMemo(() => filterBidReplies(book.entries, { query, kind }), [book.entries, query, kind])

  const dirty = editing != null && JSON.stringify(editing.draft) !== JSON.stringify(editing.initial)

  // A confirm in front of this window owns Escape while it is up.
  const confirmingRef = useRef(false)
  async function ask(options: Parameters<typeof confirmDialog>[0]): Promise<boolean> {
    confirmingRef.current = true
    try {
      return await confirmDialog(options)
    } finally {
      confirmingRef.current = false
    }
  }

  async function leaveForm() {
    if (dirty && !(await ask({ title: 'Leave without saving?', message: 'What you typed has not been saved.', confirmLabel: 'Leave', danger: true }))) return
    setEditing(null)
    setProblem(null)
  }

  const escRef = useRef<() => void>(() => {})
  escRef.current = () => {
    if (editing) void leaveForm()
    else onClose()
  }
  useEffect(() => {
    // Capture, and stop it there: the board behind this window folds its open row on any Escape.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || confirmingRef.current) return
      e.stopPropagation()
      escRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  function openForm(entry: BidReplyEntry | null) {
    const draft = entry ? bidReplyEntryToDraft(entry) : { ...EMPTY_BID_REPLY_DRAFT, kind: kind === 'all' ? EMPTY_BID_REPLY_DRAFT.kind : kind }
    setEditing({ id: entry?.id ?? null, draft, initial: draft })
    setProblem(null)
  }

  function patchDraft(patch: Partial<BidReplyDraft>) {
    setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : prev))
    setProblem(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!editing || book.saving) return
    const found = bidReplyDraftProblem(editing.draft)
    if (found) {
      setProblem(found)
      return
    }
    const failed = editing.id ? await book.updateReply(editing.id, editing.draft) : await book.addReply(editing.draft)
    if (failed) {
      setProblem(failed)
      return
    }
    showToast(editing.id ? 'Saved.' : 'Posted to the reply book.', 'success', 4000)
    setEditing(null)
  }

  async function copy(entry: BidReplyEntry) {
    try {
      await navigator.clipboard.writeText(bidReplyCopyText(entry, profileName))
      showToast(entry.sign_with_sender && signName ? `Copied, signed ${signName}. Paste it where you are writing.` : 'Copied. Paste it where you are writing.', 'success', 4000)
    } catch {
      showToast('This browser would not copy it. Select the wording and copy it by hand.', 'error')
    }
  }

  async function remove(entry: BidReplyEntry) {
    if (!(await ask({ title: 'Delete this reply?', message: `"${entry.title}" leaves the book for everyone. It cannot be brought back.`, confirmLabel: 'Delete', danger: true }))) return
    const failed = await book.deleteReply(entry.id)
    if (failed) showToast(failed, 'error')
    else showToast('Deleted.', 'success', 4000)
  }

  const pastedSignOff = editing?.draft.signWithSender ? splitTrailingSignOff(editing.draft.body).signOff : null

  return (
    <ModalShell
      zIndex={1000}
      cardStyle={{ background: 'var(--surface)', padding: narrow ? '1rem' : '1.5rem', borderRadius: 8, maxWidth: 760, width: narrow ? '100%' : '95%', maxHeight: narrow ? '100%' : '85vh', overflow: 'auto', boxSizing: 'border-box' }}
    >
      <div role="dialog" aria-modal="true" aria-label="Reply book">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            {editing ? (
              <button type="button" onClick={() => void leaveForm()} style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}>
                ‹ All replies
              </button>
            ) : (
              <>
                <h3 style={{ margin: 0 }}>Reply book</h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>Wording the team reuses. Copy one, then change what the bid needs.</div>
              </>
            )}
          </div>
          <button type="button" onClick={() => escRef.current()} style={BUTTON}>
            {editing ? 'Cancel' : 'Close'}
          </button>
        </div>

        {editing ? (
          <form onSubmit={(e) => void submit(e)} aria-label={editing.id ? 'Change a reply' : 'Add a reply'}>
            <h3 style={{ margin: '0 0 0.25rem' }}>{editing.id ? 'Change a reply' : 'Add a reply'}</h3>
            <label htmlFor="bid-reply-title" style={LABEL}>
              What is it for?
            </label>
            <input
              id="bid-reply-title"
              type="text"
              value={editing.draft.title}
              maxLength={BID_REPLY_TITLE_MAX}
              placeholder="Declining: too far from the office"
              onChange={(e) => patchDraft({ title: e.target.value })}
              autoFocus
              style={FIELD}
            />
            <div style={LABEL} id="bid-reply-kind-label">
              Kind
            </div>
            <div role="group" aria-labelledby="bid-reply-kind-label" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {BID_REPLY_KINDS.map((k) => (
                <button key={k.key} type="button" aria-pressed={editing.draft.kind === k.key} onClick={() => patchDraft({ kind: k.key })} style={chipStyle(editing.draft.kind === k.key)}>
                  {k.label}
                </button>
              ))}
            </div>
            <label htmlFor="bid-reply-body" style={LABEL}>
              The wording
            </label>
            <textarea
              id="bid-reply-body"
              value={editing.draft.body}
              maxLength={BID_REPLY_BODY_MAX + 200}
              onChange={(e) => patchDraft({ body: e.target.value })}
              style={{ ...FIELD, minHeight: '9rem', resize: 'vertical' }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {pastedSignOff
                ? `Left off when it is saved: "${pastedSignOff}". A copy ends with the name of whoever copies it.`
                : 'Paste it as you sent it. Your name at the end is left off; a copy ends with the name of whoever copies it.'}
            </div>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
              <input type="checkbox" checked={editing.draft.signWithSender} onChange={(e) => patchDraft({ signWithSender: e.target.checked })} />
              <span>End with "Thank you," and the name of whoever copies it</span>
            </label>
            {problem ? (
              <div role="alert" style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-red-tint)', border: '1px solid var(--border-red)', borderRadius: 4, fontSize: '0.8125rem' }}>
                {problem}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => void leaveForm()} style={BUTTON}>
                Cancel
              </button>
              <button type="submit" disabled={book.saving} style={{ ...PRIMARY_BUTTON, opacity: book.saving ? 0.6 : 1 }}>
                {book.saving ? 'Saving…' : editing.id ? 'Save changes' : 'Post to the book'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the replies..."
                aria-label="Search the replies"
                style={{ ...FIELD, flex: '1 1 160px', width: 'auto', minWidth: 0, height: 36, padding: '0 0.6rem' }}
              />
              {canPostBidReply(viewer) ? (
                <button type="button" onClick={() => openForm(null)} style={{ ...PRIMARY_BUTTON, height: 36 }}>
                  + Add a reply
                </button>
              ) : null}
            </div>
            <div role="group" aria-label="Kind of reply" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')} style={chipStyle(kind === 'all')}>
                All {counts.all}
              </button>
              {BID_REPLY_KINDS.map((k) => (
                <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)} style={chipStyle(kind === k.key)}>
                  {k.label} {counts[k.key]}
                </button>
              ))}
            </div>

            {book.loading ? (
              <div role="status" style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Loading the replies…
              </div>
            ) : book.loadError ? (
              <div role="alert" style={{ padding: '0.75rem', background: 'var(--bg-red-tint)', border: '1px solid var(--border-red)', borderRadius: 4, fontSize: '0.875rem' }}>
                {book.loadError}{' '}
                <button type="button" onClick={() => void book.reload()} style={{ ...SMALL_BUTTON, marginLeft: '0.4rem' }}>
                  Try again
                </button>
              </div>
            ) : book.entries.length === 0 ? (
              <div style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                The book is empty. {canPostBidReply(viewer) ? 'Add the first reply: a decline, a follow-up, anything you send more than once.' : ''}
              </div>
            ) : shown.length === 0 ? (
              <div style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Nothing in the book matches. Clear the search, or add the reply you were looking for.
              </div>
            ) : (
              shown.map((entry) => {
                const mine = entry.created_by != null && entry.created_by === viewer.userId
                const editable = canEditBidReply(entry, viewer)
                return (
                  <article
                    key={entry.id}
                    aria-label={entry.title}
                    style={{ border: '1px solid var(--border)', borderLeft: mine ? '3px solid #2563eb' : '1px solid var(--border)', borderRadius: 6, padding: '0.75rem 0.9rem', marginBottom: '0.6rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-strong)', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {entry.title}
                        <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {bidReplyKindLabel(entry.kind)}
                        </span>
                      </div>
                      {narrow ? null : (
                        <button type="button" onClick={() => void copy(entry)} aria-label={`Copy "${entry.title}"`} style={{ ...PRIMARY_BUTTON, padding: '0.25rem 0.8rem', fontSize: '0.8125rem' }}>
                          Copy
                        </button>
                      )}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0.5rem 0', fontSize: '0.875rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.6rem 0.75rem' }}>
                      {entry.body}
                      {entry.sign_with_sender ? (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {'\n\nThank you,'}
                          {signName ? (
                            <>
                              {'\n'}
                              <span title="A copy is signed with your name" style={{ background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 4, padding: '0 5px', fontWeight: 600, color: 'var(--text-base)' }}>
                                {signName}
                              </span>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    {narrow ? (
                      <button type="button" onClick={() => void copy(entry)} aria-label={`Copy "${entry.title}"`} style={{ ...PRIMARY_BUTTON, width: '100%', marginBottom: '0.5rem' }}>
                        Copy
                      </button>
                    ) : null}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>{bidReplyByline(entry, viewer.userId)}</span>
                      {editable ? (
                        <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button type="button" onClick={() => openForm(entry)} aria-label={`Edit "${entry.title}"`} style={SMALL_BUTTON}>
                            Edit
                          </button>
                          <button type="button" onClick={() => void remove(entry)} disabled={book.saving} aria-label={`Delete "${entry.title}"`} style={{ ...SMALL_BUTTON, color: 'var(--text-red-600)' }}>
                            Delete
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </article>
                )
              })
            )}
            {book.atReadLimit ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Showing the newest {BID_REPLY_BOOK_READ_LIMIT.toLocaleString('en-US')} replies. Older ones are not listed.
              </div>
            ) : null}
          </>
        )}
      </div>
    </ModalShell>
  )
}
