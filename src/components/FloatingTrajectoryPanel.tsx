import { Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ParsedBlock } from '../types/fii'
import TrajectoryPlane from './TrajectoryPlane'

type XYZ = {
  x: string
  y: string
  z: string
}

type Props = {
  startPos: XYZ
  blocks: ParsedBlock[]
  onLocateBlock?: (blockId: string) => void
}

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type DragState =
  | {
      type: 'move'
      startX: number
      startY: number
      originX: number
      originY: number
    }
  | {
      type: 'resize'
      startX: number
      startY: number
      originWidth: number
      originHeight: number
    }

const PANEL_MARGIN = 12
const MIN_WIDTH = 380
const MIN_HEIGHT = 280
const DEFAULT_WIDTH = 520
const DEFAULT_HEIGHT = 460
const DEFAULT_TOP = 90
const VISIBLE_GRAB_WIDTH = 120
const VISIBLE_GRAB_HEIGHT = 44

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getInitialRect = (): Rect => {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  }

  const width = Math.min(DEFAULT_WIDTH, window.innerWidth - PANEL_MARGIN * 2)
  const height = Math.min(DEFAULT_HEIGHT, window.innerHeight - PANEL_MARGIN * 2)
  const x = window.innerWidth - width - 24
  const y = Math.max(PANEL_MARGIN, DEFAULT_TOP)

  return { x, y, width, height }
}

function FloatingTrajectoryPanel({ startPos, blocks, onLocateBlock }: Props) {
  const [rect, setRect] = useState<Rect>(getInitialRect)
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    const onWindowResize = () => {
      setRect((prev) => {
        const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - PANEL_MARGIN * 2)
        const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - PANEL_MARGIN * 2)
        const width = clamp(prev.width, MIN_WIDTH, maxWidth)
        const height = clamp(prev.height, MIN_HEIGHT, maxHeight)
        const minX = -width + VISIBLE_GRAB_WIDTH
        const maxX = window.innerWidth - VISIBLE_GRAB_WIDTH
        const minY = PANEL_MARGIN
        const maxY = window.innerHeight - VISIBLE_GRAB_HEIGHT

        return {
          x: clamp(prev.x, minX, maxX),
          y: clamp(prev.y, minY, maxY),
          width,
          height,
        }
      })
    }

    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
  }, [])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const current = dragRef.current
      if (!current) {
        return
      }

      event.preventDefault()

      if (current.type === 'move') {
        const offsetX = event.clientX - current.startX
        const offsetY = event.clientY - current.startY

        setRect((prev) => {
          const nextXRaw = current.originX + offsetX
          const nextYRaw = current.originY + offsetY
          const minX = -prev.width + VISIBLE_GRAB_WIDTH
          const maxX = window.innerWidth - VISIBLE_GRAB_WIDTH
          const minY = PANEL_MARGIN
          const maxY = window.innerHeight - VISIBLE_GRAB_HEIGHT
          return {
            ...prev,
            x: clamp(nextXRaw, minX, maxX),
            y: clamp(nextYRaw, minY, maxY),
          }
        })
        return
      }

      const offsetX = event.clientX - current.startX
      const offsetY = event.clientY - current.startY

      setRect((prev) => {
        const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - prev.x - PANEL_MARGIN)
        const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - prev.y - PANEL_MARGIN)

        return {
          ...prev,
          width: clamp(current.originWidth + offsetX, MIN_WIDTH, maxWidth),
          height: clamp(current.originHeight + offsetY, MIN_HEIGHT, maxHeight),
        }
      })
    }

    const onPointerUp = () => {
      dragRef.current = null
      document.body.classList.remove('trajectory-panel-dragging')
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  const startMove = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragRef.current = {
      type: 'move',
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.x,
      originY: rect.y,
    }
    document.body.classList.add('trajectory-panel-dragging')
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      originWidth: rect.width,
      originHeight: rect.height,
    }
    document.body.classList.add('trajectory-panel-dragging')
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <section
      className="floating-trajectory-panel"
      style={{
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: `translate(${rect.x}px, ${rect.y}px)`,
      }}
    >
      <div className="floating-trajectory-header" onPointerDown={startMove}>
        <Typography.Title level={5} className="trajectory-title">
          飞机平面轨迹（XY）
        </Typography.Title>
      </div>
      <div className="floating-trajectory-body">
        <TrajectoryPlane startPos={startPos} blocks={blocks} onLocateBlock={onLocateBlock} />
      </div>
      <div
        className="floating-trajectory-resize"
        onPointerDown={startResize}
        role="separator"
        aria-label="调整轨迹面板大小"
      />
    </section>,
    document.body,
  )
}

export default FloatingTrajectoryPanel
