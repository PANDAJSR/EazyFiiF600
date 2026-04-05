import { Button } from 'antd'
import { useState } from 'react'
import type { ParseResult } from '../types/fii'
import AgentChatPanel from './AgentChatPanel'
import type { TrajectoryIssueContext } from './trajectory/trajectoryIssueContext'

type AgentChatFloatingControllerProps = {
  projectContext: ParseResult
  rodConfigContext?: unknown
  trajectoryIssueContext?: TrajectoryIssueContext
  onProjectContextPatched?: (next: ParseResult) => void
}

function AgentChatFloatingController({
  projectContext,
  rodConfigContext,
  trajectoryIssueContext,
  onProjectContextPatched,
}: AgentChatFloatingControllerProps) {
  const [panelVisible, setPanelVisible] = useState(true)

  return (
    <>
      <Button
        className="floating-agent-toggle-fab"
        type={panelVisible ? 'default' : 'primary'}
        onClick={() => setPanelVisible(true)}
      >
        AI
      </Button>
      {panelVisible && (
        <AgentChatPanel
          projectContext={projectContext}
          rodConfigContext={rodConfigContext}
          trajectoryIssueContext={trajectoryIssueContext}
          onProjectContextPatched={onProjectContextPatched}
          onClose={() => setPanelVisible(false)}
        />
      )}
    </>
  )
}

export default AgentChatFloatingController
