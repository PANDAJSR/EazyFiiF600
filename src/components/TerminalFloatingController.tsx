import { Button } from 'antd'
import { useState } from 'react'
import TerminalPanel from './TerminalPanel'

function TerminalFloatingController() {
  const [panelVisible, setPanelVisible] = useState(false)

  return (
    <>
      <Button
        className="floating-terminal-toggle-fab"
        type={panelVisible ? 'default' : 'primary'}
        onClick={() => setPanelVisible(true)}
      >
        终端
      </Button>
      {panelVisible && (
        <TerminalPanel
          onClose={() => setPanelVisible(false)}
        />
      )}
    </>
  )
}

export default TerminalFloatingController