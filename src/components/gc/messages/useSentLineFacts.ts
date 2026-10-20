import { useEffect, useState } from 'react'
import { sentLineFacts } from '../../../lib/messages/sentLines'
import { copyIdsOf, supabaseSentStampsIo, type SentStampsIo } from '../../../lib/messages/sentStampsIo'

const DEFAULT_IO = supabaseSentStampsIo()
const NONE: ReadonlyMap<string, string[]> = new Map()

/**
 * Messages, residential R8 · 1: the small print of the open thread's sent copies, by line id (`sent:<id>`), read once
 * for the copies its lines name (`sent_copy_stamps`) and again when they change. A read that fails shows no small print;
 * the lines themselves stand.
 */
export function useSentLineFacts(lineIds: readonly string[], io: SentStampsIo = DEFAULT_IO): ReadonlyMap<string, string[]> {
  const key = copyIdsOf(lineIds).sort().join(',')
  const [facts, setFacts] = useState<ReadonlyMap<string, string[]>>(NONE)
  useEffect(() => {
    if (!key) {
      setFacts(NONE)
      return
    }
    let live = true
    io.load(key.split(',')).then(
      (rows) => {
        if (live) setFacts(sentLineFacts(rows))
      },
      () => {
        if (live) setFacts(NONE)
      },
    )
    return () => {
      live = false
    }
  }, [io, key])
  return facts
}
