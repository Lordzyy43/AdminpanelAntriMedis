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
  const { data, error } = await supabase
    .from('doctor_schedules')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw error

  const { error: sessionError } = await supabase.from('queue_sessions').insert({
    schedule_id: data.id,
    is_open: payload.status === 'open',
    started_at: payload.status === 'open' ? new Date().toISOString() : null,
    closed_at: payload.status === 'open' ? null : new Date().toISOString(),
  })

  if (sessionError) throw sessionError
}

export async function updateSchedule(scheduleId: string, payload: SchedulePayload) {
  const { error } = await supabase
    .from('doctor_schedules')
    .update(payload)
    .eq('id', scheduleId)

  if (error) throw error

  const isOpen = payload.status === 'open'
  const { error: sessionError } = await supabase
    .from('queue_sessions')
    .update({
      is_open: isOpen,
      closed_at: isOpen ? null : new Date().toISOString(),
    })
    .eq('schedule_id', scheduleId)

  if (sessionError) throw sessionError
}
