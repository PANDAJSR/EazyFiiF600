import { ROD_SUBJECT_SPECS, type RodConfig } from './rodConfig'

type XYPoint = {
  x: number
  y: number
}

const sortPointsAroundCenter = (points: XYPoint[]): XYPoint[] => {
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 },
  )

  return [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x)
    const angleB = Math.atan2(b.y - center.y, b.x - center.x)

    if (angleA === angleB) {
      const distanceA = (a.x - center.x) ** 2 + (a.y - center.y) ** 2
      const distanceB = (b.x - center.x) ** 2 + (b.y - center.y) ** 2
      return distanceA - distanceB
    }

    return angleA - angleB
  })
}

export const buildRodMarkers = (rodConfig?: RodConfig): Array<XYPoint & { marker: string }> => {
  if (!rodConfig) {
    return []
  }

  return ROD_SUBJECT_SPECS.flatMap((subject) =>
    rodConfig[subject.id]
      .map((point) => ({ marker: subject.marker, x: point.x, y: point.y }))
      .filter((point): point is XYPoint & { marker: string } => Number.isFinite(point.x) && Number.isFinite(point.y)),
  )
}

export const buildTakeoffZone = (rodConfig?: RodConfig): XYPoint[] => {
  if (!rodConfig || rodConfig.takeoffZone.length < 4) {
    return []
  }

  const points = rodConfig.takeoffZone
    .slice(0, 4)
    .filter((point): point is XYPoint => Number.isFinite(point.x) && Number.isFinite(point.y))

  return points.length === 4 ? sortPointsAroundCenter(points) : []
}
