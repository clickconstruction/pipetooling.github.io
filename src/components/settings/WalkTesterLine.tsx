import { useEffect, useState } from 'react'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { walkTesterLine } from '../../lib/walk/testerLine'
import { loadWalkTester, type LoadWalkTester } from '../../lib/walk/testerLineIo'
import { MUTED } from '../bids/twinConsoleStyles'

/**
 * Settings → System → Digital twins & samples → the walk tester's one line (punch list #142 PR 3, v2.5738). The walk
 * kit's hidden tester account (`users.is_walk_tester`, README decision 5) hides from every roster and picker as a sample
 * does, so this is the one place the owner sees it: whether it is in training mode and when it last walked (the kit's
 * `madeAt` while a kit stands, else its last sign-in), or that there is none yet. Read-only; the kit makes and keeps
 * the account, and nothing here presses anything. The row is visible to devs alone (`users_walk_tester_hidden`), and
 * this card is on a dev's page.
 */
export default function WalkTesterLine({ load = loadWalkTester }: { load?: LoadWalkTester }) {
  const [words, setWords] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void load().then(
      (read) => {
        if (alive) setWords(walkTesterLine(read.tester, read.kitValueText, APP_CALENDAR_TZ).words)
      },
      () => {
        if (alive) setWords('The walk tester could not be read.')
      },
    )
    return () => {
      alive = false
    }
  }, [load])

  return (
    <p style={{ ...MUTED, margin: '0.6rem 0 0' }} aria-label="Walk tester" data-testid="walk-tester-line">
      {words ?? 'Loading…'}
    </p>
  )
}
