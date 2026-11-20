/**
 * A field of the document builder (punch list #404): words a person presses and types over, where they are read. The
 * owner's call of 2026-11-19 is that every piece of words on a builder is one. A field is plain text: a paste lands as
 * its words alone, and Enter leaves the field instead of breaking the line.
 *
 * Its mark says where the words come from, and `index.css` draws it: `usual` (the standing words), `own` (changed
 * here and not yet the usual, or not yet published) and `blank` (filled from the job).
 *
 * The words under the caret are the browser's while a person types. React writes them only when the field is not the
 * one being typed in, so a redraw of the page never moves the caret.
 */
import { useEffect, useRef, type CSSProperties, type ClipboardEvent, type KeyboardEvent } from 'react'

export type BuilderFieldMark = 'usual' | 'own' | 'blank'

type Props = {
  text: string
  mark: BuilderFieldMark
  /** What the field is, for a screen reader: *The title*. */
  label: string
  /** False draws the words alone, as someone outside reads them. */
  editing: boolean
  onType: (words: string) => void
  tag?: 'span' | 'b' | 'div'
  style?: CSSProperties
}

export function BuilderField({ text, mark, label, editing, onType, tag = 'span', style }: Props) {
  const Tag = tag
  const el = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = el.current
    if (!node || document.activeElement === node) return
    if (node.textContent !== text) node.textContent = text
  }, [text, editing])

  if (!editing) return <Tag style={style}>{text}</Tag>

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.currentTarget.blur()
  }
  const onPaste = (e: ClipboardEvent<HTMLElement>) => {
    e.preventDefault()
    const words = e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' ')
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    sel.deleteFromDocument()
    sel.getRangeAt(0).insertNode(document.createTextNode(words))
    sel.collapseToEnd()
    onType(e.currentTarget.textContent ?? '')
  }
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        el.current = node
        // The first draw writes the words. After that the effect above does, and only while nobody is typing here.
        if (node && node.textContent === '' && text !== '') node.textContent = text
      }}
      className="documentBuilderField"
      data-mark={mark}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      spellCheck={false}
      onInput={(e) => onType(e.currentTarget.textContent ?? '')}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      style={style}
    />
  )
}
