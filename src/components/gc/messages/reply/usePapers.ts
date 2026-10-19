import { useEffect, useRef, useState } from 'react'
import type { Paper } from '../../../../lib/messages/papers'
import type { PapersIo } from '../../../../lib/messages/papersIo'

/**
 * Bills and estimates in a message (punch list #127): one customer's papers for the reply box, read the first time
 * they are `wanted` (when the box reads its quick replies: the strip open, *Find a reply* or a `/`), so a box that never
 * uses a line reads nothing. Null while the read is out, and for a person who is no customer. A read that fails gives
 * no papers (`papersIo.ts`), and a line about money then waits for its blanks as it did before.
 *
 * Each read is kept with the customer it was for, so a read that lands after the box moved to someone else is never
 * shown; nothing is cancelled, since `wanted` going false (the strip folding) must not lose a read already asked.
 */
export function usePapers(io: PapersIo, customerId: string | null, wanted: boolean): Paper[] | null {
  const [read, setRead] = useState<{ customerId: string; papers: Paper[] } | null>(null)
  const asked = useRef<string | null>(null)

  useEffect(() => {
    if (!wanted || !customerId || asked.current === customerId) return
    asked.current = customerId
    void io.load(customerId).then((papers) => setRead({ customerId, papers }))
  }, [io, customerId, wanted])

  return customerId && read?.customerId === customerId ? read.papers : null
}
