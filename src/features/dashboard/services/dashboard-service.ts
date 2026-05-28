import { supabase } from '../../../lib/supabase'
import type { Doctor, Polyclinic, QueueTicketDetail, ScheduleAvailability } from '../../../types/queue'

export type DashboardData = {
  doctors: Doctor[]
  polyclinics: Polyclinic[]
  schedules: ScheduleAvailability[]
  tickets: QueueTicketDetail[]
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10)

  const [schedules, tickets, doctors, polyclinics] = await Promise.all([
    supabase
      .from('v_schedule_availability')
      .select('*')
      .eq('schedule_date', today)
      .order('start_time', { ascending: true }),
    supabase
      .from('v_queue_ticket_details')
      .select('*')
      .eq('schedule_date', today)
      .order('created_at', { ascending: false }),
    supabase
      .from('doctors')
      .select(
        'id, full_name, license_number, specialization, bio, default_service_minutes, is_active',
      )
      .order('full_name', { ascending: true }),
    supabase
      .from('polyclinics')
      .select('id, branch_id, name, code, description, queue_prefix, is_active')
      .order('name', { ascending: true }),
  ])

  if (schedules.error) throw schedules.error
  if (tickets.error) throw tickets.error
  if (doctors.error) throw doctors.error
  if (polyclinics.error) throw polyclinics.error

  return {
    doctors: doctors.data as Doctor[],
    polyclinics: polyclinics.data as Polyclinic[],
    schedules: schedules.data as ScheduleAvailability[],
    tickets: tickets.data as QueueTicketDetail[],
  }
}
