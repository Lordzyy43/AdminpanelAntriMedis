import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Monitor, RefreshCw } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button, LinkButton } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { PageHeader } from '../../../components/ui/page-header'
import { TableEmptyState } from '../../../components/ui/table-state'
import { supabase } from '../../../lib/supabase'
import type { QueueStatus, QueueTicketDetail } from '../../../types/queue'
import { fetchDashboardData } from '../services/dashboard-service'

export function DashboardPage() {
  const queryClient = useQueryClient()
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  })

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_tickets' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_sessions' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const tickets = useMemo(() => dashboardQuery.data?.tickets ?? [], [dashboardQuery.data])
  const activeTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        ['waiting', 'called', 'serving', 'missed'].includes(ticket.status),
      ),
    [tickets],
  )
  const compactQueue = useMemo(
    () =>
      [...activeTickets]
        .sort((first, second) => {
          const priority: Record<QueueStatus, number> = {
            serving: 0,
            called: 1,
            waiting: 2,
            missed: 3,
            completed: 4,
            skipped: 5,
            cancelled: 6,
            expired: 7,
          }

          return priority[first.status] - priority[second.status]
        })
        .slice(0, 8),
    [activeTickets],
  )
  const statusQueue = useMemo(
    () =>
      [...tickets]
        .sort((first, second) => getTicketActivityTime(second) - getTicketActivityTime(first))
        .slice(0, 10),
    [tickets],
  )
  const completedCount = tickets.filter((ticket) => ticket.status === 'completed').length

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
              <LinkButton to="/queues" variant="secondary">
                <Activity size={16} />
                Kelola Antrean
              </LinkButton>
              <LinkButton
                rel="noreferrer"
                target="_blank"
                to="/queue-display"
                variant="secondary"
              >
                <Monitor size={16} />
                Display
              </LinkButton>
              <Button
                variant="secondary"
                onClick={() => {
                  void dashboardQuery.refetch()
                }}
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </>
          }
          description="Ringkasan antrean hari ini dalam tampilan ringkas."
          eyebrow="Ringkasan Hari Ini"
          title="Dashboard Admin"
        />

        <Card className="p-5">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-slate-950">Informasi Antrean</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Klik antrean untuk membuka detail dan mengelola statusnya.
              </p>
            </div>
            <span className="w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
              {completedCount} selesai hari ini
            </span>
          </div>

          <div className="mt-4">
            {dashboardQuery.isLoading ? (
              <LoadingRows />
            ) : compactQueue.length === 0 ? (
              <EmptyQueue
                description="Menunggu pasien mengambil nomor."
                title="Belum ada antrean aktif"
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-500 md:grid-cols-[1.3fr_1fr_140px]">
                  <span>Nama Pasien</span>
                  <span>Poli</span>
                  <span>No Antrean</span>
                </div>
                <div className="divide-y divide-slate-100">
                {compactQueue.map((ticket) => (
                  <CompactQueueRow key={ticket.ticket_id} ticket={ticket} />
                ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-slate-950">List Antrean dan Status</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Status antrean terbaru dari dipanggil sampai selesai.
              </p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {statusQueue.length} antrean
            </span>
          </div>

          <div className="mt-4">
            {dashboardQuery.isLoading ? (
              <LoadingRows />
            ) : statusQueue.length === 0 ? (
              <EmptyQueue
                description="Status antrean akan muncul setelah pasien mengambil nomor."
                title="Belum ada status antrean"
              />
            ) : (
              <div className="grid gap-3">
                {statusQueue.map((ticket, index) => (
                  <StatusQueueRow index={index} key={ticket.ticket_id} ticket={ticket} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}

function CompactQueueRow({
  ticket,
}: {
  ticket: QueueTicketDetail
}) {
  return (
    <Link
      className="grid gap-3 bg-white px-4 py-3 transition hover:bg-teal-50 md:grid-cols-[1.3fr_1fr_140px] md:items-center"
      to={`/queues?session=${ticket.queue_session_id}&ticket=${ticket.ticket_id}`}
    >
      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">{ticket.patient_name}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-700">{ticket.polyclinic_name}</p>
      </div>
      <div>
        <p className="w-fit rounded-full bg-teal-50 px-3 py-1 text-sm font-black text-teal-700">
          {ticket.queue_code}
        </p>
      </div>
    </Link>
  )
}

function StatusQueueRow({
  index,
  ticket,
}: {
  index: number
  ticket: QueueTicketDetail
}) {
  return (
    <Link
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-teal-200 hover:bg-teal-50"
      to={`/queues?session=${ticket.queue_session_id}&ticket=${ticket.ticket_id}`}
    >
      <div className="min-w-0">
        <p className="truncate font-black text-slate-950">
          {ticket.queue_code} - {ticket.patient_name || `Pasien ${index + 1}`}
        </p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {ticket.polyclinic_name} - {ticket.doctor_name}
        </p>
      </div>
      <StatusBadge status={ticket.status} />
    </Link>
  )
}

function LoadingRows() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="h-14 animate-pulse rounded-xl bg-slate-100" key={index} />
      ))}
    </div>
  )
}

function EmptyQueue({ description, title }: { description: string; title: string }) {
  return (
    <table className="w-full text-left text-sm">
      <tbody>
        <TableEmptyState colSpan={1} description={description} title={title} />
      </tbody>
    </table>
  )
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const tone =
    status === 'waiting'
      ? 'bg-blue-50 text-blue-700'
      : status === 'called'
        ? 'bg-amber-50 text-amber-700'
        : status === 'serving'
          ? 'bg-teal-50 text-teal-700'
          : status === 'missed'
            ? 'bg-violet-50 text-violet-700'
            : status === 'completed'
              ? 'bg-emerald-50 text-emerald-700'
              : status === 'cancelled'
                ? 'bg-rose-50 text-rose-700'
                : status === 'skipped'
                  ? 'bg-orange-50 text-orange-700'
                  : 'bg-slate-100 text-slate-600'

  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {queueStatusLabel(status)}
    </span>
  )
}

function queueStatusLabel(status: QueueStatus) {
  const labels: Record<QueueStatus, string> = {
    cancelled: 'Dibatalkan',
    called: 'Dipanggil',
    completed: 'Selesai',
    expired: 'Kedaluwarsa',
    missed: 'Terlewat',
    serving: 'Dilayani',
    skipped: 'Dilewati',
    waiting: 'Menunggu',
  }
  return labels[status]
}

function getTicketActivityTime(ticket: QueueTicketDetail) {
  const value =
    ticket.completed_at ??
    ticket.serving_started_at ??
    ticket.called_at ??
    ticket.skipped_at ??
    ticket.cancelled_at ??
    ticket.expired_at ??
    ticket.created_at

  return new Date(value).getTime()
}
