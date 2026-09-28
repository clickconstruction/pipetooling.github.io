/**
 * A stylesheet's braces, checked. One missing `}` does not break the file —
 * it nests every rule after it inside the rule left open, so they stop
 * matching and nothing reports it. Pure: the stylesheet's text goes in.
 */

export type CssBraceProblem = { kind: 'unclosed' | 'unopened'; line: number }

/** Comments and quoted strings blanked out, newlines kept, so a brace inside either is not counted and line numbers hold. */
function withoutCommentsAndStrings(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => m.replace(/[^\n]/g, ' '))
}

/** Every `{` left open at the end of the file (by the line it opened on) and every `}` that closes nothing. */
export function cssBraceProblems(css: string): CssBraceProblem[] {
  const text = withoutCommentsAndStrings(css)
  const open: number[] = []
  const problems: CssBraceProblem[] = []
  let line = 1
  for (const ch of text) {
    if (ch === '\n') line += 1
    else if (ch === '{') open.push(line)
    else if (ch === '}') {
      if (open.length === 0) problems.push({ kind: 'unopened', line })
      else open.pop()
    }
  }
  return [...problems, ...open.map((l) => ({ kind: 'unclosed' as const, line: l }))].sort((a, b) => a.line - b.line)
}
