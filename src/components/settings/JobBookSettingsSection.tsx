import JobBookEditorPanel from './JobBookEditorPanel'

type Props = {
  onDbError: (message: string) => void
}

export default function JobBookSettingsSection({ onDbError }: Props) {

  return (
    <div>
      {(
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <JobBookEditorPanel active onDbError={onDbError} showIntro />
        </div>
      )}
    </div>
  )
}
