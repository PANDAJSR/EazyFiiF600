import { useEffect, useRef, useState } from 'react'
import { Button, Typography } from 'antd'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { isDesktopRuntime, onTerminalData, onTerminalExit, terminalCreate, terminalDestroy, terminalResize, terminalWrite } from '../utils/desktopBridge'
import useFloatingTerminalPosition from './useFloatingTerminalPosition'

type TerminalPanelProps = {
  onClose?: () => void
}

const TERMINAL_ID = 'main-terminal'
const TERMINAL_FONT_FAMILY = '"SourceCodePro+Powerline+Awesome Regular", "SourceCodePro+Powerline+Awesome", "Source Code Pro for Powerline", "SauceCodePro Nerd Font", "MesloLGS NF", "MesloLGS Nerd Font", "CaskaydiaCove Nerd Font", "FiraCode Nerd Font", "JetBrainsMono Nerd Font", "Hack Nerd Font", "Symbols Nerd Font Mono", "Noto Sans Mono CJK SC", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'

function TerminalPanel({ onClose }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const fitRafRef = useRef<number | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { panelPosition, startDragPanel } = useFloatingTerminalPosition()

  const connectedRef = useRef(false)

  useEffect(() => {
    if (!isDesktopRuntime() || !terminalRef.current) {
      return
    }
    let disposed = false
    let localDataSubscription: { dispose: () => void } | null = null
    let localResizeSubscription: { dispose: () => void } | null = null
    let localObserver: ResizeObserver | null = null
    let unsubData: (() => void) | null = null
    let unsubExit: (() => void) | null = null
    let handleResize: (() => void) | null = null

    const initHandle = window.setTimeout(() => {
      if (disposed || !terminalRef.current) {
        return
      }

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        lineHeight: 1.08,
        fontFamily: TERMINAL_FONT_FAMILY,
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#ffffff',
          selectionBackground: 'rgba(255, 255, 255, 0.3)',
        },
        rows: 24,
        cols: 80,
      })

      const fitAddon = new FitAddon()
      fitAddonRef.current = fitAddon
      term.loadAddon(fitAddon)
      term.open(terminalRef.current)
      terminalInstanceRef.current = term

      const measureAndFit = () => {
        if (disposed) {
          return
        }
        if (fitAddonRef.current && terminalInstanceRef.current && terminalRef.current?.offsetParent !== null) {
          try {
            fitAddonRef.current.fit()
          } catch {
            // Ignore transient measurement errors while layout stabilizes.
          }
        }
      }

      fitRafRef.current = requestAnimationFrame(() => {
        fitRafRef.current = null
        measureAndFit()
      })

      const cols = term.cols
      const rows = term.rows

      terminalCreate({ id: TERMINAL_ID, cols, rows })
        .then((result) => {
          if (disposed) {
            return
          }
          console.log('[TerminalPanel] terminalCreate result:', result)
          if (!result) {
            setError('无法创建终端：非桌面环境')
            return
          }
          if (!result.ok) {
            setError(`终端创建失败: ${result.error}`)
            return
          }
          connectedRef.current = true
          setConnected(true)
        })
        .catch((err) => {
          if (disposed) {
            return
          }
          console.error('[TerminalPanel] terminalCreate error:', err)
          setError(`终端创建失败: ${err.message}`)
        })

      unsubData = onTerminalData((event) => {
        console.log('[TerminalPanel] onTerminalData:', event.id, TERMINAL_ID)
        if (event.id === TERMINAL_ID && terminalInstanceRef.current) {
          terminalInstanceRef.current.write(event.data)
        }
      })

      unsubExit = onTerminalExit((event) => {
        console.log('[TerminalPanel] onTerminalExit:', event)
        if (event.id === TERMINAL_ID && terminalInstanceRef.current) {
          terminalInstanceRef.current.write('\r\n[终端已关闭]\r\n')
          connectedRef.current = false
          setConnected(false)
        }
      })

      localDataSubscription = term.onData((data) => {
        if (connectedRef.current) {
          console.log('[TerminalPanel] term.onData, writing to terminal')
          terminalWrite({ id: TERMINAL_ID, data })
        }
      })

      localResizeSubscription = term.onResize(({ cols: newCols, rows: newRows }) => {
        if (connectedRef.current) {
          console.log('[TerminalPanel] term.onResize:', newCols, newRows)
          terminalResize({ id: TERMINAL_ID, cols: newCols, rows: newRows })
        }
      })

      handleResize = () => {
        measureAndFit()
      }
      window.addEventListener('resize', handleResize)
      if (typeof ResizeObserver !== 'undefined' && terminalRef.current) {
        localObserver = new ResizeObserver(() => {
          if (fitRafRef.current !== null) {
            cancelAnimationFrame(fitRafRef.current)
          }
          fitRafRef.current = requestAnimationFrame(() => {
            fitRafRef.current = null
            measureAndFit()
          })
        })
        localObserver.observe(terminalRef.current)
      }
    }, 0)

    return () => {
      disposed = true
      window.clearTimeout(initHandle)
      if (fitRafRef.current !== null) {
        cancelAnimationFrame(fitRafRef.current)
        fitRafRef.current = null
      }
      if (handleResize) {
        window.removeEventListener('resize', handleResize)
      }
      localObserver?.disconnect()
      localDataSubscription?.dispose()
      localResizeSubscription?.dispose()
      unsubData?.()
      unsubExit?.()
      connectedRef.current = false
      setConnected(false)
      fitAddonRef.current = null
      const terminalInstance = terminalInstanceRef.current
      terminalInstanceRef.current = null
      terminalDestroy({ id: TERMINAL_ID }).catch(() => {})
      terminalInstance?.dispose()
    }
  }, [])

  const handleClear = () => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear()
    }
  }

  return (
    <section
      className="floating-terminal-panel"
      style={panelPosition
        ? {
            left: `${panelPosition.x}px`,
            top: `${panelPosition.y}px`,
            right: 'auto',
            bottom: 'auto',
          }
        : undefined}
    >
      <header className="floating-terminal-header" onPointerDown={(event) => startDragPanel(event, '.floating-terminal-header-actions')}>
        <Typography.Text strong>终端</Typography.Text>
        <div className="floating-terminal-header-actions">
          {connected && <Typography.Text type="secondary" className="terminal-status">运行中</Typography.Text>}
          <Button size="small" onClick={handleClear}>清空</Button>
          <Button
            className="floating-terminal-close-btn"
            type="text"
            size="small"
            shape="circle"
            aria-label="关闭终端"
            onClick={onClose}
          >
            ×
          </Button>
        </div>
      </header>

      <div className="floating-terminal-body">
        {!isDesktopRuntime() && (
          <div className="terminal-error">当前不是 Electron 桌面环境，终端面板不可用。</div>
        )}
        {error && <div className="terminal-error">{error}</div>}
        <div ref={terminalRef} className="terminal-container" />
      </div>
    </section>
  )
}

export default TerminalPanel
