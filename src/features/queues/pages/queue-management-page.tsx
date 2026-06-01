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
import type {
  QueueStatus,
  QueueTicketDetail,
  QueueTicketTimelineItem,
} from '../../../types/queue'
import {
  callNextQueue,
  fetchQueueTickets,
  fetchQueueTicketTimeline,
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
  const [actionReason, setActionReason] = useState('')
  const [actionReasonError, setActionReasonError] = useState<string | null>(null)
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
  const waitingTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'waiting'),
    [tickets],
  )
  const activeTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) => ticket.status === 'called' || ticket.status === 'serving',
      ),
    [tickets],
  )
  const finalTickets = useMemo(
    () => tickets.filter((ticket) => !isActiveStatus(ticket.status)),
    [tickets],
  )
  const hasUnresolvedCall = tickets.some((ticket) =>
    ticket.status === 'called' || ticket.status === 'serving',
  )
  const currentTicket = tickets.find(
    (ticket) => ticket.status === 'called' || ticket.status === 'serving',
  )
  const callNextGuidance = currentTicket
    ? `Selesaikan, lewati, atau batalkan ${currentTicket.queue_code} sebelum memanggil nomor berikutnya.`
    : stats.waiting === 0
      ? 'Belum ada pasien waiting pada sesi ini.'
      : 'Siap memanggil pasien waiting paling awal.'

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
      message,
      ticketId,
      status,
    }: {
      message?: string
      ticketId: string
      status: QueueStatus
    }) => updateQueueStatus(ticketId, status, message),
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

    if (requiresReason(pendingAction.status) && actionReason.trim().length < 5) {
      setActionReasonError('Tulis alasan minimal 5 karakter agar histori pasien jelas.')
      return
    }

    updateStatusMutation.mutate({
      message: actionReason.trim() || undefined,
      status: pendingAction.status,
      ticketId: pendingAction.ticket.ticket_id,
    })
  }

  function openPendingAction(action: PendingQueueAction) {
    setPendingAction(action)
    setActionReason('')
    setActionReasonError(null)
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
              onClick={() => openPendingAction({ type: 'call-next' })}
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

        {hasUnresolvedCall ? (
          <FeedbackBanner title="Panggil berikutnya terkunci" tone="warning">
            {callNextGuidance}
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

        <CurrentActivePanel
          currentTicket={currentTicket}
          isBusy={updateStatusMutation.isPending}
          waitingCount={stats.waiting}
          onAction={(ticket, status) =>
            openPendingAction({
              status,
              ticket,
              type: 'update-status',
            })
          }
        />

        <div className="grid gap-3 lg:grid-cols-3">
          <QueueStatusSection
            description="Nomor yang belum dipanggil petugas."
            emptyLabel="Tidak ada pasien menunggu"
            tickets={waitingTickets}
            title="Menunggu"
          />
          <QueueStatusSection
            description="Nomor yang sedang dipanggil atau dilayani."
            emptyLabel="Tidak ada antrean aktif"
            tickets={activeTickets}
            title="Aktif"
          />
          <QueueStatusSection
            description="Tiket yang sudah selesai, dilewati, atau dibatalkan."
            emptyLabel="Belum ada riwayat final"
            tickets={finalTickets}
            title="Riwayat Hari Ini"
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
                              openPendingAction({
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
          onCancel={() => {
            setPendingAction(null)
            setActionReason('')
            setActionReasonError(null)
          }}
          onConfirm={confirmPendingAction}
        >
          {confirmState.requiresReason ? (
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Alasan untuk pasien dan histori
              </span>
              <textarea
                className="min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                placeholder={
                  pendingAction?.type === 'update-status' &&
                  pendingAction.status === 'skipped'
                    ? 'Contoh: Pasien tidak hadir saat dipanggil.'
                    : 'Contoh: Pasien meminta pembatalan antrean.'
                }
                value={actionReason}
                onChange={(event) => {
                  setActionReason(event.target.value)
                  setActionReasonError(null)
                }}
              />
              {actionReasonError ? (
                <span className="mt-1.5 block text-sm font-bold text-rose-600">
                  {actionReasonError}
                </span>
              ) : null}
            </label>
          ) : null}
        </ConfirmDialog>
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
                openPendingAction({
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
        <Button onClick={() => onAction('serving')}>
          <Stethoscope size={16} />
          Layani
        </Button>
        <Button variant="ghost" onClick={() => onAction('skipped')}>
          <SkipForward size={16} />
          Lewati
        </Button>
        <Button variant="danger" onClick={() => onAction('cancelled')}>
          <OctagonX size={16} />
          Batalkan
        </Button>
      </>
    )
  }

  if (ticket.status === 'serving') {
    return (
      <>
        <Button onClick={() => onAction('completed')}>
          <CheckCircle2 size={16} />
          Selesai
        </Button>
        <Button variant="ghost" onClick={() => onAction('skipped')}>
          <SkipForward size={16} />
          Lewati
        </Button>
        <Button variant="danger" onClick={() => onAction('cancelled')}>
          <OctagonX size={16} />
          Batalkan
        </Button>
      </>
    )
  }

  if (ticket.status === 'waiting') {
    return (
      <Button variant="danger" onClick={() => onAction('cancelled')}>
        <OctagonX size={16} />
        Batalkan
      </Button>
    )
  }

  return <FinalStatusPill status={ticket.status} />
}

function FinalStatusPill({ status }: { status: QueueStatus }) {
  const labels: Record<QueueStatus, string> = {
    waiting: 'Menunggu',
    called: 'Dipanggil',
    serving: 'Dilayani',
    completed: 'Final: Selesai',
    skipped: 'Final: Dilewati',
    cancelled: 'Final: Dibatalkan',
    expired: 'Final: Kedaluwarsa',
  }
  const tone =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'cancelled'
        ? 'bg-rose-50 text-rose-700'
        : status === 'skipped'
          ? 'bg-orange-50 text-orange-700'
          : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-lg px-3 py-2 text-xs font-black ${tone}`}>
      {labels[status]}
    </span>
  )
}

function CurrentActivePanel({
  currentTicket,
  isBusy,
  onAction,
  waitingCount,
}: {
  currentTicket?: QueueTicketDetail
  isBusy: boolean
  onAction: (ticket: QueueTicketDetail, status: QueueStatus) => void
  waitingCount: number
}) {
  if (!currentTicket) {
    return (
      <Card className="border-dashed border-teal-200 bg-teal-50/50 p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-teal-700">
              Antrean Aktif
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              Tidak ada pasien yang sedang dipanggil
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {waitingCount > 0
                ? `${waitingCount} pasien menunggu. Gunakan tombol Panggil Berikutnya untuk mulai pelayanan.`
                : 'Sesi ini belum memiliki pasien waiting.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-teal-700 shadow-sm shadow-teal-900/5">
            Siap Operasional
          </div>
        </div>
      </Card>
    )
  }

  const isServing = currentTicket.status === 'serving'

  return (
    <Card className="overflow-hidden border-teal-200">
      <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
        <div className="bg-slate-950 p-6 text-white">
          <p className="text-xs font-black uppercase tracking-wide text-teal-200">
            Sedang {isServing ? 'Dilayani' : 'Dipanggil'}
          </p>
          <p className="mt-3 text-5xl font-black tracking-tight">
            {currentTicket.queue_code}
          </p>
          <div className="mt-3">
            <StatusBadge status={currentTicket.status} />
          </div>
        </div>
        <div className="p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <h3 className="text-2xl font-black text-slate-950">
                {currentTicket.patient_name}
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {currentTicket.polyclinic_name} - {currentTicket.doctor_name}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isServing
                  ? 'Pasien sedang dalam proses pelayanan. Selesaikan setelah layanan tuntas, atau batalkan/lewati dengan alasan jika pelayanan tidak bisa dilanjutkan.'
                  : 'Pasien sudah dipanggil. Mulai pelayanan ketika pasien hadir, atau lewati/batalkan dengan alasan jika diperlukan.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {currentTicket.status === 'called' ? (
                <Button
                  disabled={isBusy}
                  onClick={() => onAction(currentTicket, 'serving')}
                >
                  <Stethoscope size={16} />
                  Layani
                </Button>
              ) : (
                <Button
                  disabled={isBusy}
                  onClick={() => onAction(currentTicket, 'completed')}
                >
                  <CheckCircle2 size={16} />
                  Selesai
                </Button>
              )}
              <Button
                disabled={isBusy}
                variant="ghost"
                onClick={() => onAction(currentTicket, 'skipped')}
              >
                <SkipForward size={16} />
                Lewati
              </Button>
              <Button
                disabled={isBusy}
                variant="danger"
                onClick={() => onAction(currentTicket, 'cancelled')}
              >
                <OctagonX size={16} />
                Batalkan oleh Petugas
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function QueueStatusSection({
  description,
  emptyLabel,
  tickets,
  title,
}: {
  description: string
  emptyLabel: string
  tickets: QueueTicketDetail[]
  title: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          {tickets.length}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {tickets.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">
            {emptyLabel}
          </p>
        ) : (
          tickets.slice(0, 4).map((ticket) => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"
              key={ticket.ticket_id}
            >
              <div>
                <p className="font-black text-slate-950">{ticket.queue_code}</p>
                <p className="text-xs font-semibold text-slate-500">
                  {ticket.patient_name}
                </p>
              </div>
              <StatusBadge status={ticket.status} />
            </div>
          ))
        )}
        {tickets.length > 4 ? (
          <p className="text-xs font-bold text-slate-500">
            +{tickets.length - 4} tiket lain ada di tabel detail.
          </p>
        ) : null}
      </div>
    </Card>
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
  const timelineQuery = useQuery({
    queryKey: ['queue-ticket-timeline', ticket.ticket_id],
    queryFn: () => fetchQueueTicketTimeline(ticket.ticket_id),
  })

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

      {ticket.status_reason ? (
        <Card className="border-rose-100 bg-rose-50 p-5">
          <h3 className="mb-2 font-black text-rose-950">Catatan status</h3>
          <p className="text-sm font-semibold leading-6 text-rose-700">
            {ticket.status_reason}
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <h3 className="mb-3 font-black text-slate-950">Timeline antrean</h3>
        {timelineQuery.isLoading ? (
          <p className="text-sm font-semibold text-slate-500">
            Memuat timeline...
          </p>
        ) : timelineQuery.data && timelineQuery.data.length > 0 ? (
          <QueueTimeline events={timelineQuery.data} />
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">
            Belum ada event tercatat untuk tiket ini.
          </p>
        )}
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

function QueueTimeline({ events }: { events: QueueTicketTimelineItem[] }) {
  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const status = queueStatusMeta(event.new_status)
        const isLast = index === events.length - 1

        return (
          <div className="flex gap-3" key={event.event_id}>
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  status.backgroundClass,
                  status.textClass,
                ].join(' ')}
              >
                {status.icon}
              </div>
              {!isLast ? <div className="h-10 w-px bg-slate-200" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black text-slate-950">{status.label}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black uppercase text-slate-500">
                  {actorLabel(event)}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                {event.message ?? status.fallbackMessage}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {formatDateTimeLabel(event.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function queueStatusMeta(status: QueueStatus) {
  const meta: Record<
    QueueStatus,
    {
      backgroundClass: string
      fallbackMessage: string
      icon: ReactNode
      label: string
      textClass: string
    }
  > = {
    waiting: {
      backgroundClass: 'bg-blue-50',
      fallbackMessage: 'Nomor antrean dibuat dan masuk daftar tunggu.',
      icon: <Clock3 size={17} />,
      label: 'Menunggu',
      textClass: 'text-blue-700',
    },
    called: {
      backgroundClass: 'bg-amber-50',
      fallbackMessage: 'Nomor antrean dipanggil oleh petugas.',
      icon: <Megaphone size={17} />,
      label: 'Dipanggil',
      textClass: 'text-amber-700',
    },
    serving: {
      backgroundClass: 'bg-teal-50',
      fallbackMessage: 'Pelayanan pasien dimulai.',
      icon: <Stethoscope size={17} />,
      label: 'Dilayani',
      textClass: 'text-teal-700',
    },
    completed: {
      backgroundClass: 'bg-emerald-50',
      fallbackMessage: 'Pelayanan pasien selesai.',
      icon: <CheckCircle2 size={17} />,
      label: 'Selesai',
      textClass: 'text-emerald-700',
    },
    skipped: {
      backgroundClass: 'bg-orange-50',
      fallbackMessage: 'Nomor antrean dilewati oleh petugas.',
      icon: <SkipForward size={17} />,
      label: 'Dilewati',
      textClass: 'text-orange-700',
    },
    cancelled: {
      backgroundClass: 'bg-rose-50',
      fallbackMessage: 'Antrean dibatalkan.',
      icon: <OctagonX size={17} />,
      label: 'Dibatalkan',
      textClass: 'text-rose-700',
    },
    expired: {
      backgroundClass: 'bg-slate-100',
      fallbackMessage: 'Antrean kedaluwarsa.',
      icon: <Clock3 size={17} />,
      label: 'Kedaluwarsa',
      textClass: 'text-slate-600',
    },
  }
  return meta[status]
}

function actorLabel(event: QueueTicketTimelineItem) {
  if (event.actor_type === 'patient') return 'Pasien'
  if (event.actor_type === 'staff') return event.actor_name ?? 'Petugas'
  return 'Sistem'
}

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
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
      requiresReason: false,
      title: '',
      tone: 'default' as const,
    }
  }

  if (action.type === 'call-next') {
    return {
      confirmLabel: 'Panggil',
      description: 'Sistem akan memanggil pasien waiting paling awal pada jadwal aktif.',
      requiresReason: false,
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
    requiresReason: requiresReason(action.status),
    title: `${labels[action.status]}?`,
    tone:
      action.status === 'cancelled' || action.status === 'skipped'
        ? ('danger' as const)
        : ('default' as const),
  }
}

function requiresReason(status: QueueStatus) {
  return status === 'cancelled' || status === 'skipped'
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
    cancelled: 'Dibatalkan',
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
            : status === 'cancelled'
              ? 'bg-rose-50 text-rose-700'
              : status === 'skipped'
                ? 'bg-orange-50 text-orange-700'
                : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {labels[status]}
    </span>
  )
}
