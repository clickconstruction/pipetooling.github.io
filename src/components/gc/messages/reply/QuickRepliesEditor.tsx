import { useCallback, useEffect, useState } from 'react'
import { useToastContext } from '../../../../contexts/ToastContext'
import { useNarrowViewport640 } from '../../../../hooks/useNarrowViewport640'
import {
  EDITOR_WORDS,
  editorCounts,
  editorFoot,
  editorGroups,
  editorRows,
  editorTabs,
  lastChange,
  nameOf,
  qrLineCount,
  qrMine,
  qrTotal,
  type QrEditorTab,
  type QuickReply,
  type QuickReplyTags,
  type QuickReplyVersion,
  type StepsByKind,
} from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { formatDenverCalendarDayShort } from '../../../../utils/dateUtils'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn, input } from '../../gcUi'
import { QuickRepliesEditorAdd } from './QuickRepliesEditorAdd'
import { QuickRepliesEditorLine } from './QuickRepliesEditorLine'
import { Marked } from './QuickRepliesStrip'

/**
 * Messages, cut 3's screens: the quick replies editor (v1.73 to v1.145), opened by the strip's **Edit** and *Find a
 * reply*'s **Edit quick replies**, or on its add row by a narrowed search that found none. Every line the person may
 * read in one table, the team's and their own: the tabs cut it by who a line is for (with Mine, and Removed once a line
 * is removed), the search finds words, and the rows group by who a line is for, then the flow's steps in order, the most
 * used first. A row shows how often the line is used and how much by you, who added it and when, and the last change. A
 * press opens the line in place to change its words and tags, remove it or bring it back, and read its history.
 *
 * It reads the lines and every version when it opens and again after each change, and tells the box (`onChanged`) so
 * the strip reads them too. Every change goes through a function that keeps its version with who and when.
 *
 * The tabs are the kernel's (`editorTabs`), so a tab added there with its own panel (the residential build's **Phone**)
 * joins the row without moving these.
 */
export function QuickRepliesEditor({
  io,
  me,
  steps,
  names,
  contactNames,
  initialAdd,
  onChanged,
  onClose,
}: {
  io: QuickRepliesIo
  me: string
  steps: StepsByKind
  /** Users' names by id, for who added, changed and used a line. */
  names: Readonly<Record<string, string>>
  /** The people the window can name in *last used … on*: the open thread's person. */
  contactNames: Readonly<Record<string, string>>
  /** Words to start the add row with; empty opens the window on its list. */
  initialAdd: string
  onChanged: () => void
  onClose: () => void
}) {
  const { showToast } = useToastContext()
  // On a phone the table keeps Line and Used; who added a line and its last change fold under its words.
  const narrow = useNarrowViewport640()
  const span = narrow ? 2 : 4
  const [lines, setLines] = useState<QuickReply[] | null>(null)
  const [versions, setVersions] = useState<Record<string, QuickReplyVersion[]>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [tab, setTab] = useState<QrEditorTab>('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(initialAdd.trim() ? initialAdd : null)

  const load = useCallback(
    () =>
      Promise.all([io.loadLines(), io.loadVersions()]).then(
        ([read, history]) => {
          setLines(read)
          setVersions(history)
          setProblem(null)
        },
        (e: unknown) => setProblem(formatErrorMessage(e, 'The quick replies did not load.')),
      ),
    [io],
  )

  useEffect(() => {
    void load()
  }, [load])

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

  /** After a change: read the lines and their history again, and tell the strip. */
  const changed = async () => {
    await load()
    onChanged()
  }

  const done = (words?: string, tone: 'success' | 'info' = 'success') => {
    setOpen(null)
    if (words) showToast(words, tone)
  }

  const all = lines ?? []
  const tabs = editorTabs(editorCounts(all, me))
  const rows = editorRows(all, me, tab, search)
  const groups = editorGroups(rows, steps)
  const byId = (id: string) => all.find((q) => q.id === id) ?? null
  const opened = open ? byId(open) : null

  const cell = { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' } as const
  const dim = { ...cell, color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' } as const
  const th = { textAlign: 'left', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-strong)' } as const

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
        aria-label="Quick replies"
        data-qr-editor
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(880px, 100%)', maxHeight: 'min(90vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Quick replies</h2>
          <input
            aria-label="Find a line"
            placeholder={EDITOR_WORDS.search}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOpen(null)
            }}
            style={{ ...input, flex: '1 1 12rem', minWidth: 0 }}
          />
          <Btn kind="primary" onClick={() => setAdding('')} disabled={adding !== null}>
            + Add a line
          </Btn>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div role="tablist" aria-label="Which lines" data-qr-editor-tabs style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', padding: '0.5rem 1rem 0' }}>
          {tabs.map((t) => (
            <button
              key={t.tab}
              type="button"
              role="tab"
              aria-selected={tab === t.tab}
              data-qr-tab={t.tab}
              onClick={() => {
                setTab(t.tab)
                setOpen(null)
              }}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '0.15rem 0.65rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: tab === t.tab ? 'var(--bg-blue-tint)' : 'var(--surface)',
                borderColor: tab === t.tab ? 'var(--border-blue)' : 'var(--border)',
                color: tab === t.tab ? 'var(--text-blue-700)' : 'var(--text-base)',
                fontWeight: tab === t.tab ? 600 : 400,
              }}
            >
              {t.label} · {t.count}
            </button>
          ))}
        </div>

        <div style={{ padding: '0.6rem 1rem', overflow: 'auto', display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
          {adding !== null && (
            <QuickRepliesEditorAdd
              initialText={adding}
              me={me}
              steps={steps}
              onSave={async (text, tags, mine) => {
                await io.add(text, tags, mine)
                await changed()
              }}
              onCancel={(words) => {
                setAdding(null)
                if (words) showToast(words, 'success')
              }}
            />
          )}
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)' }}>
              {problem}
            </div>
          )}
          {!lines && !problem && <div style={{ color: 'var(--text-muted)' }}>Loading the quick replies…</div>}
          {lines && (
            <table data-qr-editor-lines style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Line</th>
                  <th style={{ ...th, textAlign: 'right' }}>Used</th>
                  {!narrow && <th style={th}>Added</th>}
                  {!narrow && <th style={th}>Last change</th>}
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={span} style={{ ...cell, color: 'var(--text-muted)' }}>
                      {EDITOR_WORDS.empty(search)}
                    </td>
                  </tr>
                )}
                {groups.map((g) => [
                  <tr key={`g-${g.for}-${g.stepId ?? ''}`} data-qr-editor-group={`${g.for}:${g.stepId ?? ''}`}>
                    <td colSpan={span} style={{ padding: '0.6rem 0.5rem 0.25rem', fontSize: '0.8rem' }}>
                      <strong>{g.title[0]}</strong>
                      {g.title.slice(1).map((t) => (
                        <span key={t} style={{ color: t === 'no step' ? 'var(--text-muted)' : 'var(--text-600)' }}>
                          {' · '}
                          {t}
                        </span>
                      ))}
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{qrLineCount(g.rows.length)}</span>
                    </td>
                  </tr>,
                  ...g.rows.map((q) => {
                    const last = lastChange(versions[q.id] ?? [])
                    return [
                      <tr key={q.id} data-qr-editor-row={q.id} style={{ background: open === q.id ? 'var(--bg-subtle)' : undefined, opacity: q.removed ? 0.75 : 1 }}>
                        <td style={cell}>
                          <button
                            type="button"
                            aria-expanded={open === q.id}
                            onClick={() => setOpen(open === q.id ? null : q.id)}
                            style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                          >
                            <Marked text={q.text} needle={search} />
                          </button>
                          {q.scope === 'mine' && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>mine</span>}
                          {narrow && (
                            <div data-qr-editor-byline style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              added by {nameOf(names, q.addedBy)} · {formatDenverCalendarDayShort(q.addedAt)}
                              {last && ` · changed by ${nameOf(names, last.by)} · ${formatDenverCalendarDayShort(last.at)}`}
                            </div>
                          )}
                        </td>
                        <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {qrTotal(q)}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{qrMine(q, me)} by you</div>
                        </td>
                        {!narrow && (
                          <td style={dim}>
                            {nameOf(names, q.addedBy)} · {formatDenverCalendarDayShort(q.addedAt)}
                          </td>
                        )}
                        {!narrow && <td style={dim}>{last ? `${nameOf(names, last.by)} · ${formatDenverCalendarDayShort(last.at)}` : '—'}</td>}
                      </tr>,
                      open === q.id && opened ? (
                        <tr key={`${q.id}-open`}>
                          <td colSpan={span} style={{ padding: '0.3rem 0 0.6rem' }}>
                            <QuickRepliesEditorLine
                              line={opened}
                              versions={versions[q.id] ?? []}
                              me={me}
                              steps={steps}
                              names={names}
                              contactNames={contactNames}
                              onSave={async (text: string, tags: QuickReplyTags) => {
                                await io.edit(q.id, text, tags)
                                await changed()
                              }}
                              onRemove={async () => {
                                await io.remove(q.id)
                                await changed()
                              }}
                              onRestore={async () => {
                                await io.restore(q.id)
                                await changed()
                                setTab('all')
                              }}
                              onClose={done}
                            />
                          </td>
                        </tr>
                      ) : null,
                    ]
                  }),
                ])}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span data-qr-editor-foot style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {editorFoot(rows.length, search).join(' · ')}.
          </span>
          <span style={{ flex: 1 }} />
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  )
}
