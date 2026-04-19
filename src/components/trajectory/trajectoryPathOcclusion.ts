import type { RodRingOccluder } from './trajectoryPlaneDecorations'
import type { RodLineOccluder } from './trajectoryPlaneDecorations'
import type { Visit } from './trajectoryUtils'

export type PathSegment = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const Z_OVER_EPSILON = 2
const LINE_OCCLUSION_DISTANCE = 2

const distanceToPoint = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1)

const distancePointToSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const segmentLengthSquared = dx * dx + dy * dy
  if (segmentLengthSquared < 0.0001) {
    return distanceToPoint(px, py, x1, y1)
  }
  const projection = ((px - x1) * dx + (py - y1) * dy) / segmentLengthSquared
  const clamped = Math.max(0, Math.min(1, projection))
  const nearestX = x1 + dx * clamped
  const nearestY = y1 + dy * clamped
  return distanceToPoint(px, py, nearestX, nearestY)
}

const cross2D = (x1: number, y1: number, x2: number, y2: number) => x1 * y2 - y1 * x2

const projectPointToSegmentRatio = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const segmentLengthSquared = dx * dx + dy * dy
  if (segmentLengthSquared < 0.0001) {
    return 0
  }
  const projection = ((px - x1) * dx + (py - y1) * dy) / segmentLengthSquared
  return Math.max(0, Math.min(1, projection))
}

const intersectsRingDisk = (ring: RodRingOccluder, start: Visit, end: Visit) => {
  const d1 = distanceToPoint(start.x, start.y, ring.cx, ring.cy)
  const d2 = distanceToPoint(end.x, end.y, ring.cx, ring.cy)
  const minDistance = distancePointToSegment(ring.cx, ring.cy, start.x, start.y, end.x, end.y)
  const maxEndpointDistance = Math.max(d1, d2)
  return minDistance <= ring.r && maxEndpointDistance >= ring.r
}

const isSegmentAboveRing = (ring: RodRingOccluder, start: Visit, end: Visit) => {
  const ratio = projectPointToSegmentRatio(ring.cx, ring.cy, start.x, start.y, end.x, end.y)
  const zAtClosest = start.z + (end.z - start.z) * ratio
  return zAtClosest >= ring.centerHeight + Z_OVER_EPSILON
}

const segmentsIntersect = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) => {
  const cross = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
    (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)
  const d1 = cross(ax, ay, bx, by, cx, cy)
  const d2 = cross(ax, ay, bx, by, dx, dy)
  const d3 = cross(cx, cy, dx, dy, ax, ay)
  const d4 = cross(cx, cy, dx, dy, bx, by)
  return d1 * d2 <= 0 && d3 * d4 <= 0
}

const segmentDistance = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) => {
  if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) {
    return 0
  }
  return Math.min(
    distancePointToSegment(ax, ay, cx, cy, dx, dy),
    distancePointToSegment(bx, by, cx, cy, dx, dy),
    distancePointToSegment(cx, cy, ax, ay, bx, by),
    distancePointToSegment(dx, dy, ax, ay, bx, by),
  )
}

const lineIntersectionRatioOnSegment = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) => {
  const rX = bx - ax
  const rY = by - ay
  const sX = dx - cx
  const sY = dy - cy
  const denominator = cross2D(rX, rY, sX, sY)
  if (Math.abs(denominator) < 0.000001) {
    return null
  }
  const qmpX = cx - ax
  const qmpY = cy - ay
  const t = cross2D(qmpX, qmpY, sX, sY) / denominator
  const u = cross2D(qmpX, qmpY, rX, rY) / denominator
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null
  }
  return t
}

const closestRatioFromLineToSegment = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) => {
  const intersectionRatio = lineIntersectionRatioOnSegment(ax, ay, bx, by, cx, cy, dx, dy)
  if (intersectionRatio !== null) {
    return intersectionRatio
  }

  const ratioFromC = projectPointToSegmentRatio(cx, cy, ax, ay, bx, by)
  const ratioFromD = projectPointToSegmentRatio(dx, dy, ax, ay, bx, by)
  const projCX = ax + (bx - ax) * ratioFromC
  const projCY = ay + (by - ay) * ratioFromC
  const projDX = ax + (bx - ax) * ratioFromD
  const projDY = ay + (by - ay) * ratioFromD
  const distC = distanceToPoint(projCX, projCY, cx, cy)
  const distD = distanceToPoint(projDX, projDY, dx, dy)
  return distC <= distD ? ratioFromC : ratioFromD
}

const isSegmentNearLine = (line: RodLineOccluder, start: Visit, end: Visit) =>
  segmentDistance(start.x, start.y, end.x, end.y, line.x1, line.y1, line.x2, line.y2) <= LINE_OCCLUSION_DISTANCE

const isSegmentAboveLine = (line: RodLineOccluder, start: Visit, end: Visit) => {
  const ratio = closestRatioFromLineToSegment(
    start.x,
    start.y,
    end.x,
    end.y,
    line.x1,
    line.y1,
    line.x2,
    line.y2,
  )
  const zAtClosest = start.z + (end.z - start.z) * ratio
  return zAtClosest >= line.height + Z_OVER_EPSILON
}

export const buildPathSegmentsAboveRings = (
  visits: Visit[],
  occluders: RodRingOccluder[],
): PathSegment[] => {
  if (visits.length < 2 || !occluders.length) {
    return []
  }
  const segments: PathSegment[] = []
  for (let index = 1; index < visits.length; index += 1) {
    const start = visits[index - 1]
    const end = visits[index]
    const overAnyRing = occluders.some((ring) => isSegmentAboveRing(ring, start, end) && intersectsRingDisk(ring, start, end))
    if (!overAnyRing) {
      continue
    }
    segments.push({
      key: `over-ring-${index}-${start.x}-${start.y}-${start.z}-${end.x}-${end.y}-${end.z}`,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    })
  }
  return segments
}

export const buildPathSegmentsAboveLines = (
  visits: Visit[],
  occluders: RodLineOccluder[],
): PathSegment[] => {
  if (visits.length < 2 || !occluders.length) {
    return []
  }
  const segments: PathSegment[] = []
  for (let index = 1; index < visits.length; index += 1) {
    const start = visits[index - 1]
    const end = visits[index]
    const overAnyLine = occluders.some((line) => isSegmentNearLine(line, start, end) && isSegmentAboveLine(line, start, end))
    if (!overAnyLine) {
      continue
    }
    segments.push({
      key: `over-line-${index}-${start.x}-${start.y}-${start.z}-${end.x}-${end.y}-${end.z}`,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    })
  }
  return segments
}
