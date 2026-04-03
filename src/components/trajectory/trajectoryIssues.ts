import type { ParsedBlock } from '../../types/fii'
import type { RodConfig } from './rodConfig'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

const SUBJECT1_MAX_HEIGHT = 150

type XYPoint = {
  x: number
  y: number
}

const hasFiniteXY = (point: { x?: number; y?: number }): point is { x: number; y: number } =>
  Number.isFinite(point.x) && Number.isFinite(point.y)

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

export const buildTrajectoryIssueWarnings = (
  startPos: XYZ,
  blocks: ParsedBlock[],
  rodConfig: RodConfig,
): string[] => {
  const subject1 = rodConfig.subject1[0]
  if (!subject1 || !hasFiniteXY(subject1)) {
    return []
  }

  if (hasSubject1ClosedLoopUnder150(subject1, startPos, blocks)) {
    return []
  }

  return ['科目一未完成']
}
