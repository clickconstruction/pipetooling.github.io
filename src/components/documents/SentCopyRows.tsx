import { useToastContext } from '../../contexts/ToastContext'
import { formatDenverCalendarDayWithYear, formatDenverTimeOnly } from '../../utils/dateUtils'
import { type SentCopyLine, sentCopyDoor, sentCopyWords } from '../../lib/sent/sentCopies'
import { openSentCopy, openSentFile } from '../../lib/sent/sentCopiesIo'
import { documentsLinkButton, documentsTd } from '../jobs/jobDocumentsStyles'

/**
 * The rows of a list of sent copies (v2.4554; shared since v2.4573): the name opens the copy as
 * it went, the grey words say how, when, to whom and by whom, an email's attachments follow as
 * links. Used by the job window's "Sent from this job" and the Documents page's Sent tab.
 */

export const sentCopyWhen = (iso: string): string => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? `${formatDenverCalendarDayWithYear(ms)}, ${formatDenverTimeOnly(ms)}` : ''
}

export function SentCopyRows({ lines, rowTestId }: { lines: ReadonlyArray<SentCopyLine>; rowTestId: string }) {
  const { showToast } = useToastContext()

  const open = async (line: SentCopyLine) => {
    const ok = await openSentCopy(line.row, `Copy as it went out · ${line.row.title} · ${sentCopyWords(line, sentCopyWhen)}`)
    if (!ok) showToast('Could not open the copy. Allow pop-ups for this site and press it again.', 'error')
  }
  const openAttachment = async (path: string) => {
    if (!(await openSentFile(path))) showToast('Could not open the attachment.', 'error')
  }

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <tbody>
        {lines.map((line) => {
          const kept = sentCopyDoor(line.row) !== 'none'
          return (
            <tr key={line.row.id} data-testid={rowTestId}>
              <td style={documentsTd}>
                {kept ? (
                  <button type="button" onClick={() => void open(line)} style={documentsLinkButton} title="Open the copy as it went out">
                    {line.row.title}
                  </button>
                ) : (
                  <span style={{ fontWeight: 600 }}>{line.row.title}</span>
                )}
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>{sentCopyWords(line, sentCopyWhen)}</span>
                {kept ? null : (
                  <span data-testid={`${rowTestId}-no-copy`} style={{ color: 'var(--text-amber-800)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                    The copy was not kept.
                  </span>
                )}
                {line.row.attachments.map((a) => (
                  <button key={a.path} type="button" onClick={() => void openAttachment(a.path)} style={{ ...documentsLinkButton, fontWeight: 400, marginLeft: '0.6rem', fontSize: '0.8125rem' }}>
                    {a.name}
                  </button>
                ))}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default SentCopyRows
