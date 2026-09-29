/**
 * The vendor files (Submittals stage 3a; one line per file since v2.4171): every PDF
 * dropped on the revision as a row of a list — an arrow that folds its pages out, the
 * name and page count and house, where it stands (the pages on rows in words and as a
 * bar; a clash in red; the hint that a file may not be a submittal at all), and the
 * actions in weight order: Assign pages…, Done with this file once something is on rows,
 * Remove quiet and last. The fold keeps the tap-a-page path: tap a page, then the row it
 * belongs to, and the page joins that row's sheet; tap a page's chip to take it off; a
 * page on two rows reads red. Presentational: the host owns the data and writes.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { RobotOffer } from './RobotOffer'
import type { RobotSeatState } from '../../lib/submittals/robotOffer'

import { conflicts, describeFooter, keptPages, tagsWithoutSheets } from '../../lib/submittals/sheetAssignment'
import { needsSheet, type SourceFile, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import { assignmentsFromItems, fileStanding, itemLabel } from '../../lib/submittals/sheetStripModel'

export type ThumbState = string[] | 'loading' | 'error' | undefined

const btn: CSSProperties = { padding: '0.3rem 0.7rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap' }
const btnLink: CSSProperties = { ...btn, background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)', padding: '0.3rem 0.4rem' }
const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

const TONE_COLOR: Record<ReturnType<typeof fileStanding>['tone'], string> = { none: 'var(--border-strong)', some: '#16a34a', all: '#16a34a', clash: '#d97706', odd: 'var(--border-strong)' }

export function SubmittalSheetStrip({
  files,
  items,
  thumbnails,
  busy,
  onNeedThumbnails,
  onAssign,
  onUnassign,
  onDone,
  onRemove,
  guesses,
  robotLines,
  confirmLabels,
  onAskRobot,
  robotSeat,
  onConfirmGuesses,
  onAssignPages,
}: {
  files: SourceFile[]
  items: SubmittalItemRow[]
  /** Keyed by the file's bucket path. */
  thumbnails: Record<string, ThumbState>
  busy: boolean
  onNeedThumbnails: (fileIndex: number) => void
  onAssign: (fileIndex: number, page: number, itemId: string) => void
  onUnassign: (fileIndex: number, page: number, itemId: string) => void
  onDone: (fileIndex: number) => void
  onRemove: (fileIndex: number) => void
  /** 6b · the robot's page guesses per file (page → tag, sure?), drawn as dashed chips until confirmed or tapped. */
  guesses?: Record<number, Map<number, { tag: string; sure: boolean }>>
  /** 6b · the robot task's line per file ("robot · split the file by tag · ready · 14 pages matched…"). */
  robotLines?: Record<number, string>
  /** 6b · "Confirm 14 · pick 2" per file when a result waits. */
  confirmLabels?: Record<number, string>
  onAskRobot?: (fileIndex: number) => void
  /** v2.4136 · the offer draws only while a seat is live; without it no offer is drawn at all. */
  robotSeat?: RobotSeatState
  onConfirmGuesses?: (fileIndex: number) => void
  /** v2.4143 · opens the Assign pages walk for the file. */
  onAssignPages?: (fileIndex: number) => void
}) {
  const [picked, setPicked] = useState<{ fileIndex: number; page: number } | null>(null)
  /** Folds the user opened or closed by hand; a file whose pages are already drawn starts open. */
  const [folds, setFolds] = useState<Record<number, boolean>>({})
  const state = useMemo(() => assignmentsFromItems(items), [items])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const clash = useMemo(() => conflicts(state), [state])
  const owing = useMemo(() => tagsWithoutSheets(items.filter((i) => needsSheet(i)).map((i) => i.id), state), [items, state])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }} data-testid="sheet-strip">
      {files.map((f, fileIndex) => {
        const thumbs = thumbnails[f.path]
        const kept = keptPages(state, fileIndex)
        const fileClash = clash.filter((c) => c.fileIndex === fileIndex)
        const pageItems = (page: number) => state.filter((a) => a.fileIndex === fileIndex && a.page === page).map((a) => a.tag)
        const trimmed = f.trimmedAt != null
        const standing = fileStanding(f, state, fileIndex, fileClash.length)
        const open = folds[fileIndex] ?? Array.isArray(thumbs)
        const toggle = () => {
          const next = !open
          setFolds((s) => ({ ...s, [fileIndex]: next }))
          if (next && (thumbs === undefined || thumbs === 'error')) onNeedThumbnails(fileIndex)
        }
        return (
          <div key={f.path} style={{ borderBottom: fileIndex < files.length - 1 ? '1px solid var(--border)' : 'none' }} data-testid="sheet-file">
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(180px, 1.3fr) minmax(160px, 1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.45rem 0.6rem' }} data-testid="file-row">
              <button type="button" onClick={toggle} aria-expanded={open} aria-label={open ? 'Hide the pages' : 'Show the pages'} title={open ? 'Hide the pages' : 'Show the pages'} style={{ ...btnLink, padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} data-testid="toggle-pages">
                {open ? '▾' : '▸'}
              </button>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b>{f.name}</b> <span style={smallMuted}>· {f.pages} page{f.pages === 1 ? '' : 's'}{f.houseName ? ` · ${f.houseName}` : ''}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, ...smallMuted }} data-testid="file-standing">
                <span aria-hidden="true" style={{ width: 72, height: 5, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden', flex: 'none' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.round(standing.ratio * 100)}%`, background: TONE_COLOR[standing.tone] }} />
                </span>
                <span style={{ color: standing.tone === 'clash' ? 'var(--text-amber-700)' : undefined }}>{standing.text}</span>
                {standing.hint ? <span style={{ color: 'var(--text-amber-700)' }} data-testid="file-hint">· {standing.hint}</span> : null}
                {robotLines?.[fileIndex] ? <span style={{ fontStyle: 'italic' }} data-testid="robot-line">· {robotLines[fileIndex]}</span> : null}
              </span>
              <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                {confirmLabels?.[fileIndex] && onConfirmGuesses ? (
                  <button type="button" disabled={busy} onClick={() => onConfirmGuesses(fileIndex)} style={{ ...btn, background: '#16a34a', borderColor: '#16a34a', color: 'white', fontWeight: 600 }} data-testid="confirm-guesses">
                    {confirmLabels[fileIndex]}
                  </button>
                ) : null}
                {onAssignPages ? (
                  <button type="button" disabled={busy} onClick={() => onAssignPages(fileIndex)} style={{ ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }} title="Walk every page at reading size and put each on its row — the answer pre-filled where the page names a model" data-testid="assign-pages-open">
                    Assign pages…
                  </button>
                ) : null}
                {!trimmed && kept.length > 0 ? (
                  <button type="button" disabled={busy || fileClash.length > 0} onClick={() => onDone(fileIndex)} style={{ ...btnLink, textDecoration: 'underline', textUnderlineOffset: 3 }} title={fileClash.length > 0 ? 'Settle the pages on two rows first' : `Keep the ${kept.length} page${kept.length === 1 ? '' : 's'} on rows and let the rest go`}>
                    Done with this file
                  </button>
                ) : null}
                {!trimmed ? (
                  <button type="button" disabled={busy} onClick={() => onRemove(fileIndex)} style={{ ...btnLink, color: 'var(--text-red-700)' }} title={kept.length > 0 ? 'The file leaves the revision; its pages come off the rows' : 'Nothing from this file is on a row'}>
                    Remove
                  </button>
                ) : null}
              </span>
            </div>

            {open ? (
              <div style={{ padding: '0.4rem 0.6rem 0.6rem 2rem', background: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="file-fold">
                {thumbs === 'loading' ? <span style={smallMuted}>Drawing the pages…</span> : null}
                {thumbs === 'error' ? (
                  <span style={smallMuted}>
                    Could not draw the pages.{' '}
                    <button type="button" onClick={() => onNeedThumbnails(fileIndex)} style={{ ...btnLink, padding: 0, textDecoration: 'underline' }}>Try again</button>
                  </span>
                ) : null}

                {Array.isArray(thumbs) ? (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }} data-testid="page-strip">
                    {thumbs.map((src, i) => {
                      const page = i + 1
                      const ids = pageItems(page)
                      const isPicked = picked?.fileIndex === fileIndex && picked.page === page
                      const isClash = ids.length > 1
                      const border = isClash ? '2px solid #dc2626' : isPicked ? '2px solid #2563eb' : ids.length > 0 ? '2px solid #16a34a' : '1px solid var(--border)'
                      return (
                        <div key={page} style={{ width: 76 }}>
                          <button
                            type="button"
                            aria-label={`Page ${page}`}
                            aria-pressed={isPicked}
                            disabled={busy}
                            onClick={() => setPicked(isPicked ? null : { fileIndex, page })}
                            style={{ display: 'block', width: 76, padding: 0, border, borderRadius: 4, background: isPicked ? 'var(--bg-blue-tint)' : 'var(--surface)', cursor: 'pointer', overflow: 'hidden' }}
                          >
                            <img src={src} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
                          </button>
                          <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 2 }}>
                            <b>{page}</b>{' '}
                            {ids.length === 0 && guesses?.[fileIndex]?.get(page) ? (() => {
                              const g = guesses[fileIndex]!.get(page)!
                              const target = items.find((it) => it.tag.trim().toUpperCase() === g.tag)
                              return (
                                <button type="button" disabled={busy || !target} title={target ? `The robot's guess${g.sure ? '' : ' (unsure)'} — tap to put this page on ${g.tag}` : `${g.tag} is not a row on this revision`} onClick={() => { if (target) onAssign(fileIndex, page, target.id) }} style={{ background: 'transparent', color: g.sure ? 'var(--text-green-700)' : 'var(--text-amber-700)', border: `1px dashed ${g.sure ? '#16a34a' : '#d97706'}`, borderRadius: 999, padding: '0 6px', font: 'inherit', fontSize: '0.66rem', cursor: target ? 'pointer' : 'not-allowed' }} data-testid="guess-chip">
                                  {g.tag}{g.sure ? '' : '?'}
                                </button>
                              )
                            })() : ids.length === 0 ? (
                              <span style={{ color: 'var(--text-faint)' }}>—</span>
                            ) : isClash ? (
                              <span style={{ color: 'var(--text-red-700)', fontWeight: 700 }}>{ids.length} rows</span>
                            ) : (
                              ids.map((id) => (
                                <button key={id} type="button" title="Take this page off the row" onClick={() => onUnassign(fileIndex, page, id)} style={{ background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', border: 'none', borderRadius: 999, padding: '0 0.35rem', font: 'inherit', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                                  {byId.get(id) ? itemLabel(byId.get(id) as SubmittalItemRow) : '?'} ×
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {picked && picked.fileIndex === fileIndex ? (
                  <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 6, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }} data-testid="row-chooser">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-strong)', fontWeight: 600 }}>Page {picked.page} · which row?</span>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {[...items.filter((i) => owing.includes(i.id)), ...items.filter((i) => !owing.includes(i.id) && needsSheet(i) === false && i.status !== 'missing')].map((it) => {
                        const owes = owing.includes(it.id)
                        return (
                          <button key={it.id} type="button" disabled={busy} onClick={() => { onAssign(fileIndex, picked.page, it.id); setPicked(null) }} style={{ ...btn, borderRadius: 999, background: owes ? 'var(--bg-yellow-tint)' : 'var(--surface)', color: owes ? 'var(--text-amber-700)' : 'var(--text-strong)', fontWeight: owes ? 700 : 500 }}>
                            {itemLabel(it)}
                            {owes ? ' · sheet needed' : ''}
                          </button>
                        )
                      })}
                      <button type="button" onClick={() => setPicked(null)} style={{ ...btn, borderRadius: 999, color: 'var(--text-muted)' }}>
                        Not now
                      </button>
                    </div>
                  </div>
                ) : null}

                {fileClash.length > 0 ? (
                  <div style={{ border: '1px solid #fecaca', background: 'var(--bg-red-tint)', borderRadius: 6, padding: '0.45rem 0.6rem', fontSize: '0.78rem', color: 'var(--text-red-700)' }} data-testid="conflicts">
                    {fileClash.map((c) => (
                      <div key={c.page}>
                        <b>Page {c.page} is on {c.tags.length} rows</b> — a page prints under one tag only. Keep it for:{' '}
                        {c.tags.map((id) => (
                          <button key={id} type="button" onClick={() => { for (const other of c.tags) if (other !== id) onUnassign(fileIndex, c.page, other) }} style={{ ...btn, padding: '0.1rem 0.5rem', fontSize: '0.72rem', marginRight: 4 }}>
                            {byId.get(id) ? itemLabel(byId.get(id) as SubmittalItemRow) : '?'}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', ...smallMuted }}>
                  <span data-testid="strip-footer">
                    {describeFooter(state, fileIndex, f.pages)}
                    {trimmed ? ` · ${f.droppedPages ?? 0} page${(f.droppedPages ?? 0) === 1 ? '' : 's'} let go · drop the file again if you need one` : ' · tap a page, then the row it belongs to'}
                  </span>
                  {onAskRobot && robotSeat && !trimmed && !robotLines?.[fileIndex] ? <RobotOffer kind="file_cut_sheets" seat={robotSeat} busy={busy} onAsk={() => onAskRobot(fileIndex)} testId={`ask-robot-split-${fileIndex}`} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
