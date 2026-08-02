import TeamLeadsManager from './TeamLeadsManager'

export type PeopleTeamsTabProps = {
  authUserId: string
  authUserRole: string | null
}

/**
 * People → Teams tab: a thin wrapper around the shared leader-centric
 * TeamLeadsManager, which the People → Users "Team leads" modal also renders.
 * The manager is self-contained (auth/role via useAuth, own roster +
 * assignment loads), so the parent's authUser wiring props are accepted only
 * to keep the People.tsx call site stable.
 */
export default function PeopleTeamsTab(_props: PeopleTeamsTabProps) {
  return <TeamLeadsManager />
}
