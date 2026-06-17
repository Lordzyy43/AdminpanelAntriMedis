import { useEffect, useState } from 'react'

export function getTodayInputValue() {
  return toDateInputValue(new Date())
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInputValue(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDateLabel(
  dateValue: string,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  },
) {
  return new Intl.DateTimeFormat('id-ID', options).format(
    parseDateInputValue(dateValue),
  )
}

export function useTodayInputValue() {
  const [today, setToday] = useState(getTodayInputValue)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    function scheduleNextRollover() {
      const now = new Date()
      const nextDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
      )

      timeoutId = setTimeout(() => {
        setToday(getTodayInputValue())
        scheduleNextRollover()
      }, nextDay.getTime() - now.getTime())
    }

    scheduleNextRollover()

    return () => {
      clearTimeout(timeoutId)
    }
  }, [])

  return today
}
