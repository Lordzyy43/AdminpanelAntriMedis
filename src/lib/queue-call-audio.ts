let audioContext: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null

  if (!audioContext) {
    const ContextCtor =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!ContextCtor) return null
    audioContext = new ContextCtor()
  }

  return audioContext
}

export async function primeQueueCallAudio() {
  const context = getAudioContext()
  if (!context) return false

  try {
    if (context.state === 'suspended') {
      await context.resume()
    }
    return true
  } catch {
    return false
  }
}

export async function playQueueCallAudio() {
  const context = getAudioContext()
  if (!context) return false

  try {
    if (context.state === 'suspended') {
      await context.resume()
    }

    const gain = context.createGain()
    const oscillator = context.createOscillator()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.12)

    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.3)

    return true
  } catch {
    return false
  }
}
