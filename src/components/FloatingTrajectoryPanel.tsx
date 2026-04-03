import { Button, Segmented, Tooltip, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ParsedBlock } from '../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from '../utils/autoDelayBlocks'
import TrajectoryPlane from './TrajectoryPlane'
import type { TrajectoryDisplay } from './useTrajectoryVisibility'
import RodConfigPanel from './trajectory/RodConfigPanel'
import { createDefaultRodConfig, type RodConfig } from './trajectory/rodConfig'
import { loadRodConfigFromDirectory, saveRodConfigToDirectory } from './trajectory/rodConfigStorage'
import { buildTrajectoryIssues } from './trajectory/trajectoryIssues'

type XYZ = {
  x: string
  y: string
  z: string
}

type Props = {
  openedDirectoryPath?: string
  startPos: XYZ
  blocks: ParsedBlock[]
  selectedBlockId?: string
  pathDrawingMode?: boolean
  onPathDrawingToggle?: (enabled: boolean) => void
  onDrawPathPoint?: (x: number, y: number) => void
  onLocateBlock?: (blockId: string) => void
  onMovePoint?: (payload: {
    blockId: string
    blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move' | typeof AUTO_DELAY_BLOCK_TYPE
    x: number
    y: number
    baseX?: number
    baseY?: number
  }) => void
  backgroundTrajectories?: TrajectoryDisplay[]
  activeTrajectoryColor?: string
}

type ViewMode = '2d' | '3d' | 'rod'

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

function FloatingTrajectoryPanel({
  openedDirectoryPath,
  startPos,
  blocks,
  selectedBlockId,
  pathDrawingMode = false,
  onPathDrawingToggle,
  onDrawPathPoint,
  onLocateBlock,
  onMovePoint,
  backgroundTrajectories = [],
  activeTrajectoryColor = '#1b6ed6',
}: Props) {
  const [rect, setRect] = useState<Rect>(getInitialRect)
  const [dockedRight, setDockedRight] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [rodConfig, setRodConfig] = useState<RodConfig>(() => createDefaultRodConfig())
  const dragRef = useRef<DragState | null>(null)
  const floatingRectRef = useRef<Rect>(getInitialRect())
  const skipSaveOnceRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      if (!openedDirectoryPath) {
        skipSaveOnceRef.current = true
        setRodConfig(createDefaultRodConfig())
        return
      }

      const loadedConfig = await loadRodConfigFromDirectory(openedDirectoryPath)
      if (cancelled) {
        return
      }

      skipSaveOnceRef.current = true
      setRodConfig(loadedConfig ?? createDefaultRodConfig())
    }

    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [openedDirectoryPath])

  useEffect(() => {
    if (!openedDirectoryPath) {
      return
    }

    if (skipSaveOnceRef.current) {
      skipSaveOnceRef.current = false
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveRodConfigToDirectory(openedDirectoryPath, rodConfig).then((success) => {
        if (!success) {
          console.warn('[rod-config] failed to write eazyfii_config.json')
        }
      })
    }, 1000)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [openedDirectoryPath, rodConfig])

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
        setRect(getDockedRightRect(current.originWidth - offsetX))
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
      if (!dragRef.current) {
        return
      }
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

  const issueWarnings = useMemo(
    () => buildTrajectoryIssues(startPos, blocks, rodConfig),
    [blocks, rodConfig, startPos],
  )

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
            {viewMode === '2d' ? '飞机平面轨迹（XY）' : viewMode === '3d' ? '飞机三维轨迹（XYZ）' : '杆子配置'}
          </Typography.Title>
        </div>
        {viewMode === '2d' && !!selectedBlockId && (
          <Tooltip title={pathDrawingMode ? '退出画路径模式' : '连续点击平面点位，自动生成“智能平移”积木'}>
            <Button
              className="floating-trajectory-draw-btn"
              type={pathDrawingMode ? 'primary' : 'default'}
              size="small"
              onClick={() => onPathDrawingToggle?.(!pathDrawingMode)}
            >
              {pathDrawingMode ? '退出画路径' : '画路径'}
            </Button>
          </Tooltip>
        )}
        <Segmented<ViewMode>
          className="floating-trajectory-view-tabs"
          size="small"
          value={viewMode}
          onChange={(value) => setViewMode(value)}
          options={[
            { label: '2D', value: '2d' },
            { label: '3D', value: '3d' },
            { label: '杆子配置', value: 'rod' },
          ]}
        />
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
        <div className="floating-trajectory-main">
          {viewMode === 'rod' ? (
            <RodConfigPanel config={rodConfig} onChange={setRodConfig} />
          ) : (
            <TrajectoryPlane
              startPos={startPos}
              blocks={blocks}
              pathDrawingMode={pathDrawingMode && viewMode === '2d'}
              onDrawPathPoint={onDrawPathPoint}
              onLocateBlock={onLocateBlock}
              onMovePoint={onMovePoint}
              viewMode={viewMode}
              rodConfig={rodConfig}
              backgroundTrajectories={backgroundTrajectories}
              activeTrajectoryColor={activeTrajectoryColor}
            />
          )}
        </div>
        <section className="trajectory-issue-panel" aria-label="问题面板">
          <div className="trajectory-issue-title">问题</div>
          {issueWarnings.length ? (
            <ul className="trajectory-issue-list">
              {issueWarnings.map((issue, index) => (
                <li key={issue.key} className="trajectory-issue-item trajectory-issue-item-warn">
                  {issue.blockId ? (
                    <button
                      type="button"
                      className="trajectory-issue-link"
                      onClick={() => {
                        if (issue.blockId) {
                          onLocateBlock?.(issue.blockId)
                        }
                      }}
                    >
                      [{String(index + 1).padStart(2, '0')}] {issue.message}
                    </button>
                  ) : (
                    <span>[{String(index + 1).padStart(2, '0')}] {issue.message}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="trajectory-issue-empty">[00] 暂无问题</div>
          )}
        </section>
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
