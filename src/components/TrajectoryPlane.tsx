import { Empty } from 'antd'
import type { ParsedBlock } from '../types/fii'

type XY = {
  x: string
  y: string
}

type Props = {
  startPos: XY
  blocks: ParsedBlock[]
}

type Point = {
  x: number
  y: number
}

const VIEWBOX_WIDTH = 780
const VIEWBOX_HEIGHT = 620
const GRID_STEP = 20

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const buildPathPoints = (startPos: XY, blocks: ParsedBlock[]): Point[] => {
  const startX = toNumber(startPos.x) ?? 0
  const startY = toNumber(startPos.y) ?? 0
  const points: Point[] = [{ x: startX, y: startY }]

  let currentX = startX
  let currentY = startY

  blocks.forEach((block) => {
    if (block.type === 'Goertek_MoveToCoord2') {
      const nextX = toNumber(block.fields.X)
      const nextY = toNumber(block.fields.Y)
      if (nextX === null || nextY === null) {
        return
      }
      currentX = nextX
      currentY = nextY
      points.push({ x: currentX, y: currentY })
      return
    }

    if (block.type === 'Goertek_Move') {
      const deltaX = toNumber(block.fields.X)
      const deltaY = toNumber(block.fields.Y)
      if (deltaX === null || deltaY === null) {
        return
      }
      currentX += deltaX
      currentY += deltaY
      points.push({ x: currentX, y: currentY })
    }
  })

  return points
}

const buildTicks = (min: number, max: number): number[] => {
  const ticks: number[] = []
  for (let value = min; value <= max; value += GRID_STEP) {
    ticks.push(value)
  }
  return ticks
}

function TrajectoryPlane({ startPos, blocks }: Props) {
  const points = buildPathPoints(startPos, blocks)

  if (!points.length) {
    return <Empty description="暂无可绘制轨迹" />
  }

  const rawMinX = Math.min(0, ...points.map((point) => point.x))
  const rawMaxX = Math.max(360, ...points.map((point) => point.x))
  const rawMinY = Math.min(0, ...points.map((point) => point.y))
  const rawMaxY = Math.max(360, ...points.map((point) => point.y))

  const minX = Math.floor(rawMinX / GRID_STEP) * GRID_STEP
  const maxX = Math.ceil(rawMaxX / GRID_STEP) * GRID_STEP
  const minY = Math.floor(rawMinY / GRID_STEP) * GRID_STEP
  const maxY = Math.ceil(rawMaxY / GRID_STEP) * GRID_STEP

  const margin = { top: 16, right: 16, bottom: 44, left: 44 }
  const innerWidth = VIEWBOX_WIDTH - margin.left - margin.right
  const innerHeight = VIEWBOX_HEIGHT - margin.top - margin.bottom
  const xSpan = Math.max(maxX - minX, GRID_STEP)
  const ySpan = Math.max(maxY - minY, GRID_STEP)

  const toSvgX = (x: number) => margin.left + ((x - minX) / xSpan) * innerWidth
  const toSvgY = (y: number) => margin.top + (1 - (y - minY) / ySpan) * innerHeight

  const xTicks = buildTicks(minX, maxX)
  const yTicks = buildTicks(minY, maxY)

  const polylinePoints = points.map((point) => `${toSvgX(point.x)},${toSvgY(point.y)}`).join(' ')
  const start = points[0]
  const end = points[points.length - 1]

  return (
    <div className="trajectory-card">
      <div className="trajectory-meta">
        范围 X: {minX} ~ {maxX} cm，Y: {minY} ~ {maxY} cm
      </div>
      <svg className="trajectory-svg" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img">
        <rect
          x={margin.left}
          y={margin.top}
          width={innerWidth}
          height={innerHeight}
          className="trajectory-grid-bg"
        />
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={toSvgX(tick)}
              y1={margin.top}
              x2={toSvgX(tick)}
              y2={margin.top + innerHeight}
              className="trajectory-grid-line"
            />
            <text
              x={toSvgX(tick)}
              y={VIEWBOX_HEIGHT - 14}
              textAnchor="middle"
              className="trajectory-axis-label"
            >
              {tick}
            </text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={margin.left}
              y1={toSvgY(tick)}
              x2={margin.left + innerWidth}
              y2={toSvgY(tick)}
              className="trajectory-grid-line"
            />
            <text
              x={margin.left - 8}
              y={toSvgY(tick) + 4}
              textAnchor="end"
              className="trajectory-axis-label"
            >
              {tick}
            </text>
          </g>
        ))}
        <polyline points={polylinePoints} className="trajectory-line" />
        <circle cx={toSvgX(start.x)} cy={toSvgY(start.y)} r={6} className="trajectory-point-start" />
        <circle cx={toSvgX(end.x)} cy={toSvgY(end.y)} r={6} className="trajectory-point-end" />
      </svg>
    </div>
  )
}

export default TrajectoryPlane
