import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarPlus,
  CalendarRange,
  Clock3,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'

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
import type { ScheduleAvailability, ScheduleStatus } from '../../../types/queue'
import {
  createSchedule,
  deleteSchedule,
  fetchScheduleManagementRows,
  fetchScheduleReferences,
  updateSchedule,
  type SchedulePayload,
} from '../services/schedule-service'

type ScheduleDraft = {
  branch_id: string
  polyclinic_id: string
  doctor_id: string
  schedule_date: string
  start_time: string
  end_time: string
  quota_limit: string
  average_service_minutes: string
  status: ScheduleStatus
  notes: string
}

type Notice = {
  text: string
  title?: string
  tone: 'danger' | 'info' | 'success' | 'warning'
}

type PendingScheduleSave = {
  payload: SchedulePayload
  schedule: ScheduleAvailability | null
}

const statusOptions: Array<{ value: ScheduleStatus; label: string }> = [
  { value: 'open', label: 'Buka' },
  { value: 'closed', label: 'Tutup' },
  { value: 'full', label: 'Penuh' },
  { value: 'cancelled', label: 'Batal' },
]

const today = new Date().toISOString().slice(0, 10)
const pageSize = 8

const emptyDraft: ScheduleDraft = {
  branch_id: '',
  polyclinic_id: '',
  doctor_id: '',
  schedule_date: today,
  start_time: '08:00',
  end_time: '12:00',
  quota_limit: '20',
  average_service_minutes: '10',
  status: 'open',
  notes: '',
}

export function ScheduleManagementPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [detailSchedule, setDetailSchedule] = useState<ScheduleAvailability | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<ScheduleDraft>(emptyDraft)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ScheduleAvailability | null>(null)
  const [pendingSave, setPendingSave] = useState<PendingScheduleSave | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState(today)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | 'all'>('all')

  const schedulesQuery = useQuery({
    queryKey: ['schedule-management'],
    queryFn: fetchScheduleManagementRows,
  })

  const referencesQuery = useQuery({
    queryKey: ['schedule-references'],
    queryFn: fetchScheduleReferences,
  })

  const schedules = useMemo(
    () => schedulesQuery.data ?? [],
    [schedulesQuery.data],
  )
  const references = referencesQuery.data

  const stats = useMemo(() => {
    return {
      total: schedules.length,
      open: schedules.filter((schedule) => schedule.status === 'open').length,
      full: schedules.filter((schedule) => schedule.status === 'full').length,
      closed: schedules.filter((schedule) => schedule.status === 'closed').length,
    }
  }, [schedules])

  const filteredSchedules = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return schedules.filter((schedule) => {
      const matchesStatus =
        statusFilter === 'all' || schedule.status === statusFilter
      const matchesDate = !dateFilter || schedule.schedule_date === dateFilter
      const searchableText = [
        schedule.polyclinic_name,
        schedule.doctor_name,
        schedule.branch_name,
        schedule.specialization ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return (
        matchesStatus &&
        matchesDate &&
        searchableText.includes(normalizedSearch)
      )
    })
  }, [dateFilter, schedules, searchTerm, statusFilter])
  const paginatedSchedules = useMemo(
    () => paginateItems(filteredSchedules, page, pageSize),
    [filteredSchedules, page],
  )

  const filteredPolyclinics =
    references?.polyclinics.filter(
      (polyclinic) => !draft.branch_id || polyclinic.branch_id === draft.branch_id,
    ) ?? []

  function defaultDraft(): ScheduleDraft {
    return {
      ...emptyDraft,
      branch_id: references?.branches[0]?.id ?? '',
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload: SchedulePayload) =>
      editingScheduleId
        ? updateSchedule(editingScheduleId, payload)
        : createSchedule(payload),
    onSuccess: async () => {
      const successMessage = editingScheduleId
        ? 'Jadwal berhasil diperbarui.'
        : 'Jadwal baru berhasil dibuat.'
      setNotice({
        text: successMessage,
        tone: 'success',
      })
      notify({ message: successMessage, title: 'Berhasil', tone: 'success' })
      setEditingScheduleId(null)
      setDraft(emptyDraft)
      setPendingSave(null)
      setIsDrawerOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      const message = friendlySupabaseError(error, 'Gagal menyimpan jadwal.')
      setNotice({
        text: message,
        title: 'Jadwal gagal disimpan',
        tone: 'danger',
      })
      notify({ message, title: 'Gagal menyimpan', tone: 'danger' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: async () => {
      const successMessage = 'Jadwal berhasil dihapus.'
      setNotice({ text: successMessage, tone: 'success' })
      notify({ message: successMessage, title: 'Berhasil', tone: 'success' })
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      const message = friendlySupabaseError(error, 'Gagal menghapus jadwal.')
      setNotice({
        text: message,
        title: 'Jadwal gagal dihapus',
        tone: 'danger',
      })
      notify({ message, title: 'Gagal menghapus', tone: 'danger' })
      setPendingDelete(null)
    },
  })

  function updateDraft(key: keyof ScheduleDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === 'branch_id' ? { polyclinic_id: '' } : {}),
    }))
  }

  function startCreate() {
    setNotice(null)
    setEditingScheduleId(null)
    setDraft(defaultDraft())
    setIsDrawerOpen(true)
  }

  function startEdit(schedule: ScheduleAvailability) {
    setNotice(null)
    setEditingScheduleId(schedule.schedule_id)
    setDraft({
      branch_id: schedule.branch_id,
      polyclinic_id: schedule.polyclinic_id,
      doctor_id: schedule.doctor_id,
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      quota_limit: String(schedule.quota_limit),
      average_service_minutes: String(schedule.average_service_minutes),
      status: schedule.status,
      notes: '',
    })
    setIsDrawerOpen(true)
  }

  function resetForm() {
    setNotice(null)
    setEditingScheduleId(null)
    setDraft(emptyDraft)
    setPendingSave(null)
    setIsDrawerOpen(false)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    const payload: SchedulePayload = {
      branch_id: draft.branch_id,
      polyclinic_id: draft.polyclinic_id,
      doctor_id: draft.doctor_id,
      schedule_date: draft.schedule_date,
      start_time: draft.start_time,
      end_time: draft.end_time,
      quota_limit: Number(draft.quota_limit),
      average_service_minutes: Number(draft.average_service_minutes),
      status: draft.status,
      notes: draft.notes.trim() || (editingScheduleId ? undefined : null),
    }

    if (!payload.branch_id || !payload.polyclinic_id || !payload.doctor_id) {
      setNotice({
        text: 'Cabang, poli, dan dokter wajib dipilih.',
        tone: 'warning',
      })
      return
    }

    if (payload.end_time <= payload.start_time) {
      setNotice({
        text: 'Jam selesai harus lebih besar dari jam mulai.',
        tone: 'warning',
      })
      return
    }

    if (payload.quota_limit < 1 || payload.average_service_minutes < 1) {
      setNotice({
        text: 'Kuota dan durasi layanan minimal 1.',
        tone: 'warning',
      })
      return
    }

    const currentSchedule =
      schedules.find((schedule) => schedule.schedule_id === editingScheduleId) ??
      null

    if (editingScheduleId) {
      setPendingSave({ payload, schedule: currentSchedule })
      return
    }

    saveMutation.mutate(payload)
  }

  function confirmPendingSave() {
    if (!pendingSave) return
    saveMutation.mutate(pendingSave.payload)
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
              <Button onClick={startCreate}>
                <Plus size={16} />
                Buat Jadwal
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void schedulesQuery.refetch()
                  void referencesQuery.refetch()
                }}
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </>
          }
          description="Atur sesi praktik, kuota, status buka, dan durasi layanan."
          eyebrow="Schedule Control"
          title="Manajemen Jadwal"
        />

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            helper="Seluruh jadwal praktik"
            icon={<CalendarRange size={20} />}
            label="Total Jadwal"
            tone="teal"
            value={stats.total}
          />
          <StatCard
            helper="Bisa menerima antrean"
            icon={<Clock3 size={20} />}
            label="Buka"
            tone="emerald"
            value={stats.open}
          />
          <StatCard
            helper="Kuota sudah penuh"
            icon={<CalendarPlus size={20} />}
            label="Penuh"
            tone="amber"
            value={stats.full}
          />
          <StatCard
            helper="Tidak menerima antrean"
            icon={<X size={20} />}
            label="Tutup"
            tone="slate"
            value={stats.closed}
          />
        </div>

        {notice && !isDrawerOpen ? (
          <FeedbackBanner title={notice.title} tone={notice.tone}>
            {notice.text}
          </FeedbackBanner>
        ) : null}

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="font-black">Daftar Jadwal Praktik</h3>
                <p className="text-sm text-slate-500">
                  Menampilkan {filteredSchedules.length} dari {schedules.length}{' '}
                  jadwal.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-[minmax(220px,280px)_160px_180px]">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-3 text-slate-400"
                    size={17}
                  />
                  <Input
                    className="pl-10"
                    placeholder="Cari dokter / poli"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(event.target.value)
                    setPage(1)
                  }}
                />
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as ScheduleStatus | 'all')
                    setPage(1)
                  }}
                >
                  <option value="all">Semua status</option>
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Poli & Dokter</th>
                  <th className="px-4 py-3">Jam</th>
                  <th className="px-4 py-3">Kuota</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedulesQuery.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : filteredSchedules.length === 0 ? (
                  <TableEmptyState
                    action={
                      <Button onClick={startCreate}>
                        <Plus size={16} />
                        Buat Jadwal
                      </Button>
                    }
                    colSpan={6}
                    description="Buat jadwal praktik agar aplikasi pasien punya sesi antrean yang bisa dipilih."
                    title={
                      schedules.length === 0
                        ? 'Belum ada jadwal praktik'
                        : 'Tidak ada jadwal yang cocok'
                    }
                  />
                ) : (
                  paginatedSchedules.items.map((schedule) => (
                    <tr className="transition hover:bg-slate-50/80" key={schedule.schedule_id}>
                      <td className="px-4 py-3 font-bold">
                        {schedule.schedule_date}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {schedule.polyclinic_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {schedule.doctor_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-bold">
                          <Clock3 size={15} />
                          {schedule.start_time.slice(0, 5)}-
                          {schedule.end_time.slice(0, 5)}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {schedule.average_service_minutes} menit/pasien
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black">
                          {schedule.total_taken}/{schedule.quota_limit}
                        </p>
                        <p className="text-xs text-slate-500">
                          sisa {schedule.remaining_quota}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <ScheduleStatusBadge status={schedule.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setDetailSchedule(schedule)}
                          >
                            <Eye size={16} />
                            Detail
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => startEdit(schedule)}
                          >
                            <Pencil size={16} />
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => setPendingDelete(schedule)}
                          >
                            <Trash2 size={16} />
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={paginatedSchedules.page}
            onPageChange={setPage}
            pageSize={pageSize}
            totalItems={filteredSchedules.length}
          />
        </Card>

        <FormDrawer
          description="Atur dokter, poli, tanggal, jam praktik, kuota, status, dan durasi rata-rata layanan."
          open={isDrawerOpen}
          title={editingScheduleId ? 'Edit Jadwal' : 'Buat Jadwal'}
          onClose={resetForm}
        >
          {notice ? (
            <div className="mb-4">
              <FeedbackBanner title={notice.title} tone={notice.tone}>
                {notice.text}
              </FeedbackBanner>
            </div>
          ) : null}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">
                  {editingScheduleId ? 'Detail Jadwal' : 'Jadwal Baru'}
                </h3>
                <p className="text-sm text-slate-500">
                  Jadwal aktif otomatis disiapkan sebagai sesi antrean.
                </p>
              </div>
              <CalendarPlus className="text-teal-600" size={22} />
            </div>

            <form className="space-y-4" onSubmit={submitForm}>
              <Field label="Cabang">
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  value={draft.branch_id}
                  onChange={(event) => updateDraft('branch_id', event.target.value)}
                >
                  <option value="">Pilih cabang</option>
                  {references?.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Poli">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={draft.polyclinic_id}
                    onChange={(event) =>
                      updateDraft('polyclinic_id', event.target.value)
                    }
                  >
                    <option value="">Pilih poli</option>
                    {filteredPolyclinics.map((polyclinic) => (
                      <option key={polyclinic.id} value={polyclinic.id}>
                        {polyclinic.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Dokter">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={draft.doctor_id}
                    onChange={(event) => updateDraft('doctor_id', event.target.value)}
                  >
                    <option value="">Pilih dokter</option>
                    {references?.doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Tanggal">
                <Input
                  min={today}
                  type="date"
                  value={draft.schedule_date}
                  onChange={(event) =>
                    updateDraft('schedule_date', event.target.value)
                  }
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mulai">
                  <Input
                    type="time"
                    value={draft.start_time}
                    onChange={(event) => updateDraft('start_time', event.target.value)}
                  />
                </Field>
                <Field label="Selesai">
                  <Input
                    type="time"
                    value={draft.end_time}
                    onChange={(event) => updateDraft('end_time', event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Kuota">
                  <Input
                    min={1}
                    type="number"
                    value={draft.quota_limit}
                    onChange={(event) => updateDraft('quota_limit', event.target.value)}
                  />
                </Field>
                <Field label="Durasi">
                  <Input
                    min={1}
                    type="number"
                    value={draft.average_service_minutes}
                    onChange={(event) =>
                      updateDraft('average_service_minutes', event.target.value)
                    }
                  />
                </Field>
                <Field label="Status">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={draft.status}
                    onChange={(event) =>
                      updateDraft('status', event.target.value as ScheduleStatus)
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" disabled={saveMutation.isPending} type="submit">
                  {saveMutation.isPending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  Simpan
                </Button>
                <Button variant="secondary" onClick={resetForm}>
                  <X size={16} />
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </FormDrawer>
        <FormDrawer
          description="Ringkasan operasional jadwal dan sesi antrean."
          open={Boolean(detailSchedule)}
          title="Detail Jadwal"
          onClose={() => setDetailSchedule(null)}
        >
          {detailSchedule ? (
            <ScheduleDetailPanel
              schedule={detailSchedule}
              onEdit={() => {
                startEdit(detailSchedule)
                setDetailSchedule(null)
              }}
            />
          ) : null}
        </FormDrawer>
        <ConfirmDialog
          confirmLabel="Simpan Perubahan"
          description={buildScheduleConfirmDescription(pendingSave)}
          isLoading={saveMutation.isPending}
          open={Boolean(pendingSave)}
          title="Simpan perubahan jadwal?"
          tone={pendingSave?.schedule?.total_taken ? 'danger' : 'default'}
          onCancel={() => setPendingSave(null)}
          onConfirm={confirmPendingSave}
        />
        <ConfirmDialog
          confirmLabel="Hapus"
          description={buildScheduleDeleteDescription(pendingDelete)}
          icon={<Trash2 size={20} />}
          isLoading={deleteMutation.isPending}
          open={Boolean(pendingDelete)}
          title="Hapus jadwal?"
          tone="danger"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete) deleteMutation.mutate(pendingDelete.schedule_id)
          }}
        />
      </div>
    </AdminLayout>
  )
}

function ScheduleDetailPanel({
  onEdit,
  schedule,
}: {
  onEdit: () => void
  schedule: ScheduleAvailability
}) {
  const quotaUsage =
    schedule.quota_limit === 0
      ? 0
      : Math.round((schedule.total_taken / schedule.quota_limit) * 100)

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-teal-700">
              {schedule.branch_name}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {schedule.polyclinic_name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {schedule.doctor_name}
            </p>
          </div>
          <ScheduleStatusBadge status={schedule.status} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <DetailMetric label="Tanggal" value={schedule.schedule_date} />
          <DetailMetric
            label="Jam praktik"
            value={`${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`}
          />
          <DetailMetric
            label="Durasi layanan"
            value={`${schedule.average_service_minutes} menit/pasien`}
          />
          <DetailMetric
            label="Sesi antrean"
            value={schedule.queue_session_id ? 'Tersedia' : 'Belum tersedia'}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-slate-950">Kapasitas</h3>
          <span className="text-sm font-black text-teal-700">{quotaUsage}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-600"
            style={{ width: `${Math.min(quotaUsage, 100)}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <DetailMetric label="Diambil" value={schedule.total_taken} />
          <DetailMetric label="Kuota" value={schedule.quota_limit} />
          <DetailMetric label="Sisa" value={schedule.remaining_quota} />
        </div>
      </Card>

      <Button className="w-full" variant="secondary" onClick={onEdit}>
        <Pencil size={16} />
        Edit Jadwal
      </Button>
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

function buildScheduleConfirmDescription(pendingSave: PendingScheduleSave | null) {
  const schedule = pendingSave?.schedule
  if (!pendingSave || !schedule) {
    return 'Perubahan jadwal akan disimpan ke database.'
  }

  if (schedule.total_taken > 0) {
    return `Jadwal ini sudah memiliki ${schedule.total_taken} tiket antrean. Perubahan dokter, poli, jam, kuota, atau status dapat memengaruhi pasien yang sedang menunggu.`
  }

  return 'Perubahan jadwal akan memengaruhi pilihan jadwal yang terlihat di aplikasi pasien.'
}

function buildScheduleDeleteDescription(schedule: ScheduleAvailability | null) {
  if (!schedule) return 'Jadwal akan dihapus.'

  if (schedule.total_taken > 0) {
    return `Jadwal ${schedule.polyclinic_name} sudah memiliki ${schedule.total_taken} tiket antrean. Sistem akan menolak hapus permanen; gunakan status Batal atau Tutup agar histori pasien tetap aman.`
  }

  return `Jadwal ${schedule.polyclinic_name} ${schedule.schedule_date} pukul ${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)} akan dihapus permanen karena belum memiliki tiket antrean.`
}

function Field({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}

function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const label =
    statusOptions.find((statusOption) => statusOption.value === status)?.label ??
    status
  const tone =
    status === 'open'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'full'
        ? 'bg-amber-50 text-amber-700'
        : status === 'closed'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-rose-50 text-rose-700'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {label}
    </span>
  )
}
