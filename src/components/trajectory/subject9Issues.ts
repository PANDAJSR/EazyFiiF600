import type { ParsedBlock } from '../../types/fii'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

type XYPoint = {
  x: number
  y: number
}

type LocalVisit = {
  u: number
  v: number
  w: number
}

type LocalContext = {
  visits: LocalVisit[]
  halfGap: number
}

export type Subject9CheckResult = 'ok' | 'no-eight' | 'entry-exit-invalid' | 'height-invalid'

const SUBJECT9_FIRST_CROSSBAR_HEIGHT_CM = 150
const SUBJECT9_MIN_HEIGHT_GAP_CM = 5
const SUBJECT9_MIN_LOOP_POINTS = 6
const SUBJECT9_CLOSURE_TOLERANCE_CM = 24
const SUBJECT9_MIN_SWEEP_RAD = Math.PI * 1.6
const SUBJECT9_CENTER_CROSS_TOLERANCE_CM = 10
const SUBJECT9_ENTRY_SIDE_MARGIN_CM = 12
const SUBJECT9_ENTRY_MIDDLE_BAND_MARGIN_CM = 12
const SUBJECT9_BAR_DIRECTION_TOLERANCE_CM = 70
const AXIS_EPSILON = 1e-6

const shortestAngleDelta = (from: number, to: number): number => {
  let diff = to - from
  while (diff > Math.PI) {
    diff -= Math.PI * 2
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2
  }
  return diff
}

const normalize2D = (x: number, y: number): { x: number; y: number } | null => {
  const length = Math.hypot(x, y)
  if (length < AXIS_EPSILON) {
    return null
  }
  return { x: x / length, y: y / length }
}

const buildLocalContext = (
  rodA: XYPoint,
  rodB: XYPoint,
  secondCrossbarHeight: number,
  startPos: XYZ,
  blocks: ParsedBlock[],
): LocalContext | null => {
  const barAxis = normalize2D(rodB.x - rodA.x, rodB.y - rodA.y)
  if (!barAxis) {
    return null
  }

  const normalAxis = { x: -barAxis.y, y: barAxis.x }
  const centerX = (rodA.x + rodB.x) / 2
  const centerY = (rodA.y + rodB.y) / 2
  const upperHeight = Math.max(SUBJECT9_FIRST_CROSSBAR_HEIGHT_CM, secondCrossbarHeight)
  const lowerHeight = Math.min(SUBJECT9_FIRST_CROSSBAR_HEIGHT_CM, secondCrossbarHeight)
  const middleHeight = (upperHeight + lowerHeight) / 2
  const halfGap = (upperHeight - lowerHeight) / 2

  const visits = buildPathVisits(startPos, blocks).map((visit) => {
    const relX = visit.x - centerX
    const relY = visit.y - centerY
    return {
      u: relX * normalAxis.x + relY * normalAxis.y,
      v: relX * barAxis.x + relY * barAxis.y,
      w: visit.z - middleHeight,
    }
  })

  return { visits, halfGap }
}

const isClosedIn3D = (start: LocalVisit, end: LocalVisit): boolean =>
  Math.hypot(end.u - start.u, end.v - start.v, end.w - start.w) <= SUBJECT9_CLOSURE_TOLERANCE_CM

const calcWindingSweep = (points: LocalVisit[], centerW: number): number => {
  let sweep = 0
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    const prevAngle = Math.atan2(prev.w - centerW, prev.u)
    const currAngle = Math.atan2(curr.w - centerW, curr.u)
    sweep += shortestAngleDelta(prevAngle, currAngle)
  }
  return sweep
}

const hasMiddleCrossing = (points: LocalVisit[]): boolean => {
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    const closeToMiddle = Math.abs(prev.w) <= SUBJECT9_CENTER_CROSS_TOLERANCE_CM || Math.abs(curr.w) <= SUBJECT9_CENTER_CROSS_TOLERANCE_CM
    const throughMiddle = prev.w * curr.w < 0
    const sideClose = Math.abs(prev.u) <= SUBJECT9_CENTER_CROSS_TOLERANCE_CM || Math.abs(curr.u) <= SUBJECT9_CENTER_CROSS_TOLERANCE_CM
    if ((closeToMiddle || throughMiddle) && sideClose) {
      return true
    }
  }
  return false
}

const isVerticalFigureEightLoop = (points: LocalVisit[], halfGap: number): boolean => {
  if (!points.every((visit) => Math.abs(visit.v) <= SUBJECT9_BAR_DIRECTION_TOLERANCE_CM)) {
    return false
  }

  const upperSweep = calcWindingSweep(points, halfGap)
  const lowerSweep = calcWindingSweep(points, -halfGap)
  if (Math.abs(upperSweep) < SUBJECT9_MIN_SWEEP_RAD || Math.abs(lowerSweep) < SUBJECT9_MIN_SWEEP_RAD) {
    return false
  }
  if (upperSweep * lowerSweep >= 0) {
    return false
  }

  return hasMiddleCrossing(points)
}

const isEntryExitValid = (points: LocalVisit[], halfGap: number): boolean => {
  const entry = points[0]
  const exit = points[points.length - 1]
  const sideBoundary = SUBJECT9_ENTRY_SIDE_MARGIN_CM
  const middleBand = halfGap + SUBJECT9_ENTRY_MIDDLE_BAND_MARGIN_CM
  const entryBetweenBars = Math.abs(entry.w) <= middleBand
  const exitBetweenBars = Math.abs(exit.w) <= middleBand
  if (!entryBetweenBars || !exitBetweenBars) {
    return false
  }

  const enteredFromLeft = entry.u <= -sideBoundary
  const enteredFromRight = entry.u >= sideBoundary
  const exitedToLeft = exit.u <= -sideBoundary
  const exitedToRight = exit.u >= sideBoundary
  return (enteredFromLeft && exitedToLeft) || (enteredFromRight && exitedToRight)
}

export const checkSubject9VerticalFigureEightAroundDifferentHeightCrossbars = (
  rodA: XYPoint,
  rodB: XYPoint,
  secondCrossbarHeight: number,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject9CheckResult => {
  if (Math.abs(secondCrossbarHeight - SUBJECT9_FIRST_CROSSBAR_HEIGHT_CM) < SUBJECT9_MIN_HEIGHT_GAP_CM) {
    return 'height-invalid'
  }

  const local = buildLocalContext(rodA, rodB, secondCrossbarHeight, startPos, blocks)
  if (!local || local.visits.length < SUBJECT9_MIN_LOOP_POINTS) {
    return 'no-eight'
  }

  let hasEightShapeLoop = false

  for (let startIndex = 0; startIndex < local.visits.length; startIndex += 1) {
    for (
      let endIndex = startIndex + SUBJECT9_MIN_LOOP_POINTS - 1;
      endIndex < local.visits.length;
      endIndex += 1
    ) {
      const start = local.visits[startIndex]
      const end = local.visits[endIndex]
      if (!isClosedIn3D(start, end)) {
        continue
      }

      const loop = local.visits.slice(startIndex, endIndex + 1)
      if (!isVerticalFigureEightLoop(loop, local.halfGap)) {
        continue
      }

      hasEightShapeLoop = true
      if (isEntryExitValid(loop, local.halfGap)) {
        return 'ok'
      }
    }
  }

  if (hasEightShapeLoop) {
    return 'entry-exit-invalid'
  }
  return 'no-eight'
}
