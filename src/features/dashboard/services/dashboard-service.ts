import { supabase } from '../../../lib/supabase'
import type {
  Doctor,
  Polyclinic,
  QueueEventFeedItem,
  QueueTicketDetail,
  ScheduleAvailability,
} from '../../../types/queue'

export type DashboardData = {
  doctors: Doctor[]
  events: QueueEventFeedItem[]
  polyclinics: Polyclinic[]
  schedules: ScheduleAvailability[]
  tickets: QueueTicketDetail[]
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const today = toDateInputValue(new Date())

  const [schedules, tickets, events, doctors, polyclinics] = await Promise.all([
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
      .from('v_queue_event_feed')
      .select('*')
      .eq('schedule_date', today)
      .order('created_at', { ascending: false })
      .limit(12),
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
  if (events.error) throw events.error
  if (doctors.error) throw doctors.error
  if (polyclinics.error) throw polyclinics.error

  return {
    doctors: doctors.data as Doctor[],
    events: events.data as QueueEventFeedItem[],
    polyclinics: polyclinics.data as Polyclinic[],
    schedules: schedules.data as ScheduleAvailability[],
    tickets: tickets.data as QueueTicketDetail[],
  }
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
