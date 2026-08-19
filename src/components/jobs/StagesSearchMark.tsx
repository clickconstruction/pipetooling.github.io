import { createContext, useContext, type ReactNode } from 'react'
import { splitTextByMatch } from '../../lib/jobs/stagesSearchHighlight'

/**
 * Search-match highlighting plumbing (v2.1830): the Stages tab provides the
 * active search query once; any row fragment renders text through
 * `<StagesSearchMark>` and matched substrings light up — no prop threading
 * through the table layers. With no active query the component renders the
 * bare string (zero extra nodes).
 */
const StagesSearchHighlightContext = createContext<string | null>(null)

export function StagesSearchHighlightProvider({ query, children }: { query: string | null; children: ReactNode }) {
  return <StagesSearchHighlightContext.Provider value={query}>{children}</StagesSearchHighlightContext.Provider>
}

export function StagesSearchMark({
  text,
  onColor = false,
}: {
  text: string | null | undefined
  /** Inside solid-color chips (trade pills): translucent white wash instead of the amber tint. */
  onColor?: boolean
}) {
  const query = useContext(StagesSearchHighlightContext)
  const value = text ?? ''
  if (!query || !value) return <>{value}</>
  const segments = splitTextByMatch(value, query)
  if (segments.length === 1 && !segments[0]!.match) return <>{value}</>
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <mark
            key={i}
            style={
              onColor
                ? { background: 'rgba(255,255,255,0.35)', color: 'inherit', borderRadius: 2, padding: 0 }
                : { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 2, padding: 0 }
            }
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}
