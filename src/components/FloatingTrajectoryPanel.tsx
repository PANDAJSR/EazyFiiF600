import { Button, Tooltip, Typography } from 'antd'
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
  | {
      type: 'resize-left'
      startX: number
      originWidth: number
    }

const PANEL_MARGIN = 12
const MIN_WIDTH = 380
const MIN_HEIGHT = 280
const DEFAULT_WIDTH = 520
const DEFAULT_HEIGHT = 460
const DEFAULT_TOP = 90
const MIN_VISIBLE_WIDTH = 280
const MIN_VISIBLE_HEIGHT = 72
const DEBUG_TAG = '[FloatingTrajectoryPanel]'

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

const clampRectToViewport = (next: Rect): Rect => {
  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - PANEL_MARGIN * 2)
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - PANEL_MARGIN * 2)
  const width = clamp(next.width, MIN_WIDTH, maxWidth)
  const height = clamp(next.height, MIN_HEIGHT, maxHeight)
  const keepWidth = Math.min(MIN_VISIBLE_WIDTH, width)
  const keepHeight = Math.min(MIN_VISIBLE_HEIGHT, height)
  const minX = -width + keepWidth
  const maxX = window.innerWidth - keepWidth
  const minY = PANEL_MARGIN
  const maxY = window.innerHeight - keepHeight

  const clamped: Rect = {
    x: clamp(next.x, minX, maxX),
    y: clamp(next.y, minY, maxY),
    width,
    height,
  }

  if (
    clamped.x !== next.x ||
    clamped.y !== next.y ||
    clamped.width !== next.width ||
    clamped.height !== next.height
  ) {
    console.warn(`${DEBUG_TAG} clamp rect`, {
      before: next,
      after: clamped,
      bounds: { minX, maxX, minY, maxY, maxWidth, maxHeight },
    })
  }

  return clamped
}

const getDockedRightRect = (currentWidth: number): Rect => {
  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - PANEL_MARGIN * 2)
  const width = clamp(currentWidth, MIN_WIDTH, maxWidth)

  return {
    x: window.innerWidth - width,
    y: 0,
    width,
    height: window.innerHeight,
  }
}

function FloatingTrajectoryPanel({ startPos, blocks, onLocateBlock }: Props) {
  const [rect, setRect] = useState<Rect>(getInitialRect)
  const [dockedRight, setDockedRight] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const floatingRectRef = useRef<Rect>(getInitialRect())

  useEffect(() => {
    const onWindowResize = () => {
      setRect((prev) => (dockedRight ? getDockedRightRect(prev.width) : clampRectToViewport(prev)))
    }

    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
  }, [dockedRight])

  useEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const visibleWidth = Math.max(0, Math.min(rect.x + rect.width, vw) - Math.max(rect.x, 0))
    const visibleHeight = Math.max(0, Math.min(rect.y + rect.height, vh) - Math.max(rect.y, 0))
    const visibleRatio = ((visibleWidth * visibleHeight) / (rect.width * rect.height)).toFixed(3)
    console.info(
      `${DEBUG_TAG} rect update`,
      { rect, viewport: { width: vw, height: vh } },
      { visibleWidth, visibleHeight, visibleRatio },
    )
  }, [rect])

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
          return clampRectToViewport({
            ...prev,
            x: nextXRaw,
            y: nextYRaw,
          })
        })
        return
      }

      if (current.type === 'resize-left') {
        const offsetX = event.clientX - current.startX
        setRect(getDockedRightRect(current.originWidth + offsetX))
        return
      }

      const offsetX = event.clientX - current.startX
      const offsetY = event.clientY - current.startY

      setRect((prev) => {
        return clampRectToViewport({
          ...prev,
          width: current.originWidth + offsetX,
          height: current.originHeight + offsetY,
        })
      })
    }

    const onPointerUp = () => {
      setRect((prev) => clampRectToViewport(prev))
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
    if (dockedRight) {
      return
    }
    event.preventDefault()
    console.info(`${DEBUG_TAG} start move`, { clientX: event.clientX, clientY: event.clientY, rect })
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
    if (dockedRight) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    console.info(`${DEBUG_TAG} start resize`, { clientX: event.clientX, clientY: event.clientY, rect })
    dragRef.current = {
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      originWidth: rect.width,
      originHeight: rect.height,
    }
    document.body.classList.add('trajectory-panel-dragging')
  }

  const startResizeFromLeft = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dockedRight) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      type: 'resize-left',
      startX: event.clientX,
      originWidth: rect.width,
    }
    document.body.classList.add('trajectory-panel-dragging')
  }

  const handleToggleDock = () => {
    if (dockedRight) {
      setDockedRight(false)
      setRect(clampRectToViewport(floatingRectRef.current))
      return
    }
    floatingRectRef.current = rect
    setDockedRight(true)
    setRect((prev) => getDockedRightRect(prev.width))
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <section
      className={`floating-trajectory-panel${dockedRight ? ' floating-trajectory-panel-docked-right' : ''}`}
      style={{
        width: `${rect.width}px`,
        height: dockedRight ? '100vh' : `${rect.height}px`,
        left: `${rect.x}px`,
        top: dockedRight ? '0px' : `${rect.y}px`,
        opacity: 1,
        visibility: 'visible',
      }}
    >
      <div className="floating-trajectory-header">
        <div className="floating-trajectory-drag-handle" onPointerDown={startMove}>
          <Typography.Title level={5} className="trajectory-title">
            飞机平面轨迹（XY）
          </Typography.Title>
        </div>
        <Tooltip title={dockedRight ? '切换为悬浮面板' : '贴右侧面板'}>
          <Button
            className="floating-trajectory-toggle-btn"
            type="text"
            size="small"
            shape="circle"
            icon={
              <span className="floating-trajectory-toggle-icon" aria-hidden>
                {dockedRight ? '🗗' : '📌'}
              </span>
            }
            onClick={handleToggleDock}
            aria-label={dockedRight ? '切换为悬浮面板' : '贴右侧面板'}
          />
        </Tooltip>
      </div>
      <div className="floating-trajectory-body">
        <TrajectoryPlane startPos={startPos} blocks={blocks} onLocateBlock={onLocateBlock} />
      </div>
      {!dockedRight && (
        <div
          className="floating-trajectory-resize"
          onPointerDown={startResize}
          role="separator"
          aria-label="调整轨迹面板大小"
        />
      )}
      {dockedRight && (
        <div
          className="floating-trajectory-resize-left"
          onPointerDown={startResizeFromLeft}
          role="separator"
          aria-label="调整右侧面板宽度"
        />
      )}
    </section>,
    document.body,
  )
}

export default FloatingTrajectoryPanel
