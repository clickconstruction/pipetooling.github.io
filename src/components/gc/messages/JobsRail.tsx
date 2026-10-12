import { useDraggable } from '@dnd-kit/core'
import { useLongPress } from '../../../hooks/useLongPress'
import type { Contact } from '../../../lib/contacts/kernel'
import type { JobTile } from '../../../lib/messages/jobTiles'

const TONE_COLOR: Record<JobTile['day']['tone'], string> = {
  '': 'var(--text-muted)',
  soon: 'var(--text-amber-800)',
  today: 'var(--text-red-700)',
  past: 'var(--text-red-700)',
}

/**
 * Messages, cut 1's screens: the person's jobs as tiles (the prototype's jobs rail, v1.166's last header row). Each
 * tile: the star (where new messages from them land), the job's number and name (a press shows only its lines), ⧉ to
 * open the job, × to take a job the office tied off the person. Drag a tile onto a line to tie that line; on a phone,
 * press and hold a tile, then press the line.
 */
export function JobsRail({
  contact,
  keys,
  tiles,
  filter,
  onFilter,
  onStar,
  onOpenJob,
  onRemove,
  onAdd,
  onHold,
}: {
  contact: Contact
  /** The rail's jobs: the office's ties, then the facts'. */
  keys: readonly string[]
  tiles: Readonly<Record<string, JobTile>>
  filter: string | null
  onFilter: (key: string | null) => void
  onStar: (key: string) => void
  onOpenJob?: (key: string) => void
  onRemove: (key: string) => void
  onAdd: () => void
  onHold: (key: string) => void
}) {
  return (
    <div data-jobs-rail style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span title="The jobs they are on. The star is where a new message from them lands." style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Their jobs
      </span>
      {keys.map((key) => {
        const tile = tiles[key]
        return tile ? (
          <RailTile
            key={key}
            tile={tile}
            starred={contact.defaultJobId === key}
            tied={contact.jobIds.includes(key)}
            on={filter === key}
            onFilter={() => onFilter(filter === key ? null : key)}
            onStar={() => onStar(key)}
            onOpen={onOpenJob ? () => onOpenJob(key) : undefined}
            onRemove={() => onRemove(key)}
            onHold={() => onHold(key)}
          />
        ) : null
      })}
      <button type="button" onClick={onAdd} style={{ border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'transparent', padding: '0.25rem 0.55rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-600)' }}>
        + add a job
      </button>
      {filter && (
        <button type="button" onClick={() => onFilter(null)} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', fontSize: '0.8rem', cursor: 'pointer' }}>
          show all
        </button>
      )}
    </div>
  )
}

function RailTile({
  tile,
  starred,
  tied,
  on,
  onFilter,
  onStar,
  onOpen,
  onRemove,
  onHold,
}: {
  tile: JobTile
  starred: boolean
  tied: boolean
  on: boolean
  onFilter: () => void
  onStar: () => void
  onOpen?: () => void
  onRemove: () => void
  onHold: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `job:${tile.key}`, data: { jobKey: tile.key } })
  const hold = useLongPress(onHold)
  // A drag and a press and hold both start on the same pointer: each gets every event.
  const both = Object.fromEntries(
    [...new Set([...Object.keys(listeners ?? {}), ...Object.keys(hold.handlers)])].map((name) => [
      name,
      (e: unknown) => {
        ;(listeners as Record<string, ((e: unknown) => void) | undefined> | undefined)?.[name]?.(e)
        ;(hold.handlers as unknown as Record<string, ((e: unknown) => void) | undefined>)[name]?.(e)
      },
    ]),
  )
  return (
    <span
      ref={setNodeRef}
      data-job-tile={tile.key}
      {...attributes}
      {...both}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '0.1rem',
        border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border)'}`,
        background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
        borderRadius: 8,
        padding: '0.25rem 0.5rem',
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        cursor: 'grab',
      }}
    >
      <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8rem' }}>
        <button
          type="button"
          aria-pressed={starred}
          aria-label={starred ? `New messages land on ${tile.num}` : `Make ${tile.num} the job new messages land on`}
          title={starred ? 'New messages land here' : 'Make this the job new messages land on'}
          onClick={(e) => {
            e.stopPropagation()
            if (!starred) onStar()
          }}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: starred ? 'default' : 'pointer', color: starred ? 'var(--text-amber-800)' : 'var(--text-muted)' }}
        >
          {starred ? '★' : '☆'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            if (hold.consumeLongPress()) return
            e.stopPropagation()
            onFilter()
          }}
          title={on ? 'Show every line again' : 'Show only the lines tied to this job'}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-base)', fontSize: '0.8rem' }}
        >
          <strong>{tile.num}</strong> {tile.name}
        </button>
        {onOpen && (
          <button type="button" aria-label={`Open ${tile.num}`} title="Open this job" onClick={(e) => (e.stopPropagation(), onOpen())} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}>
            ⧉
          </button>
        )}
        {tied && (
          <button
            type="button"
            aria-label={`Take ${tile.num} off them`}
            title="Take this job off them. The lines tied to it keep their tie."
            onClick={(e) => (e.stopPropagation(), onRemove())}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        )}
      </span>
      <span style={{ fontSize: '0.72rem', color: TONE_COLOR[tile.day.tone] }}>{tile.day.words}</span>
    </span>
  )
}
