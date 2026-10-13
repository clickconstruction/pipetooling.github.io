import type { CSSProperties } from 'react'
import { fileNote, fileOpenHref, filedWords, sizeWords, type FileIcon, type LineFile } from '../../../lib/messages/lineFiles'

/**
 * Messages, cut 6's screens (email in): the files and links on a line, as the mock-up `email-in-mockups.html` draws them
 * (screens 1 to 3, on branch spike/gc-mode). The chips under a line's words, the line a filed paper leaves, and the
 * message window's Attachments with Open. A picture shows its badge, not a thumbnail: a thumbnail would fetch the whole
 * picture for each chip.
 */

const BADGE: Record<FileIcon, { word: string; background: string }> = {
  pdf: { word: 'PDF', background: '#c0392b' },
  image: { word: 'IMG', background: '#2a8f5a' },
  link: { word: '↗', background: '#1f5fbf' },
  file: { word: 'F', background: 'var(--text-slate-500)' },
}

export function FileBadge({ icon }: { icon: FileIcon }) {
  const badge = BADGE[icon]
  return (
    <span
      aria-hidden="true"
      style={{ width: 22, height: 22, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', background: badge.background, flex: 'none' }}
    >
      {badge.word}
    </span>
  )
}

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  maxWidth: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '4px 8px',
  fontSize: '0.75rem',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  cursor: 'pointer',
  textAlign: 'left',
}

/** A line's chips. A press on one opens the message window, where Attachments has Open. */
export function LineFileChips({ files, onOpen }: { files: readonly LineFile[]; onOpen: () => void }) {
  return (
    <div data-line-files style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: '0.45rem' }}>
      {files.map((f) => {
        const size = f.kept === 'link' ? 'a link' : sizeWords(f.size)
        return (
          <button key={f.id} type="button" onClick={onOpen} title={`${f.name}: ${fileNote(f)}. Open the message to open it.`} style={chip}>
            <FileBadge icon={f.icon} />
            <span style={{ overflowWrap: 'anywhere' }}>
              {f.name}
              {size && <span style={{ color: 'var(--text-muted)' }}> · {size}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** "✓ Filed as their certificate · Rosa, Oct 12", once for each paper the office filed from the line. */
export function FiledLines({ files, userNames }: { files: readonly LineFile[]; userNames: Readonly<Record<string, string>> }) {
  // Keyed by the file: two certificates filed from one email by one person on one day read the same.
  const filed = files.flatMap((f) => {
    const words = filedWords(f, userNames)
    return words ? [{ id: f.id, words }] : []
  })
  return (
    <>
      {filed.map(({ id, words }) => (
        <div key={id} data-line-filed style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-green-700)' }}>
          ✓ {words}
        </div>
      ))}
    </>
  )
}

const openLink: CSSProperties = {
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  fontSize: '0.85rem',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  border: '1px solid var(--border-strong)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

/** The message window's Attachments: each file with its size and where it is, and Open where it can be opened. */
export function MessageFiles({ files }: { files: readonly LineFile[] }) {
  return (
    <section data-message-files>
      <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.9rem' }}>Attachments ({files.length})</h3>
      {files.map((f) => {
        const href = fileOpenHref(f)
        const note = [f.kept === 'link' ? '' : sizeWords(f.size), fileNote(f)].filter(Boolean).join(' · ')
        return (
          <div key={f.id} data-message-file={f.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <FileBadge icon={f.icon} />
            <span style={{ flex: 1, minWidth: 180, overflowWrap: 'anywhere' }}>
              {f.name} <span style={{ color: 'var(--text-muted)' }}>· {note}</span>
            </span>
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer" style={openLink} aria-label={`Open ${f.name}`}>
                Open
              </a>
            )}
          </div>
        )
      })}
    </section>
  )
}
