import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  CheckCircle2,
  Clock3,
  Eye,
  FilterX,
  Loader2,
  Megaphone,
  OctagonX,
  RefreshCw,
  Search,
  SkipForward,
  Stethoscope,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { FeedbackBanner } from '../../../components/ui/feedback-banner'
import { FormDrawer } from '../../../components/ui/form-drawer'
import { Input } from '../../../components/ui/input'
import { PageHeader } from '../../../components/ui/page-header'
import { Pagination } from '../../../components/ui/pagination'
import { StatCard } from '../../../components/ui/stat-card'
import { TableEmptyState, TableSkeletonRows } from '../../../components/ui/table-state'
import { useToast } from '../../../components/ui/use-toast'
import { friendlySupabaseError } from '../../../lib/friendly-error'
import { paginateItems } from '../../../lib/pagination'
import { supabase } from '../../../lib/supabase'
import type { QueueStatus, QueueTicketDetail } from '../../../types/queue'
import {
  callNextQueue,
  fetchQueueTickets,
  fetchSchedules,
  updateQueueStatus,
} from '../services/queue-service'

const activeStatuses = ['waiting', 'called', 'serving'] as const
const pageSize = 8
const today = toDateInputValue(new Date())
const queueStatusOptions: Array<{ label: string; value: QueueStatus | 'all' }> = [
  { label: 'Semua status', value: 'all' },
  { label: 'Menunggu', value: 'waiting' },
  { label: 'Dipanggil', value: 'called' },
  { label: 'Dilayani', value: 'serving' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Dilewati', value: 'skipped' },
  { label: 'Batal', value: 'cancelled' },
]

type PendingQueueAction =
  | {
      type: 'call-next'
    }
  | {
      status: QueueStatus
      ticket: QueueTicketDetail
      type: 'update-status'
    }

function isActiveStatus(status: QueueStatus) {
  return activeStatuses.some((activeStatus) => activeStatus === status)
}

export function QueueManagementPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [detailTicket, setDetailTicket] = useState<QueueTicketDetail | null>(null)
  const [page, setPage] = useState(1)
  const [pendingAction, setPendingAction] = useState<PendingQueueAction | null>(null)
  const [polyclinicFilter, setPolyclinicFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all')

  const schedulesQuery = useQuery({
    queryKey: ['schedules', today],
    queryFn: () => fetchSchedules(today),
  })

  const schedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data])
  const polyclinicOptions = useMemo(
    () =>
      Array.from(
        new Map(
          schedules.map((schedule) => [
            schedule.polyclinic_id,
            schedule.polyclinic_name,
          ]),
        ),
      ),
    [schedules],
  )
  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        const matchesPolyclinic =
          polyclinicFilter === 'all' || schedule.polyclinic_id === polyclinicFilter

        return matchesPolyclinic
      }),
    [polyclinicFilter, schedules],
  )
  const activeSessionId =
    selectedSessionId &&
    filteredSchedules.some((schedule) => schedule.queue_session_id === selectedSessionId)
      ? selectedSessionId
      : filteredSchedules[0]?.queue_session_id ?? null

  const selectedSchedule = filteredSchedules.find(
    (schedule) => schedule.queue_session_id === activeSessionId,
  )

  const ticketsQuery = useQuery({
    queryKey: ['queue-tickets', activeSessionId],
    queryFn: () => fetchQueueTickets(activeSessionId!),
    enabled: Boolean(activeSessionId),
  })

  useEffect(() => {
    if (!activeSessionId) return

    const channel = supabase
      .channel(`admin-queue-${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_tickets',
          filter: `queue_session_id=eq.${activeSessionId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['queue-tickets', activeSessionId],
          })
          void queryClient.invalidateQueries({ queryKey: ['schedules'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeSessionId, queryClient])

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data])
  const filteredTickets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === 'all' || ticket.status === statusFilter
      const searchableText = [
        ticket.queue_code,
        ticket.patient_name,
        ticket.polyclinic_name,
        ticket.doctor_name,
      ]
        .join(' ')
        .toLowerCase()

      return matchesStatus && searchableText.includes(normalizedSearch)
    })
  }, [searchTerm, statusFilter, tickets])
  const paginatedTickets = useMemo(
    () => paginateItems(filteredTickets, page, pageSize),
    [filteredTickets, page],
  )

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      waiting: tickets.filter((ticket) => ticket.status === 'waiting').length,
      active: tickets.filter((ticket) => isActiveStatus(ticket.status)).length,
      completed: tickets.filter((ticket) => ticket.status === 'completed').length,
    }
  }, [tickets])
  const hasUnresolvedCall = tickets.some((ticket) =>
    ticket.status === 'called' || ticket.status === 'serving',
  )
  const currentTicket = tickets.find(
    (ticket) => ticket.status === 'called' || ticket.status === 'serving',
  )

  const callNextMutation = useMutation({
    mutationFn: () => callNextQueue(activeSessionId!),
    onSuccess: () => {
      notify({
        message: 'Pasien berikutnya berhasil dipanggil.',
        title: 'Antrean diperbarui',
        tone: 'success',
      })
      setPendingAction(null)
      void ticketsQuery.refetch()
      void schedulesQuery.refetch()
    },
    onError: (error) => {
      notify({
        message: friendlySupabaseError(
          error,
          'Coba refresh data antrean lalu ulangi aksi.',
        ),
        title: 'Aksi gagal',
        tone: 'danger',
      })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({
      ticketId,
      status,
    }: {
      ticketId: string
      status: QueueStatus
    }) => updateQueueStatus(ticketId, status),
    onSuccess: () => {
      notify({
        message: 'Status antrean berhasil diperbarui.',
        title: 'Antrean diperbarui',
        tone: 'success',
      })
      setPendingAction(null)
      void ticketsQuery.refetch()
      void schedulesQuery.refetch()
    },
    onError: (error) => {
      notify({
        message: friendlySupabaseError(
          error,
          'Coba refresh data antrean lalu ulangi aksi.',
        ),
        title: 'Aksi gagal',
        tone: 'danger',
      })
    },
  })

  const confirmState = buildConfirmState(pendingAction)
  const actionError = callNextMutation.error ?? updateStatusMutation.error

  function confirmPendingAction() {
    if (!pendingAction) return

    if (pendingAction.type === 'call-next') {
      callNextMutation.mutate()
      return
    }

    updateStatusMutation.mutate({
      status: pendingAction.status,
      ticketId: pendingAction.ticket.ticket_id,
    })
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
            <Button
              disabled={
                !activeSessionId ||
                callNextMutation.isPending ||
                hasUnresolvedCall ||
                stats.waiting === 0
              }
              onClick={() => setPendingAction({ type: 'call-next' })}
            >
              {callNextMutation.isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Megaphone size={16} />
              )}
              Panggil Berikutnya
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void ticketsQuery.refetch()
                void schedulesQuery.refetch()
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
            </>
          }
          description="Panggil, layani, dan selesaikan antrean pasien secara real-time."
          eyebrow="Queue Control"
          title="Antrean Hari Ini"
        />

        {actionError ? (
          <FeedbackBanner title="Aksi antrean gagal diproses" tone="danger">
            {friendlySupabaseError(
              actionError,
              'Coba refresh data antrean lalu ulangi aksi.',
            )}
          </FeedbackBanner>
        ) : null}

        <Card className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 className="font-black text-slate-950">Kontrol Operasional</h3>
              <p className="text-sm text-slate-500">
                {filteredSchedules.length} sesi buka untuk pelayanan hari ini, {formatDateLabel(today)}.
                {currentTicket
                  ? ` Nomor ${currentTicket.queue_code} sedang ${currentTicket.status === 'serving' ? 'dilayani' : 'dipanggil'}.`
                  : ' Tidak ada nomor yang sedang dipanggil.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPolyclinicFilter('all')
                  setSearchTerm('')
                  setStatusFilter('all')
                  setSelectedSessionId(null)
                  setPage(1)
                }}
              >
                <FilterX size={16} />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            helper="Semua tiket di sesi ini"
            icon={<UsersRound size={20} />}
            label="Total"
            tone="teal"
            value={stats.total}
          />
          <StatCard
            helper="Belum dipanggil"
            icon={<Clock3 size={20} />}
            label="Menunggu"
            tone="blue"
            value={stats.waiting}
          />
          <StatCard
            helper="Waiting, called, serving"
            icon={<Activity size={20} />}
            label="Aktif"
            tone="amber"
            value={stats.active}
          />
          <StatCard
            helper="Pelayanan selesai"
            icon={<CheckCircle2 size={20} />}
            label="Selesai"
            tone="emerald"
            value={stats.completed}
          />
        </div>

        <Card className="overflow-hidden">
          <div className="grid gap-4 p-4 xl:grid-cols-[1fr_360px] xl:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-teal-700">
                Sesi Aktif
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr]">
                <Field label="Poli">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={polyclinicFilter}
                    onChange={(event) => {
                      setPolyclinicFilter(event.target.value)
                      setSelectedSessionId(null)
                      setPage(1)
                    }}
                  >
                    <option value="all">Semua poli</option>
                    {polyclinicOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Jadwal / Dokter">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={activeSessionId ?? ''}
                    onChange={(event) => {
                      setSelectedSessionId(event.target.value || null)
                      setPage(1)
                    }}
                  >
                    {filteredSchedules.length === 0 ? (
                      <option value="">Tidak ada sesi untuk filter ini</option>
                    ) : null}
                    {filteredSchedules.map((schedule) => (
                      <option
                        key={schedule.schedule_id}
                        value={schedule.queue_session_id ?? ''}
                      >
                        {schedule.polyclinic_name} - {schedule.doctor_name} (
                        {schedule.start_time.slice(0, 5)}-
                        {schedule.end_time.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">
                    {selectedSchedule?.polyclinic_name ?? 'Belum ada sesi'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-300">
                    {selectedSchedule
                      ? `${selectedSchedule.branch_name} - ${selectedSchedule.start_time.slice(0, 5)}-${selectedSchedule.end_time.slice(0, 5)}`
                      : 'Buka jadwal praktik terlebih dahulu.'}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <Stethoscope size={20} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniSessionStat
                  label="Kuota sisa"
                  value={
                    selectedSchedule
                      ? `${selectedSchedule.remaining_quota}/${selectedSchedule.quota_limit}`
                      : '-'
                  }
                />
                <MiniSessionStat
                  label="Nomor terakhir"
                  value={selectedSchedule?.last_number ?? '-'}
                />
                <MiniSessionStat label="Sedang aktif" value={currentTicket?.queue_code ?? '-'} />
                <MiniSessionStat label="Menunggu" value={stats.waiting} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                  <h3 className="font-black">Daftar Pasien</h3>
                <p className="text-sm text-slate-500">
                  Menampilkan {filteredTickets.length} dari {tickets.length} tiket.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(220px,280px)_180px]">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-3 text-slate-400"
                    size={17}
                  />
                  <Input
                    className="pl-10"
                    placeholder="Cari pasien / nomor"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <select
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as QueueStatus | 'all')
                    setPage(1)
                  }}
                >
                  {queueStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nomor</th>
                  <th className="px-4 py-3">Pasien</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Estimasi</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ticketsQuery.isLoading ? (
                  <TableSkeletonRows columns={5} />
                ) : filteredTickets.length === 0 ? (
                  <TableEmptyState
                    colSpan={5}
                    description={
                      tickets.length === 0
                        ? 'Belum ada pasien yang mengambil nomor di sesi ini.'
                        : 'Coba ubah kata kunci pencarian atau filter status.'
                    }
                    title={
                      tickets.length === 0
                        ? 'Belum ada antrean'
                        : 'Tidak ada pasien yang cocok'
                    }
                  />
                ) : (
                  paginatedTickets.items.map((ticket) => (
                    <tr className="transition hover:bg-slate-50/80" key={ticket.ticket_id}>
                      <td className="px-4 py-3">
                        <span className="rounded-lg bg-teal-50 px-3 py-1 font-black text-teal-700">
                          {ticket.queue_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {ticket.patient_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ticket.polyclinic_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {ticket.estimated_wait_minutes} menit
                        <p className="text-xs font-semibold text-slate-500">
                          {Math.max(
                            ticket.queue_number - ticket.current_number - 1,
                            0,
                          )}{' '}
                          nomor sebelum pasien
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setDetailTicket(ticket)}
                          >
                            <Eye size={16} />
                            Detail
                          </Button>
                          <QueueRowActions
                            ticket={ticket}
                            onAction={(status) =>
                              setPendingAction({
                                status,
                                ticket,
                                type: 'update-status',
                              })
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={paginatedTickets.page}
            onPageChange={setPage}
            pageSize={pageSize}
            totalItems={filteredTickets.length}
          />
        </Card>

        <ConfirmDialog
          confirmLabel={confirmState.confirmLabel}
          description={confirmState.description}
          isLoading={callNextMutation.isPending || updateStatusMutation.isPending}
          open={Boolean(pendingAction)}
          title={confirmState.title}
          tone={confirmState.tone}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
        />
        <FormDrawer
          description="Detail pasien, posisi antrean, dan jadwal layanan."
          open={Boolean(detailTicket)}
          title="Detail Antrean"
          onClose={() => setDetailTicket(null)}
        >
          {detailTicket ? (
            <TicketDetailPanel
              ticket={detailTicket}
              onAction={(status) => {
                setPendingAction({
                  status,
                  ticket: detailTicket,
                  type: 'update-status',
                })
                setDetailTicket(null)
              }}
            />
          ) : null}
        </FormDrawer>
      </div>
    </AdminLayout>
  )
}

function QueueRowActions({
  onAction,
  ticket,
}: {
  onAction: (status: QueueStatus) => void
  ticket: QueueTicketDetail
}) {
  if (ticket.status === 'called') {
    return (
      <>
        <Button variant="secondary" onClick={() => onAction('serving')}>
          <Stethoscope size={16} />
          Layani
        </Button>
        <Button variant="ghost" onClick={() => onAction('skipped')}>
          <SkipForward size={16} />
          Lewati
        </Button>
        <Button variant="danger" onClick={() => onAction('cancelled')}>
          <OctagonX size={16} />
          Batal
        </Button>
      </>
    )
  }

  if (ticket.status === 'serving') {
    return (
      <>
        <Button variant="secondary" onClick={() => onAction('completed')}>
          <CheckCircle2 size={16} />
          Selesai
        </Button>
        <Button variant="ghost" onClick={() => onAction('skipped')}>
          <SkipForward size={16} />
          Lewati
        </Button>
      </>
    )
  }

  if (ticket.status === 'waiting') {
    return (
      <Button variant="danger" onClick={() => onAction('cancelled')}>
        <OctagonX size={16} />
        Batal
      </Button>
    )
  }

  return (
    <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">
      Final
    </span>
  )
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}

function TicketDetailPanel({
  onAction,
  ticket,
}: {
  onAction: (status: QueueStatus) => void
  ticket: QueueTicketDetail
}) {
  const remaining = Math.max(ticket.queue_number - ticket.current_number - 1, 0)

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-teal-700">
              {ticket.queue_code}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {ticket.patient_name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {ticket.polyclinic_name} - {ticket.doctor_name}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-black text-slate-950">Posisi antrean</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailMetric label="Nomor pasien" value={ticket.queue_number} />
          <DetailMetric label="Nomor dipanggil" value={ticket.current_number} />
          <DetailMetric label="Sisa sebelum pasien" value={remaining} />
            <DetailMetric
              label="Perkiraan tunggu"
              value={`~ ${ticket.estimated_wait_minutes} menit`}
            />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-black text-slate-950">Jadwal</h3>
        <div className="grid gap-3">
          <DetailMetric label="Cabang" value={ticket.branch_name} />
          <DetailMetric label="Tanggal" value={ticket.schedule_date} />
          <DetailMetric
            label="Jam praktik"
            value={`${ticket.start_time.slice(0, 5)}-${ticket.end_time.slice(0, 5)}`}
          />
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={ticket.status !== 'called'}
          variant="secondary"
          onClick={() => onAction('serving')}
        >
          <Stethoscope size={16} />
          Layani
        </Button>
        <Button
          disabled={ticket.status !== 'serving'}
          variant="secondary"
          onClick={() => onAction('completed')}
        >
          <CheckCircle2 size={16} />
          Selesai
        </Button>
        <Button
          disabled={!isActiveStatus(ticket.status)}
          variant="ghost"
          onClick={() => onAction('skipped')}
        >
          <SkipForward size={16} />
          Lewati
        </Button>
        <Button
          disabled={!isActiveStatus(ticket.status)}
          variant="danger"
          onClick={() => onAction('cancelled')}
        >
          <OctagonX size={16} />
          Batalkan
        </Button>
      </div>
    </div>
  )
}

function DetailMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  )
}

function MiniSessionStat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-xs font-bold text-slate-300">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function buildConfirmState(action: PendingQueueAction | null) {
  if (!action) {
    return {
      confirmLabel: 'Konfirmasi',
      description: '',
      title: '',
      tone: 'default' as const,
    }
  }

  if (action.type === 'call-next') {
    return {
      confirmLabel: 'Panggil',
      description: 'Sistem akan memanggil pasien waiting paling awal pada jadwal aktif.',
      title: 'Panggil antrean berikutnya?',
      tone: 'default' as const,
    }
  }

  const labels: Record<QueueStatus, string> = {
    cancelled: 'Batalkan antrean',
    called: 'Panggil antrean',
    completed: 'Selesaikan pelayanan',
    expired: 'Kedaluwarsakan antrean',
    serving: 'Mulai pelayanan',
    skipped: 'Lewati antrean',
    waiting: 'Kembalikan ke menunggu',
  }

  return {
    confirmLabel:
      action.status === 'cancelled'
        ? 'Batalkan'
        : action.status === 'skipped'
          ? 'Lewati'
          : 'Konfirmasi',
    description: `${labels[action.status]} untuk nomor ${action.ticket.queue_code} atas nama ${action.ticket.patient_name}.`,
    title: `${labels[action.status]}?`,
    tone:
      action.status === 'cancelled' || action.status === 'skipped'
        ? ('danger' as const)
        : ('default' as const),
  }
}

function formatDateLabel(dateValue: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parseDateInputValue(dateValue))
}

function parseDateInputValue(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const labels: Record<QueueStatus, string> = {
    waiting: 'Menunggu',
    called: 'Dipanggil',
    serving: 'Dilayani',
    completed: 'Selesai',
    skipped: 'Dilewati',
    cancelled: 'Batal',
    expired: 'Kedaluwarsa',
  }
  const tone =
    status === 'waiting'
      ? 'bg-blue-50 text-blue-700'
      : status === 'called'
        ? 'bg-amber-50 text-amber-700'
        : status === 'serving'
          ? 'bg-teal-50 text-teal-700'
          : status === 'completed'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {labels[status]}
    </span>
  )
}
