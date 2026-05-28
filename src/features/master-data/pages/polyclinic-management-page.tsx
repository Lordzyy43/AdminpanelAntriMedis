import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import {
  Building2,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

import { AdminLayout } from '../../../components/layout/admin-layout'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { FeedbackBanner } from '../../../components/ui/feedback-banner'
import { Input } from '../../../components/ui/input'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import { friendlySupabaseError } from '../../../lib/friendly-error'
import type { ClinicBranch, Polyclinic } from '../../../types/queue'
import {
  createPolyclinic,
  fetchMasterData,
  updatePolyclinic,
  type PolyclinicPayload,
} from '../services/master-data-service'

type PolyclinicDraft = {
  branch_id: string
  code: string
  description: string
  is_active: boolean
  name: string
  queue_prefix: string
}

const emptyPolyclinicDraft: PolyclinicDraft = {
  branch_id: '',
  code: '',
  description: '',
  is_active: true,
  name: '',
  queue_prefix: '',
}

type Notice = {
  text: string
  title?: string
  tone: 'danger' | 'info' | 'success' | 'warning'
}

type PendingPolyclinicSave = {
  payload: PolyclinicPayload
  polyclinic: Polyclinic | null
}

export function PolyclinicManagementPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<PolyclinicDraft>(emptyPolyclinicDraft)
  const [editingPolyclinicId, setEditingPolyclinicId] = useState<string | null>(
    null,
  )
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingSave, setPendingSave] = useState<PendingPolyclinicSave | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activityFilter, setActivityFilter] = useState<
    'active' | 'all' | 'inactive'
  >('all')

  const masterDataQuery = useQuery({
    queryKey: ['master-data'],
    queryFn: fetchMasterData,
  })

  const branches = useMemo(
    () => masterDataQuery.data?.branches ?? [],
    [masterDataQuery.data?.branches],
  )
  const polyclinics = useMemo(
    () => masterDataQuery.data?.polyclinics ?? [],
    [masterDataQuery.data?.polyclinics],
  )
  const branchNameById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  )

  const stats = useMemo(
    () => ({
      active: polyclinics.filter((polyclinic) => polyclinic.is_active).length,
      inactive: polyclinics.filter((polyclinic) => !polyclinic.is_active).length,
      total: polyclinics.length,
    }),
    [polyclinics],
  )

  const filteredPolyclinics = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return polyclinics.filter((polyclinic) => {
      const matchesActivity =
        activityFilter === 'all' ||
        (activityFilter === 'active'
          ? polyclinic.is_active
          : !polyclinic.is_active)
      const searchableText = [
        polyclinic.name,
        polyclinic.code,
        polyclinic.queue_prefix,
        polyclinic.description ?? '',
        branchNameById.get(polyclinic.branch_id) ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return matchesActivity && searchableText.includes(normalizedSearch)
    })
  }, [activityFilter, branchNameById, polyclinics, searchTerm])

  const polyclinicMutation = useMutation({
    mutationFn: (payload: PolyclinicPayload) =>
      editingPolyclinicId
        ? updatePolyclinic(editingPolyclinicId, payload)
        : createPolyclinic(payload),
    onSuccess: async () => {
      setNotice({
        text: editingPolyclinicId
          ? 'Data poli berhasil diperbarui.'
          : 'Poli baru berhasil ditambahkan.',
        tone: 'success',
      })
      setPendingSave(null)
      resetForm()
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
      await queryClient.invalidateQueries({ queryKey: ['schedule-references'] })
      await queryClient.invalidateQueries({ queryKey: ['schedule-management'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (error) => {
      setNotice({
        text: friendlySupabaseError(error, 'Gagal menyimpan poli.'),
        title: 'Data poli gagal disimpan',
        tone: 'danger',
      })
    },
  })

  function updateDraft(key: keyof PolyclinicDraft, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      [key]:
        (key === 'queue_prefix' || key === 'code') && typeof value === 'string'
          ? value.toUpperCase()
          : value,
    }))
  }

  function startEdit(polyclinic: Polyclinic) {
    setNotice(null)
    setEditingPolyclinicId(polyclinic.id)
    setDraft({
      branch_id: polyclinic.branch_id,
      code: polyclinic.code,
      description: polyclinic.description ?? '',
      is_active: polyclinic.is_active,
      name: polyclinic.name,
      queue_prefix: polyclinic.queue_prefix,
    })
  }

  function resetForm() {
    setEditingPolyclinicId(null)
    setDraft(emptyPolyclinicDraft)
    setPendingSave(null)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    const payload: PolyclinicPayload = {
      branch_id: draft.branch_id,
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim() || null,
      is_active: draft.is_active,
      name: draft.name.trim(),
      queue_prefix: draft.queue_prefix.trim().toUpperCase(),
    }

    if (!payload.branch_id || !payload.name || !payload.code || !payload.queue_prefix) {
      setNotice({
        text: 'Cabang, nama poli, kode, dan prefix antrean wajib diisi.',
        tone: 'warning',
      })
      return
    }

    if (payload.queue_prefix.length > 3) {
      setNotice({
        text: 'Prefix antrean sebaiknya maksimal 3 karakter.',
        tone: 'warning',
      })
      return
    }

    const currentPolyclinic =
      polyclinics.find((polyclinic) => polyclinic.id === editingPolyclinicId) ??
      null

    if (
      editingPolyclinicId &&
      currentPolyclinic?.is_active &&
      !payload.is_active
    ) {
      setPendingSave({ payload, polyclinic: currentPolyclinic })
      return
    }

    polyclinicMutation.mutate(payload)
  }

  function confirmPendingSave() {
    if (!pendingSave) return
    polyclinicMutation.mutate(pendingSave.payload)
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                void masterDataQuery.refetch()
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
          }
          description="Kelola poli, prefix nomor antrean, cabang, dan status aktif layanan."
          eyebrow="Master Data"
          title="Manajemen Poli"
        />

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            helper="Seluruh poli"
            icon={<Building2 size={20} />}
            label="Total Poli"
            tone="teal"
            value={stats.total}
          />
          <StatCard
            helper="Bisa dipakai di jadwal"
            icon={<ToggleRight size={22} />}
            label="Aktif"
            tone="emerald"
            value={stats.active}
          />
          <StatCard
            helper="Disimpan nonaktif"
            icon={<ToggleLeft size={22} />}
            label="Nonaktif"
            tone="slate"
            value={stats.inactive}
          />
        </div>

        {notice ? (
          <FeedbackBanner title={notice.title} tone={notice.tone}>
            {notice.text}
          </FeedbackBanner>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
          <PolyclinicForm
            branches={branches}
            draft={draft}
            editing={Boolean(editingPolyclinicId)}
            loading={polyclinicMutation.isPending}
            onChange={updateDraft}
            onReset={() => {
              setNotice(null)
              resetForm()
            }}
            onSubmit={submitForm}
          />

          <div className="space-y-4">
            <Card className="p-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={17} />
                  <Input
                    className="pl-10"
                    placeholder="Cari poli, kode, prefix, cabang"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  value={activityFilter}
                  onChange={(event) =>
                    setActivityFilter(
                      event.target.value as 'active' | 'all' | 'inactive',
                    )
                  }
                >
                  <option value="all">Semua status</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
            </Card>

            <PolyclinicTable
              branchNameById={branchNameById}
              loading={masterDataQuery.isLoading}
              onEdit={startEdit}
              polyclinics={filteredPolyclinics}
              total={polyclinics.length}
            />
          </div>
        </div>
        <ConfirmDialog
          confirmLabel="Nonaktifkan"
          description={
            pendingSave?.polyclinic
              ? `${pendingSave.polyclinic.name} tidak akan dipakai untuk jadwal baru. Jadwal lama dan antrean historis tetap tersimpan.`
              : 'Poli akan disimpan sebagai nonaktif.'
          }
          isLoading={polyclinicMutation.isPending}
          open={Boolean(pendingSave)}
          title="Nonaktifkan poli?"
          tone="danger"
          onCancel={() => setPendingSave(null)}
          onConfirm={confirmPendingSave}
        />
      </div>
    </AdminLayout>
  )
}

function PolyclinicForm({
  branches,
  draft,
  editing,
  loading,
  onChange,
  onReset,
  onSubmit,
}: {
  branches: ClinicBranch[]
  draft: PolyclinicDraft
  editing: boolean
  loading: boolean
  onChange: (key: keyof PolyclinicDraft, value: string | boolean) => void
  onReset: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Card className="p-5">
      <FormHeader
        icon={<Building2 size={21} />}
        subtitle="Prefix dipakai sebagai kode depan nomor antrean pasien."
        title={editing ? 'Edit Poli' : 'Tambah Poli'}
      />
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Cabang">
          <select
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            value={draft.branch_id}
            onChange={(event) => onChange('branch_id', event.target.value)}
          >
            <option value="">Pilih cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nama poli">
          <Input
            placeholder="Poli Umum"
            value={draft.name}
            onChange={(event) => onChange('name', event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kode">
            <Input
              placeholder="UMUM"
              value={draft.code}
              onChange={(event) => onChange('code', event.target.value)}
            />
          </Field>
          <Field label="Prefix antrean">
            <Input
              maxLength={3}
              placeholder="U"
              value={draft.queue_prefix}
              onChange={(event) => onChange('queue_prefix', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Deskripsi">
          <textarea
            className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            placeholder="Deskripsi layanan poli"
            value={draft.description}
            onChange={(event) => onChange('description', event.target.value)}
          />
        </Field>
        <ToggleField
          active={draft.is_active}
          label="Status poli"
          onChange={(value) => onChange('is_active', value)}
        />
        <FormActions editing={editing} loading={loading} onReset={onReset} />
      </form>
    </Card>
  )
}

function PolyclinicTable({
  branchNameById,
  loading,
  onEdit,
  polyclinics,
  total,
}: {
  branchNameById: Map<string, string>
  loading: boolean
  onEdit: (polyclinic: Polyclinic) => void
  polyclinics: Polyclinic[]
  total: number
}) {
  return (
    <Card className="overflow-hidden">
      <TableHeader
        subtitle={`Menampilkan ${polyclinics.length} dari ${total} poli.`}
        title="Daftar Poli"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Poli</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableEmpty colSpan={5} text="Memuat poli..." />
            ) : polyclinics.length === 0 ? (
              <TableEmpty colSpan={5} text="Belum ada poli." />
            ) : (
              polyclinics.map((polyclinic) => (
                <tr className="transition hover:bg-slate-50/80" key={polyclinic.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{polyclinic.name}</p>
                    <p className="text-xs text-slate-500">
                      {polyclinic.description ?? 'Belum ada deskripsi'}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {branchNameById.get(polyclinic.branch_id) ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-xl bg-teal-50 px-3 py-1 font-black text-teal-700">
                      {polyclinic.queue_prefix}
                    </span>
                    <span className="ml-2 font-bold text-slate-600">
                      {polyclinic.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={polyclinic.is_active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button variant="secondary" onClick={() => onEdit(polyclinic)}>
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

function FormHeader({
  icon,
  subtitle,
  title,
}: {
  icon: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-lg font-black">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        {icon}
      </div>
    </div>
  )
}

function FormActions({
  editing,
  loading,
  onReset,
}: {
  editing: boolean
  loading: boolean
  onReset: () => void
}) {
  return (
    <div className="flex gap-2">
      <Button className="flex-1" disabled={loading} type="submit">
        {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
        {editing ? 'Update' : 'Simpan'}
      </Button>
      <Button variant="secondary" onClick={onReset}>
        Reset
      </Button>
    </div>
  )
}

function ToggleField({
  active,
  label,
  onChange,
}: {
  active: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
      type="button"
      onClick={() => onChange(!active)}
    >
      <span>
        <span className="block text-sm font-bold text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          {active ? 'Data aktif dan bisa dipakai.' : 'Data disimpan nonaktif.'}
        </span>
      </span>
      {active ? (
        <ToggleRight className="text-teal-600" size={28} />
      ) : (
        <ToggleLeft className="text-slate-400" size={28} />
      )}
    </button>
  )
}

function TableHeader({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="border-b border-slate-200 px-4 py-3">
      <h3 className="font-black">{title}</h3>
      {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

function TableEmpty({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-slate-500" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'rounded-full px-3 py-1 text-xs font-black',
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
      ].join(' ')}
    >
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  )
}
