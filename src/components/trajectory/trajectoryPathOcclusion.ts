import type { RodRingOccluder } from './trajectoryPlaneDecorations'
import type { Visit } from './trajectoryUtils'

export type PathSegment = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const Z_OVER_EPSILON = 2

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

const intersectsRingDisk = (ring: RodRingOccluder, start: Visit, end: Visit) => {
  const d1 = distanceToPoint(start.x, start.y, ring.cx, ring.cy)
  const d2 = distanceToPoint(end.x, end.y, ring.cx, ring.cy)
  const minDistance = distancePointToSegment(ring.cx, ring.cy, start.x, start.y, end.x, end.y)
  const maxEndpointDistance = Math.max(d1, d2)
  return minDistance <= ring.r && maxEndpointDistance >= ring.r
}

const isSegmentAboveRing = (ring: RodRingOccluder, start: Visit, end: Visit) =>
  (start.z + end.z) / 2 >= ring.centerHeight + Z_OVER_EPSILON

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
