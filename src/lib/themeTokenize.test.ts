import { describe, expect, it } from 'vitest'
// @ts-expect-error — scripts/theme-tokenize.mjs runs the kernel on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/themeTokenize.mjs'

/**
 * scripts/lib/themeTokenize.mjs is the rewrite behind CI's theme token check. These pin the ternaries it reads:
 * the check once needed a quoted string on both sides of the colon, so `open ? '#f0f9ff' : undefined` drew a
 * near-white band under near-white words in dark theme and nothing said so.
 */
const { processSource } = kernel as { processSource: (src: string) => { out: string; count: number } }

const rewrites = (src: string) => processSource(src).out
const leaves = (src: string) => expect(processSource(src)).toEqual({ out: src, count: 0 })

describe('theme tokenizer', () => {
  it('rewrites a plain literal and a ternary quoted on both sides, as it always did', () => {
    expect(rewrites("{ color: '#6b7280' }")).toBe("{ color: 'var(--text-muted)' }")
    expect(rewrites("{ background: on ? '#eff6ff' : '#ffffff' }")).toBe("{ background: on ? 'var(--bg-blue-tint)' : 'var(--surface)' }")
    expect(rewrites("{ border: '1px solid #e5e7eb' }")).toBe("{ border: '1px solid var(--border)' }")
  })

  it('reads the quoted branch when the other side is not a string', () => {
    expect(rewrites("{ background: isExpanded ? '#f0f9ff' : undefined, cursor: 'pointer' }")).toBe(
      "{ background: isExpanded ? 'var(--bg-sky-tint)' : undefined, cursor: 'pointer' }",
    )
    expect(rewrites("<td style={{ color: total >= 0 ? undefined : '#b91c1c' }}>{total >= 0 ? 'white' : 'red'}</td>")).toBe(
      "<td style={{ color: total >= 0 ? undefined : 'var(--text-red-700)' }}>{total >= 0 ? 'white' : 'red'}</td>",
    )
    expect(rewrites("{ borderBottom: expanded ? undefined : '1px solid #e5e7eb' }")).toBe(
      "{ borderBottom: expanded ? undefined : '1px solid var(--border)' }",
    )
    expect(rewrites("{ color: s.state === 'behind' ? '#b45309' : MUTED }")).toBe("{ color: s.state === 'behind' ? 'var(--text-amber-700)' : MUTED }")
  })

  it('reads every branch of a nested ternary, and one inside grouping parens', () => {
    expect(rewrites("{ color: loading ? '#9ca3af' : url ? 'var(--text-link)' : '#dc2626' }")).toBe(
      "{ color: loading ? 'var(--text-faint)' : url ? 'var(--text-link)' : 'var(--text-red-600)' }",
    )
    expect(rewrites("{ background: selected ? (live ? '#fffbeb' : tint) : '#ffffff' }")).toBe(
      "{ background: selected ? (live ? 'var(--bg-amber-tint)' : tint) : 'var(--surface)' }",
    )
  })

  it('reads a ternary laid over several lines', () => {
    const src = ['color:', '  saving || dead', "    ? '#6b7280'", "    : '#fff',", "border: 'none',"].join('\n')
    expect(rewrites(src)).toBe(['color:', '  saving || dead', "    ? 'var(--text-muted)'", "    : '#fff',", "border: 'none',"].join('\n'))
  })

  it('reads a ?? fallback', () => {
    expect(rewrites('{ color: tone ?? \'#6b7280\' }')).toBe("{ color: tone ?? 'var(--text-muted)' }")
  })

  it('maps a branch by the prop that holds the ternary, never by a name inside it', () => {
    // `color : '#ffffff'` is the ternary's other side here, not a text colour of its own
    expect(rewrites("{ background: on ? color : '#ffffff' }")).toBe("{ background: on ? color : 'var(--surface)' }")
  })

  it('leaves alone what is not a branch', () => {
    // a string the condition compares against
    leaves("{ background: paper === 'white' ? paperFill : inkFill }")
    // a string handed to a call, which may need the raw colour
    leaves("{ background: alpha(on ? '#eff6ff' : fill, 0.5) }")
    // a saturated press and a colour the tables do not hold
    leaves("{ background: on ? '#2563eb' : undefined }")
    // a prop that is not a colour
    leaves("{ label: on ? '#eff6ff' : undefined }")
    // a template string needs a person
    leaves('{ border: `1px solid ${on ? \'#2563eb\' : \'#d1d5db\'}` }')
    // a type, where the next line is not part of the value
    leaves(['type Look = {', '  background: string', "  paper?: 'white' | 'cream'", '}'].join('\n'))
  })

  it('counts each branch it rewrites', () => {
    expect(processSource("{ background: a ? '#eff6ff' : undefined, color: b ? undefined : '#b91c1c' }").count).toBe(2)
  })
})
