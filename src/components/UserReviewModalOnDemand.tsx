import { useUserReviewModal } from '../contexts/UserReviewModalContext'
import { lazyWindow } from '../lib/lazyWindow'
import { OnDemandWindow } from './OnDemandWindow'

const UserReviewModal = lazyWindow(() => import('./UserReviewModal'))

/** The Layout's user review window: its code loads the first time a review is opened, not with the app. */
export function UserReviewModalOnDemand() {
  const modal = useUserReviewModal()
  return (
    <OnDemandWindow open={modal?.payload != null}>
      <UserReviewModal />
    </OnDemandWindow>
  )
}
