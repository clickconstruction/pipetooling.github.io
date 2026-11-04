/**
 * The one mark that means "a link" in Messages (v2.6508): a small chain link in the words' own colour, beside a web
 * address in a line's words (`MessageBody`) and on a link's row under Attachments and its chip under the line
 * (`LineFiles`), so a person learns it once. Decorative on its own, with no text of its own, so a row's words read
 * clean; the words beside it, or its holder's title, say what the link is.
 */
export function LinkMark({ size = '0.95em', gap = 0 }: { size?: number | string; /** Room after it, before the words it marks. */ gap?: number | string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-0.12em', flex: 'none', marginRight: gap }}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  )
}
