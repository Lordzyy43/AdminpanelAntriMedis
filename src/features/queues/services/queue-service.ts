import { supabase } from '../../../lib/supabase'
import type { QueueStatus, QueueTicketDetail, ScheduleAvailability } from '../../../types/queue'

export async function fetchSchedules(serviceDate: string) {
  const { data, error } = await supabase
    .from('v_schedule_availability')
    .select('*')
    .eq('status', 'open')
    .eq('schedule_date', serviceDate)
    .not('queue_session_id', 'is', null)
    .order('schedule_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return data as ScheduleAvailability[]
}

export async function fetchQueueTickets(queueSessionId: string) {
  const { data, error } = await supabase
    .from('v_queue_ticket_details')
    .select('*')
    .eq('queue_session_id', queueSessionId)
    .order('queue_number', { ascending: true })

  if (error) throw error
  return data as QueueTicketDetail[]
}

export async function callNextQueue(queueSessionId: string) {
  const { data, error } = await supabase.rpc('call_next_queue', {
    p_queue_session_id: queueSessionId,
  })

  if (error) throw error
  return data as QueueTicketDetail
}

export async function updateQueueStatus(ticketId: string, status: QueueStatus) {
  const { data, error } = await supabase.rpc('update_queue_status', {
    p_ticket_id: ticketId,
    p_new_status: status,
    p_message: `Admin changed status to ${status}`,
  })

  if (error) throw error
  return data as QueueTicketDetail
}
