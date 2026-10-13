import { blankWords, fillLine, type BlankFills } from '../../../../lib/quickReplies/blanks'
import { qrMarks } from '../../../../lib/quickReplies/kernel'

/** Splits a filled line around its blanks; the pieces at odd places are the blanks. */
const SPLIT = /(\{[a-z ]+\})/

/**
 * Messages R3: a quick reply as it would go, its blanks filled from what the app knows (`fillLine`), and a blank it
 * cannot fill lit so the person sees it before the box will send. The narrowed words are marked as the strip's
 * `Marked` marks them. Shared by the strip, *Find a reply*, the editor's preview and its Phone tab.
 */
export function FilledLine({ text, fills, needle = '' }: { text: string; fills: BlankFills; needle?: string }) {
  const pieces = fillLine(text, fills).text.split(SPLIT)
  return (
    <>
      {pieces.map((piece, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            data-qr-blank={piece.slice(1, -1)}
            title={`${piece}: ${blankWords(piece.slice(1, -1))}. Fill it in the box before it sends.`}
            style={{ background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 3, padding: '0 0.15em' }}
          >
            {piece}
          </span>
        ) : (
          qrMarks(piece, needle).map((p, j) =>
            p.lit ? (
              <mark key={`${i}-${j}`} style={{ background: 'var(--bg-yellow-200)', color: 'inherit', borderRadius: 2 }}>
                {p.text}
              </mark>
            ) : (
              <span key={`${i}-${j}`}>{p.text}</span>
            ),
          )
        ),
      )}
    </>
  )
}
