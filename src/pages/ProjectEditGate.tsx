import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

/**
 * Mounts on `/projects/:id/edit`: redirects to `/projects` with location state
 * that asks the Projects page to pop the Edit Project modal. Keeps the legacy
 * deep link working without rendering the standalone page.
 */
export default function ProjectEditGate() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (!id) {
      navigate('/projects', { replace: true })
      return
    }
    navigate('/projects', { replace: true, state: { openEditProject: id } })
  }, [id, navigate])

  return null
}
