import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarPlus,
  CalendarRange,
  Clock3,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  X,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { FeedbackBanner } from '../../../components/ui/feedback-banner'
import { Input } from '../../../components/ui/input'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import { friendlySupabaseError } from '../../../lib/friendly-error'
import type { ScheduleAvailability, ScheduleStatus } from '../../../types/queue'
import {
  createSchedule,
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
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ScheduleDraft>(emptyDraft)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingSave, setPendingSave] = useState<PendingScheduleSave | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState(today)
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

  const filteredPolyclinics =
    references?.polyclinics.filter(
      (polyclinic) => !draft.branch_id || polyclinic.branch_id === draft.branch_id,
    ) ?? []

  const saveMutation = useMutation({
    mutationFn: (payload: SchedulePayload) =>
      editingScheduleId
        ? updateSchedule(editingScheduleId, payload)
        : createSchedule(payload),
    onSuccess: async () => {
      setNotice({
        text: editingScheduleId
          ? 'Jadwal berhasil diperbarui.'
          : 'Jadwal baru berhasil dibuat.',
        tone: 'success',
      })
      setEditingScheduleId(null)
      setDraft(emptyDraft)
      setPendingSave(null)
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      setNotice({
        text: friendlySupabaseError(error, 'Gagal menyimpan jadwal.'),
        title: 'Jadwal gagal disimpan',
        tone: 'danger',
      })
    },
  })

  function updateDraft(key: keyof ScheduleDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === 'branch_id' ? { polyclinic_id: '' } : {}),
    }))
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
  }

  function resetForm() {
    setNotice(null)
    setEditingScheduleId(null)
    setDraft(emptyDraft)
    setPendingSave(null)
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

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">
                  {editingScheduleId ? 'Edit Jadwal' : 'Tambah Jadwal'}
                </h3>
                <p className="text-sm text-slate-500">
                  Jadwal aktif otomatis disiapkan sebagai sesi antrean.
                </p>
              </div>
              <CalendarPlus className="text-teal-600" size={22} />
            </div>

            {notice ? (
              <div className="mb-4">
                <FeedbackBanner title={notice.title} tone={notice.tone}>
                  {notice.text}
                </FeedbackBanner>
              </div>
            ) : null}

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
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value)}
                  />
                  <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as ScheduleStatus | 'all')
                    }
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
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                        Memuat jadwal...
                      </td>
                    </tr>
                  ) : filteredSchedules.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                        Tidak ada jadwal yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSchedules.map((schedule) => (
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
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              onClick={() => startEdit(schedule)}
                            >
                              <Pencil size={16} />
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
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
      </div>
    </AdminLayout>
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
