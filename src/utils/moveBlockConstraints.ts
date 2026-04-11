const ASYNC_MOVE_X_MIN = 0
const ASYNC_MOVE_X_MAX = 400
const ASYNC_MOVE_Y_MIN = 0
const ASYNC_MOVE_Y_MAX = 400
const ASYNC_MOVE_Z_MIN = 100
const ASYNC_MOVE_Z_MAX = 300

const AUTO_DELAY_X_MIN = 0
const AUTO_DELAY_X_MAX = 400
const AUTO_DELAY_Y_MIN = 0
const AUTO_DELAY_Y_MAX = 400
const AUTO_DELAY_Z_MIN = 0
const AUTO_DELAY_Z_MAX = 250

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const toNumber = (value: string | undefined): number | null => {
  if (value === undefined) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const MIN_ABSOLUTE_MOVE_Z = ASYNC_MOVE_Z_MIN

export const clampAsyncMoveX = (value: number) => clamp(value, ASYNC_MOVE_X_MIN, ASYNC_MOVE_X_MAX)
export const clampAsyncMoveY = (value: number) => clamp(value, ASYNC_MOVE_Y_MIN, ASYNC_MOVE_Y_MAX)
export const clampAsyncMoveZ = (value: number) => clamp(value, ASYNC_MOVE_Z_MIN, ASYNC_MOVE_Z_MAX)

export const clampAutoDelayX = (value: number) => clamp(value, AUTO_DELAY_X_MIN, AUTO_DELAY_X_MAX)
export const clampAutoDelayY = (value: number) => clamp(value, AUTO_DELAY_Y_MIN, AUTO_DELAY_Y_MAX)
export const clampAutoDelayZ = (value: number) => clamp(value, AUTO_DELAY_Z_MIN, AUTO_DELAY_Z_MAX)

export const clampAsyncMoveFieldValue = (fieldKey: string, raw: string) => {
  const parsed = toNumber(raw)
  if (parsed === null) {
    return raw
  }
  if (fieldKey === 'X') {
    return String(clampAsyncMoveX(parsed))
  }
  if (fieldKey === 'Y') {
    return String(clampAsyncMoveY(parsed))
  }
  if (fieldKey === 'Z') {
    return String(clampAsyncMoveZ(parsed))
  }
  return raw
}

export const clampAutoDelayFieldValue = (fieldKey: string, raw: string) => {
  const parsed = toNumber(raw)
  if (parsed === null) {
    return raw
  }
  if (fieldKey === 'X') {
    return String(clampAutoDelayX(parsed))
  }
  if (fieldKey === 'Y') {
    return String(clampAutoDelayY(parsed))
  }
  if (fieldKey === 'Z') {
    return String(clampAutoDelayZ(parsed))
  }
  return raw
}
