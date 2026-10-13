/**
 * Messages, cut 5: whether a text can go from the send window, read from the texts switch (`app_settings`
 * `messages_texts_on_v1`, Settings → Phone and texts → Send texts). It reads off until the read comes back, and stays
 * off when the read fails, so a text never goes on a guess. `quo-send` checks the same row again before it sends.
 */
import { useEffect, useState } from 'react'
import { supabaseTextsSwitchIo, type TextsSwitchIo } from '../../../../lib/quo/textsSwitchIo'

const DEFAULT_IO = supabaseTextsSwitchIo()

export function useTextsOn(io: Pick<TextsSwitchIo, 'load'> = DEFAULT_IO): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let live = true
    io.load().then(
      (v) => {
        if (live) setOn(v)
      },
      () => {
        if (live) setOn(false)
      },
    )
    return () => {
      live = false
    }
  }, [io])
  return on
}
