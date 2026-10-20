import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { openHtmlPrintWindow } from '../../../lib/jobsDocuments/printWindow'
import { runJobShare } from '../../../lib/jobShare'
import type { Contact } from '../../../lib/contacts/kernel'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { isSentLine } from '../../../lib/messages/sentLines'
import { photoTickJob } from '../../../lib/photos/photoTick'
import { callLength, channelWord, fullWhen, type ThreadMessage } from '../../../lib/messages/thread'
import { PhoneSheet } from '../../PhoneSheet'
import { Btn } from '../gcUi'
import { MessageFiles } from './LineFiles'

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch)

/**
 * Messages, cut 1's screens: one message in full, as a window over its thread (the prototype's `openMessage`, v1.159).
 * Its facts (who, when, through what, its job), an email's Attachments with Open (cut 6) and the job's tick to save
 * every photo to Drive (cut 10), its whole words, and its
 * tools: a later cut's first slot (cut 2's
 * highlight, which reads Remove or Highlight by the selection), Copy, Print or save as PDF, and Share. It is drawn
 * inside the thread window's panel, so a press on its backdrop never reaches the thread's. A sheet from the bottom on a
 * phone (`PhoneSheet`, cut 10).
 */
export function MessageWindow({
  message,
  contact,
  tile,
  first,
  onChangeJob,
  onClose,
}: {
  message: ThreadMessage
  contact: Contact
  tile: JobTile | undefined
  /** The first tool, given the words selected in the full text: cut 2's highlight slot. */
  first?: (m: ThreadMessage, selection: string) => ReactNode
  /** Tie the line to another job, or untie it. Absent for a sent copy, which keeps its own. */
  onChangeJob?: () => void
  onClose: () => void
}) {
  const { showToast } = useToastContext()
  const fullRef = useRef<HTMLDivElement | null>(null)
  const [selection, setSelection] = useState('')

  useEffect(() => {
    const read = () => {
      const s = document.getSelection()
      const inside = Boolean(s && s.rangeCount && fullRef.current?.contains(s.getRangeAt(0).commonAncestorContainer))
      setSelection(inside ? (s?.toString().trim() ?? '') : '')
    }
    document.addEventListener('selectionchange', read)
    return () => document.removeEventListener('selectionchange', read)
  }, [])

  const through = contact.channels.find((ch) => ch.id === message.channelId)?.value
  const fromWord = message.direction === 'in' ? 'From' : message.direction === 'team' ? 'By' : 'To'
  const who = message.direction === 'out' ? `${contact.name}${through ? ` · ${through}` : ''}` : message.who || contact.name
  const whenWord = message.direction === 'in' ? 'Received' : message.direction === 'team' ? 'Added' : 'Sent'
  const title = `${channelWord(message)}${message.subject ? `: ${message.subject}` : ''}`

  const print = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;margin:2rem">
<h2>${esc(title)}</h2><p style="color:#555">${esc(fromWord)} ${esc(who)} · ${esc(fullWhen(message.at))}</p><div style="white-space:pre-wrap">${esc(message.body)}</div></body></html>`
    if (!openHtmlPrintWindow(html)) showToast('Allow pop-ups to print it.', 'error')
  }
  const share = async () => {
    const outcome = await runJobShare({ title: `${title} · ${contact.name}`, text: message.body, url: window.location.href }, navigator)
    if (outcome === 'copied') showToast('Copied, to paste where you share it.', 'success')
    if (outcome === 'failed') showToast('It could not be shared from here.', 'error')
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.body)
      showToast('Copied.', 'success')
    } catch {
      showToast('It could not be copied from here.', 'error')
    }
  }

  return (
    <PhoneSheet label={title} title={title} width={720} dataAttrs={{ 'data-message-window': message.id }} onClose={onClose}>
      <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.75rem' }}>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.25rem 0.75rem', margin: 0, fontSize: '0.85rem' }}>
          <dt style={{ color: 'var(--text-muted)' }}>{fromWord}</dt>
          <dd style={{ margin: 0 }}>{who}</dd>
          <dt style={{ color: 'var(--text-muted)' }}>{whenWord}</dt>
          <dd style={{ margin: 0 }}>
            {fullWhen(message.at)}
            {message.durationSeconds ? ` · ${callLength(message.durationSeconds)} long` : ''}
          </dd>
          <dt style={{ color: 'var(--text-muted)' }}>Through</dt>
          <dd style={{ margin: 0 }}>{message.direction === 'team' ? 'a note only the team sees' : through || channelWord(message).toLowerCase()}</dd>
          <dt style={{ color: 'var(--text-muted)' }}>Tied to</dt>
          <dd style={{ margin: 0 }}>
            {tile ? `${tile.num} ${tile.name}` : <i>no job, it sits on the person</i>}{' '}
            {onChangeJob && (
              <button type="button" onClick={onChangeJob} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}>
                change
              </button>
            )}
          </dd>
          {isSentLine(message) && (
            <>
              <dt style={{ color: 'var(--text-muted)' }}>Kept</dt>
              <dd style={{ margin: 0 }}>A copy as it went is kept with the sent copies.</dd>
            </>
          )}
        </dl>
        {message.files && message.files.length > 0 && (
          <MessageFiles
            files={message.files}
            jobKey={message.jobId}
            jobLabel={tile?.num ?? null}
            who={contact}
            sentAt={message.direction === 'out' ? message.at : null}
            photoJob={isSentLine(message) ? null : photoTickJob(message)}
          />
        )}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {first?.(message, selection)}
          <Btn onClick={() => void copy()} title="Copies the whole message.">
            Copy
          </Btn>
          <Btn onClick={print} title="Opens it as a page to print, or to save as a PDF.">
            Print or save as PDF
          </Btn>
          <Btn onClick={() => void share()} title="Opens your device's share menu: Mail, Messages, AirDrop, Notes.">
            Share…
          </Btn>
        </div>
        <div ref={fullRef} data-message-full style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {message.body}
        </div>
      </div>
    </PhoneSheet>
  )
}
