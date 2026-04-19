export interface AppSettings {
  safetyDistance: number
  autoDelayOffsetMs: number
}

export const DEFAULT_SAFETY_DISTANCE = 15
export const DEFAULT_AUTO_DELAY_OFFSET_MS = 0

const STORAGE_KEY = 'fii-safety-settings'

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function loadAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const safetyDistanceRaw = typeof parsed.safetyDistance === 'number' ? parsed.safetyDistance : DEFAULT_SAFETY_DISTANCE
      const autoDelayOffsetRaw = typeof parsed.autoDelayOffsetMs === 'number' ? parsed.autoDelayOffsetMs : DEFAULT_AUTO_DELAY_OFFSET_MS
      return {
        safetyDistance: clampNumber(safetyDistanceRaw, 0, 100),
        autoDelayOffsetMs: clampNumber(Math.round(autoDelayOffsetRaw), -10000, 10000),
      }
    }
  } catch {
    // ignore
  }
  return {
    safetyDistance: DEFAULT_SAFETY_DISTANCE,
    autoDelayOffsetMs: DEFAULT_AUTO_DELAY_OFFSET_MS,
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}
