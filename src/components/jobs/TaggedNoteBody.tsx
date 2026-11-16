import type { CSSProperties } from 'react'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { noteBodyParts, noteTagMark, type NoteTagRow } from '../../lib/jobs/noteTags'

const chipStyle: CSSProperties = {
  display: 'inline-block',
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-800)',
  border: '1px solid var(--border-blue)',
  borderRadius: 999,
  padding: '0 7px',
  fontWeight: 600,
  fontSize: '0.92em',
  whiteSpace: 'nowrap',
}
const myChipStyle: CSSProperties = {
  ...chipStyle,
  background: 'var(--bg-amber-tint)',
  color: 'var(--text-amber-800)',
  border: '1px solid var(--border-amber)',
}

/**
 * A posted note's words with its tags: each tagged name as a chip (amber when it is the reader),
 * then the waiting words. With no tag it is the plain body, so a caller can always use it.
 */
export function TaggedNoteBody({
  body,
  tags,
  postedIso,
  viewerId,
}: {
  body: string
  tags: readonly NoteTagRow[] | undefined
  postedIso: string
  viewerId: string | null
}) {
  if (!tags || tags.length === 0) return <>{body}</>
  const mark = noteTagMark(tags, { viewerId, postedYmd: calendarYmdInAppTzFromIso(postedIso), todayYmd: todayYmdInAppTz() })
  if (!mark) return <>{body}</>
  const parts = noteBodyParts(body, mark.names)
  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : (
          <span key={i} data-note-tag-chip style={mark.mine.includes(p.name) ? myChipStyle : chipStyle}>
            @{p.name}
          </span>
        ),
      )}
      <span
        data-note-tag-words
        style={{
          marginLeft: 6,
          fontSize: '0.6875rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          color: mark.late ? 'var(--text-amber-800)' : mark.waiting ? 'var(--text-muted)' : 'var(--text-green-700)',
        }}
      >
        {mark.words}
      </span>
    </>
  )
}
