import type { CSSProperties } from 'react'

/**
 * ☎ An owner is calling (v2.3854; the search inside it retired in v2.4731, the owner's ask:
 * *separate the search from the practice call area*): the door on the Lien desk header for
 * whoever answers the phone. It opens the words — `LienCallScriptModal` — filled with the job
 * under the reader. Finding the job is the list's find box (v2.4721), which reaches every notice
 * the desk ever sent.
 */
export function LienCallerDoor({ onOpen, open = false, style, buttonStyle }: { onOpen: () => void; open?: boolean; style?: CSSProperties; buttonStyle?: CSSProperties }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', ...style }} data-lien-caller-door>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="An owner is calling"
        title="An owner is calling — what to say, filled with the job under you; find the job with the box on the list"
        style={{ padding: '2px 10px', borderRadius: 7, border: '1px solid transparent', background: open ? 'var(--text-blue-800)' : 'var(--text-link)', color: '#fff', font: 'inherit', fontSize: '0.85rem', lineHeight: '1.25rem', cursor: 'pointer', ...buttonStyle }}
      >
        ☎
      </button>
    </span>
  )
}
