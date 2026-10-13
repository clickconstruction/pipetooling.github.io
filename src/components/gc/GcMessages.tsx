import { useMemo, useState } from 'react'
import { initials, type ContactKind } from '../../lib/contacts/kernel'
import {
  LIST_FILTERS,
  listRows,
  type ListFilter,
} from '../../lib/messages/listRows'
import type { MessagesView } from '../../lib/messages/messagesIo'
import { Card, Chip, input, type Tone } from './gcUi'

const FOLD_KEY = 'gcMessagesListFolded'
const readFolded = (): boolean => {
  try {
    return window.localStorage.getItem(FOLD_KEY) === '1'
  } catch {
    return false
  }
}
const writeFolded = (folded: boolean) => {
  try {
    window.localStorage.setItem(FOLD_KEY, folded ? '1' : '0')
  } catch {
    // A browser that keeps nothing still folds for this visit.
  }
}

const COURT_TONE: Record<'ours' | 'theirs' | 'none', Tone> = {
  ours: 'amber',
  theirs: 'green',
  none: 'grey',
}
const FACE: Record<ContactKind, string> = {
  customer: 'var(--bg-green-100)',
  trade: 'var(--bg-blue-200)',
  arch: 'var(--bg-violet-100)',
  lead: 'var(--bg-muted)',
  supply_house: 'var(--bg-muted)',
  candidate: 'var(--bg-muted)',
  sub: 'var(--bg-muted)',
  unknown: 'var(--bg-muted)',
}

/**
 * Messages on GC projects (cut 1): every person the office talks with, one row each, newest conversation first. A row
 * reads who and when, their company with whose move it is, and the last line. All · Customers · Trades · Who is this?
 * narrow it; the search runs over names, companies, numbers, addresses and every line's words. The list folds to a
 * rail of faces, remembered in this browser. A row opens the person's thread as a window over the page.
 */
export function GcMessages({
  view,
  problem,
  nowIso,
  onOpenThread,
}: {
  view: MessagesView | null
  problem: string | null
  nowIso: string
  onOpenThread: (contactId: string) => void
}) {
  const [filter, setFilter] = useState<ListFilter>('all')
  const [search, setSearch] = useState('')
  const [folded, setFolded] = useState(readFolded)
  const rows = useMemo(
    () =>
      view
        ? listRows(view.contacts, view.messages, { filter, search, nowIso })
        : [],
    [view, filter, search, nowIso],
  )
  const fold = (next: boolean) => {
    setFolded(next)
    writeFolded(next)
  }

  if (!view) {
    return problem ? (
      <div
        role="alert"
        style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}
      >
        {problem}
      </div>
    ) : (
      <div style={{ fontSize: '0.875rem' }}>Loading the messages…</div>
    )
  }

  if (folded) {
    return (
      <Card style={{ padding: '0.5rem' }}>
        <div
          data-messages-rail
          style={{
            display: 'flex',
            gap: '0.4rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => fold(false)}
            aria-label="Show the list"
            title="Opens the people list again. Your choice is kept in this browser."
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
            }}
          >
            ›
          </button>
          {rows.map((r) => (
            <button
              key={r.contact.id}
              type="button"
              onClick={() => onOpenThread(r.contact.id)}
              aria-label={`${r.contact.name}, ${r.sub}, ${r.court.word}`}
              title={`${r.contact.name} · ${r.sub} · ${r.court.word}`}
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: 'none',
                background: FACE[r.contact.kind],
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                color: 'var(--text-600)',
              }}
            >
              {initials(r.contact)}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  border: '2px solid var(--surface)',
                  background:
                    r.court.side === 'ours'
                      ? 'var(--text-amber-800)'
                      : r.court.side === 'theirs'
                        ? 'var(--text-green-700)'
                        : 'var(--border-strong)',
                }}
              />
            </button>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card style={{ padding: 0 }}>
      <div
        style={{
          padding: '0.6rem 0.75rem',
          display: 'grid',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people, companies, numbers and words"
            aria-label="Search the messages"
            style={{ ...input, flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => fold(true)}
            aria-label="Hide the list"
            title="Folds the list to a rail of faces. Your choice is kept in this browser."
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
            }}
          >
            ‹
          </button>
        </div>
        <div
          role="group"
          aria-label="Who to show"
          style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}
        >
          {LIST_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '0.2rem 0.65rem',
                borderRadius: 999,
                border: `1px solid ${filter === f.key ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                background:
                  filter === f.key ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color:
                  filter === f.key ? 'var(--text-blue-500)' : 'var(--text-600)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div
          style={{
            padding: '0.9rem',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
          }}
        >
          {search || filter !== 'all'
            ? 'Nothing matches.'
            : 'Nobody to show yet.'}
        </div>
      ) : (
        <div role="list" data-messages-list>
          {rows.map((r) => (
            <div key={r.contact.id} role="listitem">
              <button
                type="button"
                data-messages-row={r.contact.id}
                onClick={() => onOpenThread(r.contact.id)}
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'transparent',
                  padding: '0.55rem 0.75rem',
                  cursor: 'pointer',
                  color: 'var(--text-base)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: FACE[r.contact.kind],
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    flex: 'none',
                    color: 'var(--text-600)',
                  }}
                >
                  {initials(r.contact)}
                </span>
                <span
                  style={{
                    display: 'grid',
                    gap: '0.1rem',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span style={{ display: 'flex', gap: '0.5rem' }}>
                    <strong
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.contact.name}
                    </strong>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.when}
                    </span>
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      gap: '0.4rem',
                      alignItems: 'center',
                      fontSize: '0.8rem',
                      color: 'var(--text-600)',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.sub}
                    </span>
                    <span style={{ marginLeft: 'auto' }}>
                      <Chip tone={COURT_TONE[r.court.side]} small>
                        {r.court.word}
                      </Chip>
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.lastLine ? (
                      <>
                        <strong>{r.lastLine.channel}</strong> {r.lastLine.words}
                      </>
                    ) : (
                      'No messages yet.'
                    )}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
