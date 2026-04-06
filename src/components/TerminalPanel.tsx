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
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { panelPosition, startDragPanel } = useFloatingTerminalPosition()

  const connectedRef = useRef(false)

  useEffect(() => {
    if (!isDesktopRuntime() || !terminalRef.current) {
      return
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
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
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    const measureAndFit = () => {
      if (fitAddonRef.current && terminalRef.current?.offsetParent !== null) {
        try {
          fitAddonRef.current.fit()
        } catch {
        }
      }
    }

    requestAnimationFrame(() => {
      measureAndFit()
    })

    terminalInstanceRef.current = term

    const cols = term.cols
    const rows = term.rows

    terminalCreate({ id: TERMINAL_ID, cols, rows })
      .then((result) => {
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
        setError(`终端创建失败: ${err.message}`)
      })

    const unsubData = onTerminalData((event) => {
      if (event.id === TERMINAL_ID && terminalInstanceRef.current) {
        terminalInstanceRef.current.write(event.data)
      }
    })

    const unsubExit = onTerminalExit((event) => {
      if (event.id === TERMINAL_ID && terminalInstanceRef.current) {
        terminalInstanceRef.current.write('\r\n[终端已关闭]\r\n')
        connectedRef.current = false
        setConnected(false)
      }
    })

    term.onData((data) => {
      if (connectedRef.current) {
        terminalWrite({ id: TERMINAL_ID, data })
      }
    })

    term.onResize(({ cols: newCols, rows: newRows }) => {
      if (connectedRef.current) {
        terminalResize({ id: TERMINAL_ID, cols: newCols, rows: newRows })
      }
    })

    const handleResize = () => {
      measureAndFit()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      unsubData?.()
      unsubExit?.()
      terminalDestroy({ id: TERMINAL_ID }).catch(() => {})
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose()
        terminalInstanceRef.current = null
      }
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