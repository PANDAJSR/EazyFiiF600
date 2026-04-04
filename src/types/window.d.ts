import type {
  DesktopOpenResult,
  DesktopReadTextFilePayload,
  DesktopReadTextFileResult,
  DesktopAgentChatPayload,
  DesktopAgentChatResult,
  DesktopAgentEnvResult,
  DesktopAgentStreamEvent,
  DesktopAgentStopResult,
  DesktopAgentSetEnvPayload,
  DesktopAgentStatusResult,
  DesktopTrajectoryIssuesRequestPayload,
  DesktopTrajectoryIssuesResponsePayload,
  DesktopWritePayload,
  DesktopWriteResult,
  DesktopWriteTextFilePayload,
  DesktopWriteTextFileResult,
} from './desktop'

type DesktopApi = {
  pickOpenDirectory: () => Promise<DesktopOpenResult | null>
  pickSaveDirectory: () => Promise<string | null>
  writeProjectFiles: (payload: DesktopWritePayload) => Promise<DesktopWriteResult>
  readTextFile: (payload: DesktopReadTextFilePayload) => Promise<DesktopReadTextFileResult>
  writeTextFile: (payload: DesktopWriteTextFilePayload) => Promise<DesktopWriteTextFileResult>
  agentChat: (payload: DesktopAgentChatPayload) => Promise<DesktopAgentChatResult>
  getAgentStatus: () => Promise<DesktopAgentStatusResult>
  getAgentEnv: () => Promise<DesktopAgentEnvResult>
  setAgentEnv: (payload: DesktopAgentSetEnvPayload) => Promise<DesktopAgentEnvResult>
  stopAgentRequest: (payload?: { requestId?: string }) => Promise<DesktopAgentStopResult>
  sendAgentTrajectoryIssuesResponse: (payload: DesktopTrajectoryIssuesResponsePayload) => void
  onAgentTrajectoryIssuesRequest: (handler: (payload: DesktopTrajectoryIssuesRequestPayload) => void) => () => void
  onAgentStream: (handler: (event: DesktopAgentStreamEvent) => void) => () => void
}

declare global {
  interface Window {
    eazyFiiDesktop?: DesktopApi
  }
}

export {}
