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

/**
 * ⚠️ 已废弃 (Deprecated)
 * 
 * 此组件保留仅供历史参考。内置 Agent 功能已不再维护，
 * 请使用外部 Agent (如 ClaudeCode / OpenCode) 通过 eazyfii-skill HTTP API 进行操作。
 * 
 * 相关文档: /eazyfii-skill/SKILL.md
 */
function AgentChatFloatingController({
  projectContext,
  rodConfigContext,
  trajectoryIssueContext,
  onProjectContextPatched,
}: AgentChatFloatingControllerProps) {
  // 默认隐藏，此功能已废弃
  const [panelVisible, setPanelVisible] = useState(false)

  return (
    <>
      <Button
        className="floating-agent-toggle-fab"
        type={panelVisible ? 'default' : 'primary'}
        onClick={() => setPanelVisible(true)}
        title="内置 Agent (已废弃，请使用外部 Agent)"
      >
        AI [废弃]
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
