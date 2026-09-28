// The rows the Review tab's per-person panel draws, moved out of the
// component so the loader that builds them can live in `lib/people`.

export type ReviewLaborJob = {
  source: 'labor'
  id: string
  job_date: string | null
  address: string
  hoursInfo: string
  hours: number
  job_number: string | null
  click_number: string | null
  job_id: string | null
  job_name: string
  service_type_id: string | null
  laborCost: number
  driveCost: number
  partsCost: number
  totalBill: number
  valueCreated: number
  pctComplete: number | null
  revenueBeforeOverhead: number
  allocatedTotalBill: number
  allocatedRevenueBeforeOverhead: number
  allocatedPartsCost: number
  subLaborCost: number
  totalLaborOnJob: number
  totalDriveCostOnJob: number
  totalJobHours: number
  userTotalHoursOnJob: number
  userTotalContributionToBill: number
  userTotalContributionToRevenue: number
  userTotalLaborOnJob: number
  userTotalDriveCostOnJob: number
}

export type ReviewCrewJob = {
  source: 'crew'
  job_id: string
  work_date: string
  hcp_number: string
  click_number: string
  job_name: string
  job_address: string
  service_type_id: string | null
  hours: number
  laborCost: number
  driveCost: number
  partsCost: number
  totalBill: number
  valueCreated: number
  pctComplete: number | null
  revenueBeforeOverhead: number
  allocatedTotalBill: number
  allocatedRevenueBeforeOverhead: number
  allocatedPartsCost: number
  subLaborCost: number
  totalLaborOnJob: number
  totalDriveCostOnJob: number
  totalJobHours: number
  userTotalHoursOnJob: number
  userTotalContributionToBill: number
  userTotalContributionToRevenue: number
  userTotalLaborOnJob: number
  userTotalDriveCostOnJob: number
}

export type ReviewReport = { id: string; template_name: string; job_display_name: string; created_at: string }

export type ReviewTask = { id: string; title: string; links?: string[] | null; scheduled_date: string; completed_at: string | null; checklist_item_id?: string | null }

export type ReviewLaborContributor = {
  personName: string
  hours: number
  laborCost: number
  subLaborCost: number
  crewLaborCost: number
}
