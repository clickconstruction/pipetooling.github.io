/**
 * Messages, cut 5: whether a text can go, read from the texts switch (`app_settings` `messages_texts_on_v1`, Settings →
 * Phone and texts → Send texts). Null until the read comes back, and false when the read fails, so a text never goes on
 * a guess. The send window holds a text until it reads true; the reply box draws the wait line in place of its composer
 * once it reads false, and draws as before while it is still reading. `quo-send` checks the same row again before it
 * sends.
 */
import { useEffect, useState } from 'react'
import { supabaseTextsSwitchIo, type TextsSwitchIo } from '../../../../lib/quo/textsSwitchIo'

const DEFAULT_IO = supabaseTextsSwitchIo()

export function useTextsOn(io: Pick<TextsSwitchIo, 'load'> = DEFAULT_IO): boolean | null {
  const [on, setOn] = useState<boolean | null>(null)
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
