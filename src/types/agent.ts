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
}

export type AgentChatSuccess = {
  ok: true
  reply: string
  traces: AgentToolTrace[]
  provider: 'openai' | 'azure'
  model: string
  transportMode: 'chat' | 'responses'
}

export type AgentChatFailure = {
  ok: false
  error: string
}

export type AgentChatResult = AgentChatSuccess | AgentChatFailure
