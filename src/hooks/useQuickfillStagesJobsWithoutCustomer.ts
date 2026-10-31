import { useEffect, useMemo } from 'react'
import { useAuth } from './useAuth'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import {
  buildStagesJobsWithoutCustomerList,
  buildStagesReadyToBillNoEmailList,
  buildStagesWorkingJobsWithoutPicturesList,
} from '../lib/jobsStagesBoard'

const ROLES = new Set<string>(['dev', 'master_technician', 'assistant', 'controller'])

/** `enabled` (punch list #183 PR 4): false holds the read while the station is off screen on the Roller; `fetchEnabled` still says whether the role sees it. */
export function useQuickfillStagesJobsWithoutCustomer(enabled = true): {
  jobsWithoutCustomer: ReturnType<typeof buildStagesJobsWithoutCustomerList>
  workingJobsWithoutPictures: ReturnType<typeof buildStagesWorkingJobsWithoutPicturesList>
  readyToBillNoEmailJobs: ReturnType<typeof buildStagesReadyToBillNoEmailList>
  loading: boolean
  jobsListBusy: boolean
  fetchEnabled: boolean
} {
  const { user: authUser, role } = useAuth()
  const { jobs, jobsListLoading, jobsListRefreshing, runFetchJobs } = useJobsListCache()

  const fetchEnabled = Boolean(authUser?.id && role && ROLES.has(role))
  const active = fetchEnabled && enabled

  useEffect(() => {
    if (!active) return
    void runFetchJobs(null)
  }, [active, runFetchJobs])

  const jobsWithoutCustomer = useMemo(
    () => (active ? buildStagesJobsWithoutCustomerList(jobs, '', null) : []),
    [active, jobs],
  )

  const workingJobsWithoutPictures = useMemo(
    () => (active ? buildStagesWorkingJobsWithoutPicturesList(jobs, '', null) : []),
    [active, jobs],
  )

  const readyToBillNoEmailJobs = useMemo(
    () => (active ? buildStagesReadyToBillNoEmailList(jobs, '', null) : []),
    [active, jobs],
  )

  const loading = active && jobsListLoading
  const jobsListBusy = jobsListLoading || jobsListRefreshing

  return {
    jobsWithoutCustomer,
    workingJobsWithoutPictures,
    readyToBillNoEmailJobs,
    loading,
    jobsListBusy,
    fetchEnabled,
  }
}
