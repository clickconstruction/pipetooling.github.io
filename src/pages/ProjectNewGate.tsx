import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { prefillFromProjectNewSearchParams, useNewProjectModal } from '../contexts/NewProjectModalContext'

/**
 * Mounts on `/projects/new`: opens the new-project modal from the query string, then replaces the URL
 * with `/projects` (preserving `customer` filter when present).
 */
export default function ProjectNewGate() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const newProjectModal = useNewProjectModal()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const customer = searchParams.get('customer')
    const target = customer?.trim()
      ? `/projects?customer=${encodeURIComponent(customer)}`
      : '/projects'

    if (newProjectModal) {
      const prefill = prefillFromProjectNewSearchParams(searchParams)
      newProjectModal.openNewProjectModal({ prefill })
    }
    navigate(target, { replace: true })
  }, [navigate, newProjectModal, searchParams])

  return null
}
