import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { lazyWindow } from '../../lib/lazyWindow'
import { WINDOW_NAMES } from '../../lib/windowLoad'
import { OnDemandWindow } from '../OnDemandWindow'

const PersonDeskDrawer = lazyWindow(() => import('./PersonDeskDrawer').then((m) => ({ default: m.PersonDeskDrawer })))

/** The Layout's person desk: the drawer's code loads the first time a person is opened, not with the app. */
export function PersonDeskDrawerOnDemand() {
  const desk = usePersonDeskContext()
  return (
    <OnDemandWindow open={desk.payload != null} what={WINDOW_NAMES.personDesk} onGaveUp={() => desk.close()}>
      <PersonDeskDrawer />
    </OnDemandWindow>
  )
}
