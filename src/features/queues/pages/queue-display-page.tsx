import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js'
import {
  Activity,
  Clock3,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'

import { Button } from '../../../components/ui/button'
import { formatDateLabel, useTodayInputValue } from '../../../lib/date'
import { supabase } from '../../../lib/supabase'
import type {
  QueueStatus,
  QueueTicketDetail,
  ScheduleAvailability,
} from '../../../types/queue'
import {
  fetchQueueTicketDetail,
  fetchQueueTicketsByDate,
  fetchSchedules,
} from '../services/queue-service'

export function QueueDisplayPage() {
  const queryClient = useQueryClient()
  const today = useTodayInputValue()
  const { isFullscreen, toggleFullscreen } = useFullscreenState()
  const lastAnnouncedTicketRef = useRef<string | null>(null)

    const schedulesQuery = useQuery({
      queryKey: ['queue-display-schedules', today],
      queryFn: () => fetchSchedules(today),
    })
    const ticketsQuery = useQuery({
      queryKey: ['queue-display-tickets', today],
      queryFn: () => fetchQueueTicketsByDate(today),
    })

    const schedules = useMemo(
      () => schedulesQuery.data ?? [],
      [schedulesQuery.data],
    )
    const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data])
    const activeSchedule = useMemo(
      () => pickDisplaySchedule(schedules),
      [schedules],
    )
    const currentTicket = useMemo(() => pickCurrentTicket(tickets), [tickets])
    const displaySchedule = useMemo(
      () =>
        schedules.find(
          (schedule) => schedule.queue_session_id === currentTicket?.queue_session_id,
        ) ?? activeSchedule,
      [activeSchedule, currentTicket?.queue_session_id, schedules],
    )
    const queueStats = useMemo(() => buildQueueStats(tickets), [tickets])
    const displayState = getDisplayState({
      currentTicket,
      displaySchedule,
      isLoading: schedulesQuery.isLoading || ticketsQuery.isLoading,
    })

    useQueueAnnouncement(currentTicket, lastAnnouncedTicketRef)
    useQueueDisplayRealtime({
      lastAnnouncedTicketRef,
      queryClient,
      today,
    })

    function refreshDisplayData() {
      void schedulesQuery.refetch()
      void ticketsQuery.refetch()
    }

    return (
      <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
        <div className="flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-10 lg:py-8">
          <DisplayHeader
            isFullscreen={isFullscreen}
            isRefreshing={schedulesQuery.isFetching || ticketsQuery.isFetching}
            today={today}
            onRefresh={refreshDisplayData}
            onToggleFullscreen={toggleFullscreen}
          />

          <section className="grid flex-1 items-stretch gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:py-10">
            <CurrentQueuePanel
              currentTicket={currentTicket}
              displayState={displayState}
              lastNumber={displaySchedule?.last_number ?? currentTicket?.queue_number ?? 0}
              queueStats={queueStats}
            />

            <aside className="grid gap-5 lg:block lg:space-y-5">
              <ServicePanel
                currentTicket={currentTicket}
                displaySchedule={displaySchedule}
              />
              <PracticeTimePanel
                displaySchedule={displaySchedule}
                displayState={displayState}
              />
            </aside>
          </section>
        </div>
      </main>
    )
  }

  type DisplayHeaderProps = {
    isFullscreen: boolean
    isRefreshing: boolean
    today: string
    onRefresh: () => void
    onToggleFullscreen: () => void
  }

  function DisplayHeader({
    isFullscreen,
    isRefreshing,
    onRefresh,
    onToggleFullscreen,
    today,
  }: DisplayHeaderProps) {
    return (
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-teal-300 sm:text-lg">
            Display Antrean
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
            AntriMedis
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left md:text-right">
            <p className="text-xs font-black uppercase text-slate-300">Hari Ini</p>
            <p className="text-xl font-black sm:text-2xl">
              {formatDateLabel(today, {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <Button disabled={isRefreshing} variant="secondary" onClick={onRefresh}>
            <RefreshCw className={isRefreshing ? 'animate-spin' : undefined} size={16} />
            Refresh
          </Button>
          <Button
            aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Masuk ke layar penuh'}
            title={isFullscreen ? 'Keluar dari layar penuh' : 'Masuk ke layar penuh'}
            variant="secondary"
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          </Button>
        </div>
      </header>
    )
  }

  type CurrentQueuePanelProps = {
    currentTicket: QueueTicketDetail | null
    displayState: DisplayState
    lastNumber: number
    queueStats: QueueStats
  }

  function CurrentQueuePanel({
    currentTicket,
    displayState,
    lastNumber,
    queueStats,
  }: CurrentQueuePanelProps) {
    return (
      <section className="flex min-h-[520px] flex-col rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-black uppercase tracking-wide text-slate-300 sm:text-xl">
              Nomor Antrean Saat Ini
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-400">
              {displayState.description}
            </p>
          </div>
          <StatusPill label={displayState.label} tone={displayState.tone} />
        </div>

        <div
          className={[
            'mt-8 flex flex-1 min-h-[240px] items-center justify-center rounded-[2rem] px-5 text-slate-950',
            displayState.heroClass,
          ].join(' ')}
        >
          <span className="max-w-full break-words text-center text-[clamp(5rem,18vw,15rem)] font-black leading-none tracking-normal">
            {currentTicket?.queue_code ?? '-'}
          </span>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <DisplayMetric label="Status" value={currentTicket ? queueStatusLabel(currentTicket.status) : 'Belum Ada Panggilan'} />
          <DisplayMetric label="Menunggu" value={queueStats.waiting} />
          <DisplayMetric label="Terakhir Dipanggil" value={lastNumber} />
        </div>
      </section>
    )
  }

  type ServicePanelProps = {
    currentTicket: QueueTicketDetail | null
    displaySchedule: ScheduleAvailability | null
  }

  function ServicePanel({ currentTicket, displaySchedule }: ServicePanelProps) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 sm:p-8">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-400 text-slate-950">
          <Activity size={32} />
        </div>
        <p className="text-sm font-black uppercase tracking-wide text-slate-300">
          Poli
        </p>
        <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
          {currentTicket?.polyclinic_name ?? displaySchedule?.polyclinic_name ?? 'Belum ada sesi'}
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-300">
          {displaySchedule ? 'Sesi display otomatis' : 'Belum ada sesi'}
        </p>
        <p className="mt-5 text-sm font-black uppercase tracking-wide text-slate-300">
          Dokter
        </p>
        <p className="mt-2 text-2xl font-black">
          {currentTicket?.doctor_name ?? displaySchedule?.doctor_name ?? '-'}
        </p>
      </section>
    )
  }

  type PracticeTimePanelProps = {
    displaySchedule: ScheduleAvailability | null
    displayState: DisplayState
  }

  function PracticeTimePanel({
    displaySchedule,
    displayState,
  }: PracticeTimePanelProps) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-slate-300">
          <Clock3 size={24} />
          <p className="text-sm font-black uppercase tracking-wide">Jam Praktik</p>
        </div>
        <p className="mt-3 text-3xl font-black sm:text-4xl">
          {displaySchedule ? formatTimeRange(displaySchedule) : '--:-- - --:--'}
        </p>
        <p
          className={[
            'mt-6 rounded-2xl px-5 py-4 text-2xl font-black',
            displayState.messageClass,
          ].join(' ')}
        >
          {displayState.message}
        </p>
      </section>
    )
  }

  function DisplayMetric({
    label,
    value,
  }: {
    label: string
    value: number | string
  }) {
    return (
      <div className="rounded-2xl bg-slate-950/60 px-5 py-4">
        <p className="text-sm font-black uppercase text-slate-400">{label}</p>
        <p className="mt-2 text-3xl font-black">{value}</p>
      </div>
    )
  }

  function StatusPill({
    label,
    tone,
  }: {
    label: string
    tone: 'amber' | 'slate' | 'teal'
  }) {
    const toneClass =
      tone === 'teal'
        ? 'bg-teal-300 text-slate-950'
        : tone === 'amber'
          ? 'bg-amber-300 text-slate-950'
          : 'bg-white/10 text-slate-200'

    return (
      <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${toneClass}`}>
        {label}
      </span>
    )
  }

  type QueueStats = {
    waiting: number
  }

  function buildQueueStats(tickets: QueueTicketDetail[]): QueueStats {
    return {
      waiting: tickets.filter((ticket) => ticket.status === 'waiting').length,
    }
  }

  type DisplayState = {
    description: string
    heroClass: string
    label: string
    message: string
    messageClass: string
    tone: 'amber' | 'slate' | 'teal'
  }

  function getDisplayState({
    currentTicket,
    displaySchedule,
    isLoading,
  }: {
    currentTicket: QueueTicketDetail | null
    displaySchedule: ScheduleAvailability | null
    isLoading: boolean
  }): DisplayState {
    if (currentTicket?.status === 'serving') {
      return {
        description: 'Pasien sedang dilayani di ruang pemeriksaan.',
        heroClass: 'bg-teal-400',
        label: 'Sedang dilayani',
        message: 'Sedang dilayani',
        messageClass: 'bg-teal-400 text-slate-950',
        tone: 'teal',
      }
    }

    if (currentTicket?.status === 'called') {
      return {
        description: 'Pasien dipanggil menuju ruang pemeriksaan.',
        heroClass: 'bg-amber-300',
        label: 'Dipanggil',
        message: 'Sedang dipanggil',
        messageClass: 'bg-amber-300 text-slate-950',
        tone: 'amber',
      }
    }

    if (isLoading) {
      return {
        description: 'Display sedang mengambil data antrean terbaru.',
        heroClass: 'bg-slate-200',
        label: 'Memuat',
        message: 'Memuat data',
        messageClass: 'bg-white/10 text-white',
        tone: 'slate',
      }
    }

    if (displaySchedule) {
      return {
        description: 'Sesi tersedia dan menunggu pemanggilan berikutnya.',
        heroClass: 'bg-teal-400',
        label: 'Belum Ada Panggilan',
        message: 'Menunggu pemanggilan',
        messageClass: 'bg-white/10 text-white',
        tone: 'slate',
      }
    }

    return {
      description: 'Belum ada sesi praktik aktif untuk ditampilkan.',
      heroClass: 'bg-slate-200',
      label: 'Tidak aktif',
      message: 'Belum ada sesi aktif',
      messageClass: 'bg-white/10 text-white',
      tone: 'slate',
    }
  }

  function pickDisplaySchedule(schedules: ScheduleAvailability[]) {
    return (
      schedules.find(
        (schedule) => schedule.queue_session_id && schedule.current_number > 0,
      ) ?? schedules.find((schedule) => schedule.queue_session_id) ?? null
    )
  }

  function pickCurrentTicket(tickets: QueueTicketDetail[]) {
    return (
      [...tickets]
        .filter((ticket) => ticket.status === 'serving' || ticket.status === 'called')
        .sort((first, second) => getTicketCallTime(second) - getTicketCallTime(first))[0] ??
      null
    )
  }

  function getTicketCallTime(ticket: QueueTicketDetail) {
    return new Date(
      ticket.serving_started_at ?? ticket.called_at ?? ticket.created_at,
    ).getTime()
  }

  function formatTimeRange(schedule: ScheduleAvailability) {
    return `${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`
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

  function useFullscreenState() {
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
      const syncFullscreenState = () => {
        setIsFullscreen(Boolean(document.fullscreenElement))
      }

      syncFullscreenState()
      document.addEventListener('fullscreenchange', syncFullscreenState)

      return () => {
        document.removeEventListener('fullscreenchange', syncFullscreenState)
      }
    }, [])

    async function toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen()
          return
        }

        await document.documentElement.requestFullscreen()
      } catch {
        // Browser fullscreen can be blocked by policy; windowed display remains usable.
      }
    }

    return { isFullscreen, toggleFullscreen }
  }

  function useQueueAnnouncement(
    currentTicket: QueueTicketDetail | null,
    lastAnnouncedTicketRef: MutableRefObject<string | null>,
  ) {
    useEffect(() => {
      if (!currentTicket) return
      if (currentTicket.status !== 'called' && currentTicket.status !== 'serving') return

      const ticketKey = getAnnouncementKey(currentTicket)
      if (ticketKey === lastAnnouncedTicketRef.current) return

      lastAnnouncedTicketRef.current = ticketKey
      return announceQueue(currentTicket)
    }, [currentTicket, lastAnnouncedTicketRef])
  }

  function useQueueDisplayRealtime({
    lastAnnouncedTicketRef,
    queryClient,
    today,
  }: {
    lastAnnouncedTicketRef: MutableRefObject<string | null>
    queryClient: ReturnType<typeof useQueryClient>
    today: string
  }) {
    useEffect(() => {
      const channel = supabase
        .channel('queue-display-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'queue_tickets' },
          (payload: RealtimePostgresChangesPayload<QueueTicketRealtimeRow>) => {
            void queryClient.invalidateQueries({ queryKey: ['queue-display-tickets'] })

            if (!shouldAnnounceRealtimePayload(payload)) return

            const nextTicket = payload.new as QueueTicketRealtimeRow
            void announceRealtimeQueue({
              lastAnnouncedTicketRef,
              ticketId: nextTicket.ticket_id,
              today,
            })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'queue_sessions' },
          () => {
            void queryClient.invalidateQueries({ queryKey: ['queue-display-schedules'] })
            void queryClient.invalidateQueries({ queryKey: ['queue-display-tickets'] })
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'doctor_schedules' },
          () => {
            void queryClient.invalidateQueries({ queryKey: ['queue-display-schedules'] })
          },
        )
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    }, [lastAnnouncedTicketRef, queryClient, today])
  }

  function announceQueue(ticket: QueueTicketDetail) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined

    const synth = window.speechSynthesis
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(
        `Perhatian. Nomor antrean ${ticket.queue_code}. Silakan menuju ruang pemeriksaan.`,
      )

      utterance.lang = 'id-ID'
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 1

      const indoVoice = synth
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().includes('id'))

      if (indoVoice) {
        utterance.voice = indoVoice
      }

      synth.cancel()
      synth.speak(utterance)
    }

    if (synth.getVoices().length > 0) {
      speak()
      return undefined
    }

    const handleVoicesChanged = () => {
      speak()
      synth.removeEventListener('voiceschanged', handleVoicesChanged)
    }

  synth.addEventListener('voiceschanged', handleVoicesChanged)

    return () => {
      synth.removeEventListener('voiceschanged', handleVoicesChanged)
    }
  }

  async function announceRealtimeQueue({
    lastAnnouncedTicketRef,
    ticketId,
    today,
  }: {
    lastAnnouncedTicketRef: MutableRefObject<string | null>
    ticketId: string
    today: string
  }) {
    try {
      const ticket = await fetchQueueTicketDetail(ticketId)
      if (ticket.schedule_date !== today) return
      if (ticket.status !== 'called' && ticket.status !== 'serving') return

      const ticketKey = getAnnouncementKey(ticket)
      if (ticketKey === lastAnnouncedTicketRef.current) return

      lastAnnouncedTicketRef.current = ticketKey
      announceQueue(ticket)
    } catch {
      // Display tetap akan mendapat data terbaru lewat invalidasi query.
    }
  }

  function shouldAnnounceRealtimePayload(
    payload: RealtimePostgresChangesPayload<QueueTicketRealtimeRow>,
  ) {
    if (payload.eventType !== 'UPDATE') return false

    const nextStatus = payload.new.status
    const previousStatus = payload.old.status

    if (nextStatus !== 'called' && nextStatus !== 'serving') return false
    return previousStatus !== nextStatus
  }

  function getAnnouncementKey(
    ticket: Pick<QueueTicketDetail, 'queue_session_id' | 'queue_number'>,
  ) {
    return `${ticket.queue_session_id}-${ticket.queue_number}`
  }

type QueueTicketRealtimeRow = {
  ticket_id: string
  status: QueueStatus
}
