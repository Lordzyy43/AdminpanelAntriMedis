import { supabase } from '../../../lib/supabase'
import type {
  ClinicBranch,
  Doctor,
  Polyclinic,
  ScheduleAvailability,
  ScheduleStatus,
} from '../../../types/queue'

export type SchedulePayload = {
  branch_id: string
  polyclinic_id: string
  doctor_id: string
  schedule_date: string
  start_time: string
  end_time: string
  quota_limit: number
  average_service_minutes: number
  status: ScheduleStatus
  notes?: string | null
}

export async function fetchScheduleManagementRows() {
  const { data, error } = await supabase
    .from('v_schedule_availability')
    .select('*')
    .order('schedule_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return data as ScheduleAvailability[]
}

export async function fetchScheduleReferences() {
  const [branches, polyclinics, doctors] = await Promise.all([
    supabase
      .from('clinic_branches')
      .select('id, name, is_active')
      .order('name', { ascending: true }),
    supabase
      .from('polyclinics')
      .select('id, branch_id, name, code, description, queue_prefix, is_active')
      .order('name', { ascending: true }),
    supabase
      .from('doctors')
      .select('id, full_name, license_number, specialization, bio, default_service_minutes, is_active')
      .order('full_name', { ascending: true }),
  ])

  if (branches.error) throw branches.error
  if (polyclinics.error) throw polyclinics.error
  if (doctors.error) throw doctors.error

  return {
    branches: branches.data as ClinicBranch[],
    polyclinics: polyclinics.data as Polyclinic[],
    doctors: doctors.data as Doctor[],
  }
}

export async function createSchedule(payload: SchedulePayload) {
  const { error } = await supabase.rpc('create_schedule_with_session', {
    p_average_service_minutes: payload.average_service_minutes,
    p_branch_id: payload.branch_id,
    p_doctor_id: payload.doctor_id,
    p_end_time: payload.end_time,
    p_notes: payload.notes ?? null,
    p_polyclinic_id: payload.polyclinic_id,
    p_quota_limit: payload.quota_limit,
    p_schedule_date: payload.schedule_date,
    p_start_time: payload.start_time,
    p_status: payload.status,
  })

  if (error) throw error
}

export async function updateSchedule(scheduleId: string, payload: SchedulePayload) {
  const { error } = await supabase.rpc('update_schedule_with_session', {
    p_average_service_minutes: payload.average_service_minutes,
    p_branch_id: payload.branch_id,
    p_doctor_id: payload.doctor_id,
    p_end_time: payload.end_time,
    p_notes: payload.notes ?? null,
    p_polyclinic_id: payload.polyclinic_id,
    p_quota_limit: payload.quota_limit,
    p_schedule_date: payload.schedule_date,
    p_schedule_id: scheduleId,
    p_start_time: payload.start_time,
    p_status: payload.status,
  })

  if (error) throw error
}

export async function deleteSchedule(scheduleId: string) {
  const { error } = await supabase.rpc('delete_schedule_if_empty', {
    p_schedule_id: scheduleId,
  })

  if (error) throw error
}
