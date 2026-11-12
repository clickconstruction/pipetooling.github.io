/**
 * The app's own route to a First look's page, `/show/:code` (punch list #319). A customer's phone never comes here:
 * `index.html` sends a `/show/<code>` address to the page's own small entry (`show.html`) before the app loads. This
 * route is what a signed-in browser's in-app link and the smokes use.
 */
import { useParams } from 'react-router-dom'
import type { ShowUsIo } from '../lib/firstLook/showUsIo'
import ShowUs from './ShowUs'

export default function ShowUsRoute({ io }: { io?: ShowUsIo }) {
  const params = useParams()
  return <ShowUs code={params.code} io={io} />
}
