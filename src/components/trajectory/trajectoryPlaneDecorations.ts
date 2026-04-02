import { ROD_SUBJECT_SPECS, type RodConfig } from './rodConfig'

type XYPoint = {
  x: number
  y: number
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

  return points.length === 4 ? points : []
}
