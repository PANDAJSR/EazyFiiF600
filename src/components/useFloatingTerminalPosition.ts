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

const FLOATING_TERMINAL_PANEL_WIDTH = 700
const FLOATING_TERMINAL_PANEL_HEIGHT = 480
const FLOATING_TERMINAL_PANEL_MARGIN = 20
const MOBILE_BREAKPOINT = 900

const getInitialPanelPosition = (): PanelPosition => ({
  x: Math.max(FLOATING_TERMINAL_PANEL_MARGIN, window.innerWidth - FLOATING_TERMINAL_PANEL_WIDTH - FLOATING_TERMINAL_PANEL_MARGIN),
  y: Math.max(FLOATING_TERMINAL_PANEL_MARGIN, window.innerHeight - FLOATING_TERMINAL_PANEL_HEIGHT - FLOATING_TERMINAL_PANEL_MARGIN),
})

const clampPanelPosition = (position: PanelPosition): PanelPosition => {
  const maxX = Math.max(FLOATING_TERMINAL_PANEL_MARGIN, window.innerWidth - FLOATING_TERMINAL_PANEL_WIDTH - FLOATING_TERMINAL_PANEL_MARGIN)
  const maxY = Math.max(FLOATING_TERMINAL_PANEL_MARGIN, window.innerHeight - FLOATING_TERMINAL_PANEL_HEIGHT - FLOATING_TERMINAL_PANEL_MARGIN)
  return {
    x: Math.min(Math.max(position.x, FLOATING_TERMINAL_PANEL_MARGIN), maxX),
    y: Math.min(Math.max(position.y, FLOATING_TERMINAL_PANEL_MARGIN), maxY),
  }
}

function useFloatingTerminalPosition() {
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
      document.body.classList.remove('terminal-panel-dragging')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.classList.remove('terminal-panel-dragging')
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
    document.body.classList.add('terminal-panel-dragging')
  }, [panelPosition])

  return { panelPosition, startDragPanel }
}

export default useFloatingTerminalPosition