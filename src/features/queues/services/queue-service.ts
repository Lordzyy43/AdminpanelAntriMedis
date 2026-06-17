import { supabase } from '../../../lib/supabase'
import type {
  Polyclinic,
  QueueStatus,
  QueueTicketDetail,
  QueueTicketTimelineItem,
  ScheduleAvailability,
} from '../../../types/queue'

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

export async function fetchPolyclinics() {
  const { data, error } = await supabase
    .from('polyclinics')
    .select('id, name, is_active')
    .order('name', { ascending: true })

  if (error) throw error
  return data as Polyclinic[]
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

export async function fetchQueueTicketsByDate(serviceDate: string) {
  const { data, error } = await supabase
    .from('v_queue_ticket_details')
    .select('*')
    .eq('schedule_date', serviceDate)
    .order('created_at', { ascending: false })

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

export async function recallMissedQueue(queueSessionId: string) {
  const { data, error } = await supabase.rpc('recall_missed_queue', {
    p_queue_session_id: queueSessionId,
  })

  if (error) throw error
  return data as QueueTicketDetail
}

export type CloseQueueSessionResult = {
  queue_session_id: string
  expired_count: number
  skipped_missed_count?: number
  closed_at: string
}

export async function closeQueueSession(queueSessionId: string) {
  const { data, error } = await supabase.rpc('close_queue_session', {
    p_queue_session_id: queueSessionId,
  })

  if (error) throw error
  return data as CloseQueueSessionResult
}

export async function updateQueueStatus(
  ticketId: string,
  status: QueueStatus,
  message?: string,
) {
  const { data: currentTicket, error: currentTicketError } = await supabase
    .from('v_queue_ticket_details')
    .select('ticket_id, status, queue_code')
    .eq('ticket_id', ticketId)
    .single()

  if (currentTicketError) throw currentTicketError

  const currentStatus = currentTicket.status as QueueStatus
  if (!isAllowedTransition(currentStatus, status)) {
    throw new Error(
      `Status antrean ${currentTicket.queue_code} sudah ${queueStatusLabel(currentStatus)}. Tidak bisa diubah ke ${queueStatusLabel(status)}. Refresh data antrean lalu lanjutkan dari status terbaru.`,
    )
  }

  const { data, error } = await supabase.rpc('update_queue_status', {
    p_ticket_id: ticketId,
    p_new_status: status,
    p_message: message?.trim() || defaultStatusMessage(status),
  })

  if (error) throw error
  return data as QueueTicketDetail
}

export async function fetchQueueTicketTimeline(ticketId: string) {
  const { data, error } = await supabase
    .from('v_queue_ticket_timeline')
    .select('*')
    .eq('queue_ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as QueueTicketTimelineItem[]
}

function defaultStatusMessage(status: QueueStatus) {
  const messages: Record<QueueStatus, string> = {
    waiting: 'Dikembalikan ke status menunggu',
    called: 'Pasien dipanggil oleh petugas',
    serving: 'Pelayanan pasien dimulai',
    missed: 'Pasien tidak hadir saat dipanggil',
    completed: 'Pelayanan pasien selesai',
    skipped: 'Pasien dilewati oleh petugas',
    cancelled: 'Antrean dibatalkan oleh petugas',
    expired: 'Antrean kedaluwarsa',
  }
  return messages[status]
}

function isAllowedTransition(currentStatus: QueueStatus, nextStatus: QueueStatus) {
  if (currentStatus === nextStatus) return true
  if (currentStatus === 'waiting') {
    return ['skipped', 'cancelled', 'expired'].includes(nextStatus)
  }
  if (currentStatus === 'called') {
    return ['serving', 'missed', 'skipped', 'cancelled', 'expired'].includes(nextStatus)
  }
  if (currentStatus === 'missed') {
    return ['skipped', 'cancelled', 'expired'].includes(nextStatus)
  }
  if (currentStatus === 'serving') {
    return ['completed', 'skipped', 'cancelled', 'expired'].includes(nextStatus)
  }
  return false
}

function queueStatusLabel(status: QueueStatus) {
  const labels: Record<QueueStatus, string> = {
    waiting: 'Menunggu',
    called: 'Dipanggil',
    serving: 'Dilayani',
    missed: 'Terlewat',
    completed: 'Selesai',
    skipped: 'Dilewati',
    cancelled: 'Dibatalkan',
    expired: 'Kedaluwarsa',
  }
  return labels[status]
}
