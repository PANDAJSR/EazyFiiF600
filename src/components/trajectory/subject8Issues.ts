import type { ParsedBlock } from '../../types/fii'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

type XYPoint = {
  x: number
  y: number
}

export type Subject8CheckResult = 'ok' | 'high-ring-not-descending' | 'low-ring-not-ascending'

const SUBJECT8_RING_DIAMETER_CM = 65
const SUBJECT8_RING_RADIUS_CM = SUBJECT8_RING_DIAMETER_CM / 2
const SUBJECT8_RING_RADIUS_TOLERANCE_CM = 3
const SUBJECT8_HIGH_RING_CENTER_HEIGHT_CM = 150
const SUBJECT8_LOW_RING_CENTER_HEIGHT_CM = 110
const AXIS_EPSILON = 1e-6

const segmentCrossesRing = (
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  center: XYPoint,
  ringHeight: number,
  mustDescend: boolean,
): boolean => {
  const deltaZ = end.z - start.z
  if (Math.abs(deltaZ) < AXIS_EPSILON) {
    return false
  }

  if (mustDescend && deltaZ >= 0) {
    return false
  }
  if (!mustDescend && deltaZ <= 0) {
    return false
  }

  const startDistance = start.z - ringHeight
  const endDistance = end.z - ringHeight
  if (startDistance * endDistance > 0) {
    return false
  }

  const ratio = (ringHeight - start.z) / deltaZ
  if (ratio < 0 || ratio > 1) {
    return false
  }

  const crossX = start.x + (end.x - start.x) * ratio
  const crossY = start.y + (end.y - start.y) * ratio
  const distanceXY = Math.hypot(crossX - center.x, crossY - center.y)
  return distanceXY <= SUBJECT8_RING_RADIUS_CM + SUBJECT8_RING_RADIUS_TOLERANCE_CM
}

const hasRingCrossEvent = (
  center: XYPoint,
  ringHeight: number,
  mustDescend: boolean,
  startPos: XYZ,
  blocks: ParsedBlock[],
): boolean => {
  const visits = buildPathVisits(startPos, blocks)
  for (let index = 1; index < visits.length; index += 1) {
    const start = visits[index - 1]
    const end = visits[index]
    if (segmentCrossesRing(start, end, center, ringHeight, mustDescend)) {
      return true
    }
  }
  return false
}

export const checkSubject8PassHighLowRings = (
  rodA: XYPoint,
  rodB: XYPoint,
  rodC: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject8CheckResult => {
  const highRingCenter = {
    x: (rodA.x + rodB.x) / 2,
    y: (rodA.y + rodB.y) / 2,
  }
  const lowRingCenter = {
    x: (rodB.x + rodC.x) / 2,
    y: (rodB.y + rodC.y) / 2,
  }

  const hasHighRingDescendingCross = hasRingCrossEvent(
    highRingCenter,
    SUBJECT8_HIGH_RING_CENTER_HEIGHT_CM,
    true,
    startPos,
    blocks,
  )
  if (!hasHighRingDescendingCross) {
    return 'high-ring-not-descending'
  }

  const hasLowRingAscendingCross = hasRingCrossEvent(
    lowRingCenter,
    SUBJECT8_LOW_RING_CENTER_HEIGHT_CM,
    false,
    startPos,
    blocks,
  )
  if (!hasLowRingAscendingCross) {
    return 'low-ring-not-ascending'
  }

  return 'ok'
}
