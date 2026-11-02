import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { formatDenverCalendarDayWithYear, formatDenverTimeOnly } from '../../utils/dateUtils'
import { type SentCopy, type SentCopyLine, sentCopyDoor, sentCopyWords, sentKindTag } from '../../lib/sent/sentCopies'
import { sentCopySubjectLine, type SentCopyAboutLink } from '../../lib/sent/sentCopyAbout'
import { openSentCopy, openSentFile } from '../../lib/sent/sentCopiesIo'
import { documentsLinkButton, documentsTd } from '../jobs/jobDocumentsStyles'

/**
 * The rows of a list of sent copies (v2.4554; shared since v2.4573): the name opens the copy as
 * it went, the grey words under it say how, when, to whom and by whom, an email's attachments
 * follow as chips. Used by the job window's "Sent from this job" and the Documents page's Sent
 * copies tab, which lists under day headings and passes `when` as the time alone (the Documents
 * spike of 2026-11-01: the title on its own line, the facts in one fixed order under it). With
 * `about` a line also names the job or the bid the copy is for, as links, and with `showKind` the
 * kind of paper sits before the title; the subject follows when it says more than the title.
 */

export const sentCopyWhen = (iso: string): string => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? `${formatDenverCalendarDayWithYear(ms)}, ${formatDenverTimeOnly(ms)}` : ''
}

const facts: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.1rem' }
const kindChip: CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'text-bottom',
  marginRight: '0.45rem',
  padding: '0.08rem 0.4rem',
  borderRadius: 4,
  fontSize: '0.7rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
const aboutLink: CSSProperties = { fontWeight: 600, color: 'var(--text-green-700)', textDecoration: 'none', fontSize: '0.8125rem' }
const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  marginTop: '0.3rem',
  marginRight: '0.35rem',
  padding: '0.1rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.75rem',
  cursor: 'pointer',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export function SentCopyRows({
  lines,
  rowTestId,
  when = sentCopyWhen,
  about,
  showKind = false,
}: {
  lines: ReadonlyArray<SentCopyLine>
  rowTestId: string
  when?: (iso: string) => string
  /** The job or bid links a line draws under its facts; none on a list that is already one job's. */
  about?: (row: SentCopy) => SentCopyAboutLink[]
  showKind?: boolean
}) {
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
          const links = about ? about(line.row) : []
          const subject = sentCopySubjectLine(line.row)
          const tag = showKind ? sentKindTag(line.row.kind) : null
          return (
            <tr key={line.row.id} data-testid={rowTestId}>
              <td style={{ ...documentsTd, padding: '0.55rem 0.5rem' }}>
                {tag && tag.words ? <span style={{ ...kindChip, background: tag.background, color: tag.color }}>{tag.words}</span> : null}
                {kept ? (
                  <button type="button" onClick={() => void open(line)} style={{ ...documentsLinkButton, fontWeight: 600 }} title="Open the copy as it went out">
                    {line.row.title}
                  </button>
                ) : (
                  <span style={{ fontWeight: 600 }}>{line.row.title}</span>
                )}
                <span style={facts}>
                  {sentCopyWords(line, when)}
                  {kept ? null : (
                    <span data-testid={`${rowTestId}-no-copy`} style={{ color: 'var(--text-amber-800)', marginLeft: '0.5rem' }}>
                      The copy was not kept. The send went out, and this row is the record.
                    </span>
                  )}
                </span>
                {links.length > 0 || subject ? (
                  <span style={{ ...facts, marginTop: '0.15rem' }} data-testid={`${rowTestId}-about`}>
                    {links.map((l, i) => (
                      <span key={`${l.kind}-${l.to}`}>
                        {i > 0 ? ' · ' : ''}
                        <Link to={l.to} style={aboutLink}>
                          {l.label}
                        </Link>
                      </span>
                    ))}
                    {subject ? <span style={{ fontStyle: 'italic' }}>{links.length > 0 ? ' · ' : ''}“{subject}”</span> : null}
                  </span>
                ) : null}
                {line.row.attachments.length > 0 ? (
                  <span style={{ display: 'block' }}>
                    {line.row.attachments.map((a) => (
                      <button key={a.path} type="button" onClick={() => void openAttachment(a.path)} style={chip} title={a.name}>
                        {a.name}
                      </button>
                    ))}
                  </span>
                ) : null}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default SentCopyRows
