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

function TerminalPanel({ onClose }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const activeTerminalRef = useRef<Terminal | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { panelPosition, startDragPanel } = useFloatingTerminalPosition()

  const connectedRef = useRef(false)

  useEffect(() => {
    if (!isDesktopRuntime()) {
      return
    }

    let disposed = false
    let frameId = 0
    let removeWindowResize: (() => void) | null = null
    let unsubData: (() => void) | null = null
    let unsubExit: (() => void) | null = null

    const initializeTerminal = () => {
      if (disposed || !terminalRef.current || terminalInstanceRef.current) {
        return
      }

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"SourceCodePro+Powerline+Awesome...", ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#ffffff',
          selection: 'rgba(255, 255, 255, 0.3)',
        },
        rows: 24,
        cols: 80,
      })

      const fitAddon = new FitAddon()
      fitAddonRef.current = fitAddon
      terminalInstanceRef.current = term
      activeTerminalRef.current = term

      term.loadAddon(fitAddon)
      term.open(terminalRef.current)

      const measureAndFit = () => {
        if (disposed || activeTerminalRef.current !== term || terminalRef.current?.offsetParent === null) {
          return
        }
        try {
          fitAddon.fit()
        } catch {
          // Ignore xterm measurement errors during transient layout.
        }
      }

      measureAndFit()

      terminalCreate({ id: TERMINAL_ID, cols: term.cols, rows: term.rows })
        .then((result) => {
          if (disposed || activeTerminalRef.current !== term) {
            return
          }
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
          void terminalResize({ id: TERMINAL_ID, cols: term.cols, rows: term.rows })
        })
        .catch((err) => {
          if (disposed || activeTerminalRef.current !== term) {
            return
          }
          setError(`终端创建失败: ${err.message}`)
        })

      unsubData = onTerminalData((event) => {
        if (event.id === TERMINAL_ID && activeTerminalRef.current === term) {
          term.write(event.data)
        }
      })

      unsubExit = onTerminalExit((event) => {
        if (event.id === TERMINAL_ID && activeTerminalRef.current === term) {
          term.write('\r\n[终端已关闭]\r\n')
          connectedRef.current = false
          setConnected(false)
        }
      })

      term.onData((data) => {
        if (connectedRef.current && activeTerminalRef.current === term) {
          void terminalWrite({ id: TERMINAL_ID, data })
        }
      })

      term.onResize(({ cols: newCols, rows: newRows }) => {
        if (connectedRef.current && activeTerminalRef.current === term) {
          void terminalResize({ id: TERMINAL_ID, cols: newCols, rows: newRows })
        }
      })

      const handleResize = () => {
        measureAndFit()
      }
      window.addEventListener('resize', handleResize)
      removeWindowResize = () => window.removeEventListener('resize', handleResize)
    }

    frameId = requestAnimationFrame(initializeTerminal)

    return () => {
      disposed = true
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
      removeWindowResize?.()
      unsubData?.()
      unsubExit?.()
      connectedRef.current = false
      setConnected(false)
      void terminalDestroy({ id: TERMINAL_ID })
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose()
        terminalInstanceRef.current = null
      }
      fitAddonRef.current = null
      activeTerminalRef.current = null
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
