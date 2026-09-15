/**
 * The sheet strip (Submittals stage 3a): every vendor PDF dropped on the
 * revision as a row of page thumbnails. Tap a page, then the row it belongs
 * to, and the page joins that row's sheet; tap a page's chip to take it off;
 * a page on two rows reads red. The footer counts the pages on rows, and
 * **Done with this file** (or **Remove this file** when nothing landed) lets
 * the rest go — the host trims the PDF and rewrites the rows' page numbers.
 * Presentational: the host owns the data and writes.
 */
import { useMemo, useState, type CSSProperties } from 'react'

import { conflicts, describeFooter, keptPages, tagsWithoutSheets } from '../../lib/submittals/sheetAssignment'
import { formatShortDate, needsSheet, type SourceFile, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import { assignmentsFromItems, itemLabel } from '../../lib/submittals/sheetStripModel'

export type ThumbState = string[] | 'loading' | 'error' | undefined

const btn: CSSProperties = { padding: '0.3rem 0.7rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 500 }
const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

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
}) {
  const [picked, setPicked] = useState<{ fileIndex: number; page: number } | null>(null)
  const state = useMemo(() => assignmentsFromItems(items), [items])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const clash = useMemo(() => conflicts(state), [state])
  const owing = useMemo(() => tagsWithoutSheets(items.filter((i) => needsSheet(i)).map((i) => i.id), state), [items, state])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} data-testid="sheet-strip">
      {files.map((f, fileIndex) => {
        const thumbs = thumbnails[f.path]
        const kept = keptPages(state, fileIndex)
        const fileClash = clash.filter((c) => c.fileIndex === fileIndex)
        const pageItems = (page: number) => state.filter((a) => a.fileIndex === fileIndex && a.page === page).map((a) => a.tag)
        const trimmed = f.trimmedAt != null
        return (
          <div key={f.path} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="sheet-file">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
                <b>{f.name}</b> <span style={smallMuted}>· {f.pages} page{f.pages === 1 ? '' : 's'}{f.houseName ? ` · ${f.houseName}` : ''}{trimmed ? ' · trimmed' : ''}</span>
              </span>
              {thumbs === undefined || thumbs === 'error' ? (
                <button type="button" onClick={() => onNeedThumbnails(fileIndex)} style={btn}>
                  {thumbs === 'error' ? 'Try the pages again' : 'Show the pages'}
                </button>
              ) : null}
            </div>

            {thumbs === 'loading' ? <span style={smallMuted}>Drawing the pages…</span> : null}

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
                        {ids.length === 0 ? (
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

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.45rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }} data-testid="strip-footer">
                {describeFooter(state, fileIndex, f.pages)}
                {trimmed ? <span style={smallMuted}> · {f.droppedPages ?? 0} page{(f.droppedPages ?? 0) === 1 ? '' : 's'} let go · {formatShortDate(f.trimmedAt)} · drop the file again if you need one</span> : null}
              </span>
              {!trimmed ? (
                kept.length === 0 ? (
                  <button type="button" disabled={busy} onClick={() => onRemove(fileIndex)} style={{ ...btn, color: 'var(--text-red-700)' }} title="Nothing from this file is on a row">
                    Remove this file
                  </button>
                ) : (
                  <button type="button" disabled={busy || fileClash.length > 0} onClick={() => onDone(fileIndex)} style={btn} title={fileClash.length > 0 ? 'Settle the pages on two rows first' : `Keep the ${kept.length} page${kept.length === 1 ? '' : 's'} on rows and let the rest go`}>
                    Done with this file
                  </button>
                )
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
