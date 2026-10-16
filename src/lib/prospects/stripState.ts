/**
 * What a strip's read means (v2.5585, punch list #113): the GC work strip and the bench strip
 * held one state that started as null and was also set to null when the read failed, so for the
 * half second before the first answer they said *could not be read*. Three states, one rule:
 * undefined until the first answer (the strip draws nothing), null when the read failed (the
 * strip says so), the rows once read.
 */
export type StripRead<T> = T | null | undefined

export function stripReads<T>(state: StripRead<T>): 'loading' | 'failed' | 'ready' {
  if (state === undefined) return 'loading'
  if (state === null) return 'failed'
  return 'ready'
}
