export type QueueStatus =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'completed'
  | 'skipped'
  | 'cancelled'
  | 'expired'

export type ScheduleStatus = 'open' | 'closed' | 'full' | 'cancelled'

export type ScheduleAvailability = {
  schedule_id: string
  branch_id: string
  branch_name: string
  polyclinic_id: string
  polyclinic_name: string
  queue_prefix: string
  doctor_id: string
  doctor_name: string
  specialization: string | null
  schedule_date: string
  start_time: string
  end_time: string
  quota_limit: number
  average_service_minutes: number
  status: ScheduleStatus
  queue_session_id: string | null
  current_number: number
  last_number: number
  total_taken: number
  remaining_quota: number
}

export type QueueTicketDetail = {
  ticket_id: string
  queue_session_id: string
  patient_id: string
  patient_name: string
  queue_number: number
  queue_code: string
  status: QueueStatus
  estimated_wait_minutes: number
  created_at: string
  called_at: string | null
  serving_started_at: string | null
  completed_at: string | null
  current_number: number
  last_number: number
  schedule_id: string
  schedule_date: string
  start_time: string
  end_time: string
  average_service_minutes: number
  branch_id: string
  branch_name: string
  branch_address: string
  polyclinic_id: string
  polyclinic_name: string
  queue_prefix: string
  doctor_id: string
  doctor_name: string
  specialization: string | null
}

export type QueueEventFeedItem = {
  event_id: string
  queue_ticket_id: string
  actor_id: string | null
  previous_status: QueueStatus | null
  new_status: QueueStatus
  message: string | null
  created_at: string
  queue_code: string
  patient_id: string
  patient_name: string
  polyclinic_name: string
  doctor_name: string
  branch_name: string
  schedule_date: string
  start_time: string
  end_time: string
}

export type ClinicBranch = {
  id: string
  name: string
  is_active: boolean
}

export type Polyclinic = {
  id: string
  branch_id: string
  name: string
  code: string
  description: string | null
  queue_prefix: string
  is_active: boolean
}

export type Doctor = {
  id: string
  full_name: string
  license_number: string | null
  specialization: string | null
  bio: string | null
  default_service_minutes: number
  is_active: boolean
}
