import { useCallback, useEffect, useRef, useState } from 'react'

type PanelPosition = {
  x: number
  y: number
}

type PanelDragState = {
  startX: number
  startY: number
  originX: number
  originY: number
}

const FLOATING_PANEL_WIDTH = 460
const FLOATING_PANEL_MAX_HEIGHT = 720
const FLOATING_PANEL_HEIGHT_RATIO = 0.72
const FLOATING_PANEL_MARGIN = 20
const MOBILE_BREAKPOINT = 900

const getFloatingPanelHeight = () => Math.min(window.innerHeight * FLOATING_PANEL_HEIGHT_RATIO, FLOATING_PANEL_MAX_HEIGHT)

const getInitialPanelPosition = (): PanelPosition => ({
  x: Math.max(FLOATING_PANEL_MARGIN, window.innerWidth - FLOATING_PANEL_WIDTH - FLOATING_PANEL_MARGIN),
  y: Math.max(FLOATING_PANEL_MARGIN, window.innerHeight - getFloatingPanelHeight() - FLOATING_PANEL_MARGIN),
})

const clampPanelPosition = (position: PanelPosition): PanelPosition => {
  const maxX = Math.max(FLOATING_PANEL_MARGIN, window.innerWidth - FLOATING_PANEL_WIDTH - FLOATING_PANEL_MARGIN)
  const maxY = Math.max(FLOATING_PANEL_MARGIN, window.innerHeight - getFloatingPanelHeight() - FLOATING_PANEL_MARGIN)
  return {
    x: Math.min(Math.max(position.x, FLOATING_PANEL_MARGIN), maxX),
    y: Math.min(Math.max(position.y, FLOATING_PANEL_MARGIN), maxY),
  }
}

function useFloatingAgentPosition() {
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(() => {
    if (typeof window === 'undefined' || window.innerWidth <= MOBILE_BREAKPOINT) {
      return null
    }
    return getInitialPanelPosition()
  })
  const dragStateRef = useRef<PanelDragState | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current
      if (!state) {
        return
      }
      event.preventDefault()
      const nextX = state.originX + (event.clientX - state.startX)
      const nextY = state.originY + (event.clientY - state.startY)
      setPanelPosition(clampPanelPosition({ x: nextX, y: nextY }))
    }

    const handlePointerUp = () => {
      if (!dragStateRef.current) {
        return
      }
      dragStateRef.current = null
      document.body.classList.remove('agent-panel-dragging')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.classList.remove('agent-panel-dragging')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleResize = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setPanelPosition(null)
        return
      }
      setPanelPosition((prev) => clampPanelPosition(prev ?? getInitialPanelPosition()))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const startDragPanel = useCallback((event: React.PointerEvent<HTMLElement>, ignoreSelector?: string) => {
    if (typeof window === 'undefined' || window.innerWidth <= MOBILE_BREAKPOINT) {
      return
    }
    if (event.button !== 0) {
      return
    }
    if (ignoreSelector && (event.target as HTMLElement).closest(ignoreSelector)) {
      return
    }
    const basePosition = panelPosition ?? getInitialPanelPosition()
    event.preventDefault()
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: basePosition.x,
      originY: basePosition.y,
    }
    document.body.classList.add('agent-panel-dragging')
  }, [panelPosition])

  return { panelPosition, startDragPanel }
}

export default useFloatingAgentPosition
