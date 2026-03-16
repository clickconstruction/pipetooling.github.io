import type { ReactNode } from 'react'

type Props = {
  title: string
  links?: string[] | null
}

/**
 * Renders checklist item title with [1], [2], etc. as clickable links.
 * links[0] maps to [1], links[1] to [2], etc.
 */
export function ChecklistTitleWithLinks({ title, links }: Props) {
  const urlList = links?.filter(Boolean) ?? []
  if (urlList.length === 0) return <>{title}</>

  const parts: ReactNode[] = []
  const re = /\[(\d+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(title)) !== null) {
    const before = title.slice(lastIndex, match.index)
    if (before) parts.push(before)

    const n = parseInt(match[1] ?? '0', 10)
    const url = urlList[n - 1]
    if (url != null) {
      parts.push(
        <a
          key={`${match.index}-${n}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2563eb', textDecoration: 'underline' }}
        >
          [{n}]
        </a>
      )
    } else {
      parts.push(match[0])
    }
    lastIndex = re.lastIndex
  }

  if (lastIndex < title.length) parts.push(title.slice(lastIndex))

  return <>{parts.length > 0 ? parts : title}</>
}
