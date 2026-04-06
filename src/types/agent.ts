import type { ParseResult } from './fii'

export type AgentToolName =
  | 'Bash'
  | 'ListProjectDrones'
  | 'GetDroneBlocks'
  | 'PatchDroneProgram'
  | 'GetRodConfig'
  | 'GetBlockCatalog'
  | 'GetTrajectoryIssuesDetailed'
  | 'GetTrajectoryDebugSnapshot'

export type AgentToolTrace = {
  phase: 'start' | 'end'
  tool: 'Bash'
  command: string
  timeoutSec: number
  granted?: boolean
  resultPreview?: string
}

export type AgentChatPayload = {
  message: string
  reset?: boolean
  requestId?: string
  enableReasoning?: boolean
  projectContext?: ParseResult
  rodConfigContext?: unknown
  trajectoryIssueContext?: unknown
}

export type AgentChatSuccess = {
  ok: true
  reply: string
  traces: AgentToolTrace[]
  provider: 'openai' | 'azure'
  model: string
  transportMode: 'chat' | 'responses'
  projectContext?: ParseResult
}

export type AgentChatFailure = {
  ok: false
  error: string
}

export type AgentChatResult = AgentChatSuccess | AgentChatFailure

export type AgentRuntimeStatus = {
  busy: boolean
  phase: string
  detail: string
  startedAt: number | null
  updatedAt: number
  requestCount: number
  lastError: string | null
}

export type AgentStatusSuccess = {
  ok: true
  status: AgentRuntimeStatus
}

export type AgentStatusFailure = {
  ok: false
  error: string
}

export type AgentStatusResult = AgentStatusSuccess | AgentStatusFailure

export type AgentEnvValues = Record<string, string>

export type AgentEnvSuccess = {
  ok: true
  values: AgentEnvValues
  allowedKeys: string[]
  storagePath: string
}

export type AgentEnvFailure = {
  ok: false
  error: string
}

export type AgentEnvResult = AgentEnvSuccess | AgentEnvFailure

export type AgentSetEnvPayload = {
  values: AgentEnvValues
}

export type AgentStreamEvent =
  | { requestId?: string; type: 'start' }
  | { requestId?: string; type: 'text-delta'; delta: string }
  | { requestId?: string; type: 'reasoning-delta'; blockId: string; delta: string; textOffset: number }
  | { requestId?: string; type: 'project-context-patched'; projectContext: ParseResult }
  | {
    requestId?: string
    type: 'tool-call'
    phase: 'model' | 'exec-start' | 'exec-end'
    tool: AgentToolName
    toolCallId: string
    toolIndex?: number
    textOffset: number
    commandPreview?: string
    granted?: boolean
    resultPreview?: string
  }
  | { requestId?: string; type: 'end' }
  | { requestId?: string; type: 'error'; error: string }
