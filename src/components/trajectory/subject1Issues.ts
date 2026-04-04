import type { ParsedBlock } from '../../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from '../../utils/autoDelayBlocks'
import type { XYZ } from './trajectoryUtils'

const SUBJECT1_MAX_HEIGHT = 150
const SUBJECT1_HEADING_TOLERANCE_DEG = 1
const DEFAULT_HEADING_DEG = 0
const TURN_BLOCK_TYPE = 'Goertek_Turn'
const TURN_TO_BLOCK_TYPE = 'Goertek_TurnTo'
const LAND_BLOCK_TYPE = 'Goertek_Land'
const ASYNC_MOVE_BLOCK_TYPE = 'Goertek_MoveToCoord2'
const RELATIVE_MOVE_BLOCK_TYPE = 'Goertek_Move'
const MOTOR_LIGHT_BLOCK_TYPE = 'Goertek_LEDTurnOnAllSingleColor4'
const ALL_LIGHT_BLOCK_TYPE = 'Goertek_LEDTurnOnAllSingleColor2'

type XYPoint = {
  x: number
  y: number
}

type Subject1Visit = {
  x: number
  y: number
  z: number
  blockIndex: number
  moveDirectionDeg?: number
  headingDeg?: number
}

type MotorId = '1' | '2' | '3' | '4'

type MotorLightState = Record<MotorId, string | undefined>

export type Subject1LoopCheckResult = 'ok' | 'no-loop' | 'heading-not-forward' | 'motor-lights-not-green'

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const isSameXY = (a: XYPoint, b: XYPoint) => a.x === b.x && a.y === b.y

const normalizePolygon = (points: XYPoint[]): XYPoint[] => {
  const compact = points.filter((point, index) => {
    if (index === 0) {
      return true
    }
    return !isSameXY(point, points[index - 1])
  })

  if (compact.length > 1 && isSameXY(compact[0], compact[compact.length - 1])) {
    compact.pop()
  }

  return compact
}

const pointInPolygon = (point: XYPoint, polygon: XYPoint[]): boolean => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]

    const intersect =
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x

    if (intersect) {
      inside = !inside
    }
  }

  return inside
}

const normalizeHeadingDeg = (headingDeg: number): number => {
  const normalized = headingDeg % 360
  return normalized >= 0 ? normalized : normalized + 360
}

const calcMoveDirectionDeg = (deltaX: number, deltaY: number): number | null => {
  if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) {
    return null
  }
  return normalizeHeadingDeg((Math.atan2(deltaX, deltaY) * 180) / Math.PI)
}

const shortestAngleDiffDeg = (a: number, b: number): number => {
  const diff = Math.abs(normalizeHeadingDeg(a) - normalizeHeadingDeg(b))
  return Math.min(diff, 360 - diff)
}

const isHeadingFacingMoveDirection = (moveDirectionDeg: number, headingDeg: number): boolean =>
  shortestAngleDiffDeg(moveDirectionDeg, headingDeg) <= SUBJECT1_HEADING_TOLERANCE_DEG

const buildSubject1Visits = (startPos: XYZ, blocks: ParsedBlock[]): Subject1Visit[] => {
  const startX = toNumber(startPos.x) ?? 0
  const startY = toNumber(startPos.y) ?? 0
  const startZ = toNumber(startPos.z) ?? 0
  const visits: Subject1Visit[] = [{ x: startX, y: startY, z: startZ, blockIndex: -1 }]
  let currentX = startX
  let currentY = startY
  let currentZ = startZ
  let headingDeg = DEFAULT_HEADING_DEG

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]

    if (block.type === TURN_TO_BLOCK_TYPE) {
      const angle = toNumber(block.fields.angle)
      if (angle === null) {
        continue
      }
      headingDeg = normalizeHeadingDeg(angle)
      continue
    }

    if (block.type === TURN_BLOCK_TYPE) {
      const angle = toNumber(block.fields.angle)
      if (angle === null) {
        continue
      }
      const direction = block.fields.turnDirection?.trim().toLowerCase()
      if (direction === 'r') {
        headingDeg = normalizeHeadingDeg(headingDeg + angle)
      } else if (direction === 'l') {
        headingDeg = normalizeHeadingDeg(headingDeg - angle)
      }
      continue
    }

    if (block.type === 'Goertek_TakeOff2') {
      const nextZ = toNumber(block.fields.alt)
      if (nextZ === null) {
        continue
      }
      currentZ = nextZ
      visits.push({ x: currentX, y: currentY, z: currentZ, blockIndex: index })
      continue
    }

    if (block.type === ASYNC_MOVE_BLOCK_TYPE || block.type === AUTO_DELAY_BLOCK_TYPE) {
      const nextX = toNumber(block.fields.X)
      const nextY = toNumber(block.fields.Y)
      if (nextX === null || nextY === null) {
        continue
      }
      const nextZ = toNumber(block.fields.Z) ?? currentZ
      const moveDirectionDeg = calcMoveDirectionDeg(nextX - currentX, nextY - currentY)
      currentX = nextX
      currentY = nextY
      currentZ = nextZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        blockIndex: index,
        moveDirectionDeg: moveDirectionDeg ?? undefined,
        headingDeg: moveDirectionDeg === null ? undefined : headingDeg,
      })
      continue
    }

    if (block.type === RELATIVE_MOVE_BLOCK_TYPE) {
      const deltaX = toNumber(block.fields.X)
      const deltaY = toNumber(block.fields.Y)
      if (deltaX === null || deltaY === null) {
        continue
      }
      const deltaZ = toNumber(block.fields.Z) ?? 0
      const moveDirectionDeg = calcMoveDirectionDeg(deltaX, deltaY)
      currentX += deltaX
      currentY += deltaY
      currentZ += deltaZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        blockIndex: index,
        moveDirectionDeg: moveDirectionDeg ?? undefined,
        headingDeg: moveDirectionDeg === null ? undefined : headingDeg,
      })
      continue
    }

    if (block.type === LAND_BLOCK_TYPE) {
      currentZ = 0
      visits.push({ x: currentX, y: currentY, z: currentZ, blockIndex: index })
    }
  }

  return visits
}

const isLoopFacingMoveDirection = (loopVisits: Subject1Visit[]): boolean => {
  for (let index = 1; index < loopVisits.length; index += 1) {
    const visit = loopVisits[index]
    if (visit.moveDirectionDeg === undefined || visit.headingDeg === undefined) {
      continue
    }
    if (!isHeadingFacingMoveDirection(visit.moveDirectionDeg, visit.headingDeg)) {
      return false
    }
  }
  return true
}

const parseRgbColor = (value?: string): { r: number; g: number; b: number } | null => {
  if (!value) {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'green') {
    return { r: 0, g: 128, b: 0 }
  }
  if (normalized === 'lime') {
    return { r: 0, g: 255, b: 0 }
  }

  const withoutPrefix = normalized.startsWith('#')
    ? normalized.slice(1)
    : normalized.startsWith('0x')
      ? normalized.slice(2)
      : normalized

  const hex =
    withoutPrefix.length === 3
      ? withoutPrefix
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : withoutPrefix

  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return null
  }

  const num = Number.parseInt(hex, 16)
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  }
}

const isApproximatelyGreen = (value?: string): boolean => {
  const rgb = parseRgbColor(value)
  if (!rgb) {
    return false
  }
  return rgb.g >= 120 && rgb.g - rgb.r >= 40 && rgb.g - rgb.b >= 40
}

const cloneMotorLightState = (state: MotorLightState): MotorLightState => ({
  '1': state['1'],
  '2': state['2'],
  '3': state['3'],
  '4': state['4'],
})

const buildMotorLightBeforeTimeline = (blocks: ParsedBlock[]): MotorLightState[] => {
  const before: MotorLightState[] = []
  let current: MotorLightState = {
    '1': undefined,
    '2': undefined,
    '3': undefined,
    '4': undefined,
  }

  for (const block of blocks) {
    before.push(cloneMotorLightState(current))

    if (block.type === MOTOR_LIGHT_BLOCK_TYPE) {
      const motor = block.fields.motor?.trim() as MotorId | undefined
      if (motor && ['1', '2', '3', '4'].includes(motor)) {
        current = {
          ...current,
          [motor]: block.fields.color1,
        }
      }
      continue
    }

    if (block.type === ALL_LIGHT_BLOCK_TYPE) {
      current = {
        '1': block.fields.color1,
        '2': block.fields.color1,
        '3': block.fields.color1,
        '4': block.fields.color1,
      }
    }
  }

  return before
}

const areMotor1And2Green = (state: MotorLightState): boolean =>
  isApproximatelyGreen(state['1']) && isApproximatelyGreen(state['2'])

const isLoopMotorLightsGreen = (
  startVisit: Subject1Visit,
  endVisit: Subject1Visit,
  motorStateBeforeBlock: MotorLightState[],
): boolean => {
  const startBlockIndex = Math.max(0, startVisit.blockIndex + 1)
  const endBlockIndex = endVisit.blockIndex

  if (endBlockIndex < startBlockIndex || endBlockIndex < 0) {
    return false
  }

  for (let blockIndex = startBlockIndex; blockIndex <= endBlockIndex; blockIndex += 1) {
    const state = motorStateBeforeBlock[blockIndex]
    if (!state || !areMotor1And2Green(state)) {
      return false
    }
  }

  return true
}

export const checkSubject1ClosedLoopUnder150 = (
  subjectPoint: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject1LoopCheckResult => {
  const visits = buildSubject1Visits(startPos, blocks)
  const motorStateBeforeBlock = buildMotorLightBeforeTimeline(blocks)
  const indexByXY = new Map<string, number[]>()
  let hasClosedLoopIncludingSubject = false
  let hasHeadingAlignedLoop = false

  for (let endIndex = 0; endIndex < visits.length; endIndex += 1) {
    const endVisit = visits[endIndex]
    const key = `${endVisit.x},${endVisit.y}`
    const seen = indexByXY.get(key) ?? []

    for (const startIndex of seen) {
      if (endIndex - startIndex < 3) {
        continue
      }

      const loopVisits = visits.slice(startIndex, endIndex + 1)
      if (!loopVisits.every((visit) => visit.z < SUBJECT1_MAX_HEIGHT)) {
        continue
      }

      const polygon = normalizePolygon(loopVisits.map((visit) => ({ x: visit.x, y: visit.y })))
      if (polygon.length < 3) {
        continue
      }

      if (!pointInPolygon(subjectPoint, polygon)) {
        continue
      }

      hasClosedLoopIncludingSubject = true

      if (!isLoopFacingMoveDirection(loopVisits)) {
        continue
      }

      hasHeadingAlignedLoop = true
      if (isLoopMotorLightsGreen(loopVisits[0], loopVisits[loopVisits.length - 1], motorStateBeforeBlock)) {
        return 'ok'
      }
    }

    seen.push(endIndex)
    indexByXY.set(key, seen)
  }

  if (!hasClosedLoopIncludingSubject) {
    return 'no-loop'
  }
  if (!hasHeadingAlignedLoop) {
    return 'heading-not-forward'
  }
  return 'motor-lights-not-green'
}
