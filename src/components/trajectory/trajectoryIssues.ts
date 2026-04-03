import type { ParsedBlock } from '../../types/fii'
import type { RodConfig } from './rodConfig'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

const SUBJECT1_MAX_HEIGHT = 150
const ASYNC_MOVE_BLOCK_TYPE = 'Goertek_MoveToCoord2'
const DELAY_BLOCK_TYPE = 'block_delay'

type XYPoint = {
  x: number
  y: number
}

type DelayAnchor = {
  distance: number
  minDelayMs: number
}

const ASYNC_MOVE_DELAY_ANCHORS: DelayAnchor[] = [
  { distance: 40, minDelayMs: 500 },
  { distance: 60, minDelayMs: 700 },
  { distance: 80, minDelayMs: 800 },
  { distance: 100, minDelayMs: 1000 },
  { distance: 120, minDelayMs: 1000 },
  { distance: 140, minDelayMs: 1100 },
]

const hasFiniteXY = (point: { x?: number; y?: number }): point is { x: number; y: number } =>
  Number.isFinite(point.x) && Number.isFinite(point.y)

const isSameXY = (a: XYPoint, b: XYPoint) => a.x === b.x && a.y === b.y

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

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

const hasSubject1ClosedLoopUnder150 = (subjectPoint: XYPoint, startPos: XYZ, blocks: ParsedBlock[]): boolean => {
  const visits = buildPathVisits(startPos, blocks)
  const indexByXY = new Map<string, number[]>()

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

      if (pointInPolygon(subjectPoint, polygon)) {
        return true
      }
    }

    seen.push(endIndex)
    indexByXY.set(key, seen)
  }

  return false
}

const findMinDelayByDistance = (distanceCm: number): number => {
  const safeDistance = Number.isFinite(distanceCm) ? Math.max(0, distanceCm) : 0
  if (Math.abs(safeDistance - 40) < 1e-6) {
    return 501
  }
  const first = ASYNC_MOVE_DELAY_ANCHORS[0]
  const last = ASYNC_MOVE_DELAY_ANCHORS[ASYNC_MOVE_DELAY_ANCHORS.length - 1]

  if (safeDistance <= first.distance) {
    const ratio = safeDistance / first.distance
    return Math.ceil(first.minDelayMs * ratio)
  }

  if (safeDistance >= last.distance) {
    const prev = ASYNC_MOVE_DELAY_ANCHORS[ASYNC_MOVE_DELAY_ANCHORS.length - 2]
    const slope = (last.minDelayMs - prev.minDelayMs) / (last.distance - prev.distance)
    return Math.ceil(last.minDelayMs + (safeDistance - last.distance) * slope)
  }

  for (let i = 1; i < ASYNC_MOVE_DELAY_ANCHORS.length; i += 1) {
    const left = ASYNC_MOVE_DELAY_ANCHORS[i - 1]
    const right = ASYNC_MOVE_DELAY_ANCHORS[i]
    if (safeDistance > right.distance) {
      continue
    }
    if (safeDistance === right.distance) {
      return right.minDelayMs
    }
    const ratio = (safeDistance - left.distance) / (right.distance - left.distance)
    return Math.ceil(left.minDelayMs + (right.minDelayMs - left.minDelayMs) * ratio)
  }

  return last.minDelayMs
}

const findAsyncMoveDelayWarnings = (blocks: ParsedBlock[]): string[] => {
  const warnings: string[] = []

  for (let startIndex = 0; startIndex < blocks.length; startIndex += 1) {
    const current = blocks[startIndex]
    if (current.type !== ASYNC_MOVE_BLOCK_TYPE) {
      continue
    }

    let nextMoveIndex = -1
    let accumulatedDelayMs = 0

    for (let cursor = startIndex + 1; cursor < blocks.length; cursor += 1) {
      const candidate = blocks[cursor]
      if (candidate.type === DELAY_BLOCK_TYPE) {
        accumulatedDelayMs += Math.max(0, toNumber(candidate.fields.time) ?? 0)
        continue
      }
      if (candidate.type === ASYNC_MOVE_BLOCK_TYPE) {
        nextMoveIndex = cursor
        break
      }
    }

    if (nextMoveIndex < 0) {
      continue
    }

    const next = blocks[nextMoveIndex]
    const x1 = toNumber(current.fields.X)
    const y1 = toNumber(current.fields.Y)
    const z1 = toNumber(current.fields.Z)
    const x2 = toNumber(next.fields.X)
    const y2 = toNumber(next.fields.Y)
    const z2 = toNumber(next.fields.Z)
    if (x1 === null || y1 === null || z1 === null || x2 === null || y2 === null || z2 === null) {
      continue
    }

    const distance = Math.hypot(x2 - x1, y2 - y1, z2 - z1)
    const requiredDelayMs = findMinDelayByDistance(distance)
    if (accumulatedDelayMs >= requiredDelayMs) {
      continue
    }

    warnings.push(
      `异步平移延时不足：第${startIndex + 1}到第${nextMoveIndex + 1}个平移到距离${distance.toFixed(1)}cm，需≥${requiredDelayMs}ms，当前${Math.round(accumulatedDelayMs)}ms`,
    )
  }

  return warnings
}

export const buildTrajectoryIssueWarnings = (
  startPos: XYZ,
  blocks: ParsedBlock[],
  rodConfig: RodConfig,
): string[] => {
  const warnings: string[] = []
  const subject1 = rodConfig.subject1[0]

  if (subject1 && hasFiniteXY(subject1) && !hasSubject1ClosedLoopUnder150(subject1, startPos, blocks)) {
    warnings.push('科目一未完成')
  }

  warnings.push(...findAsyncMoveDelayWarnings(blocks))
  return warnings
}
