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
  DesktopTerminalCreatePayload,
  DesktopTerminalWritePayload,
  DesktopTerminalResizePayload,
  DesktopTerminalDestroyPayload,
  DesktopTerminalDataEvent,
  DesktopTerminalExitEvent,
  DesktopTerminalResult,
  DesktopUpdateAgentProjectContextResult,
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
  updateAgentProjectContext: (projectContext: unknown) => Promise<DesktopUpdateAgentProjectContextResult>
  sendAgentTrajectoryIssuesResponse: (payload: DesktopTrajectoryIssuesResponsePayload) => void
  onAgentTrajectoryIssuesRequest: (handler: (payload: DesktopTrajectoryIssuesRequestPayload) => void) => () => void
  onAgentProjectContextRequest: (handler: (payload: { token: string }) => void) => () => void
  sendAgentProjectContextResponse: (payload: { token: string; projectContext: unknown }) => void
  onAgentStream: (handler: (event: DesktopAgentStreamEvent) => void) => () => void
  terminalCreate: (payload: DesktopTerminalCreatePayload) => Promise<DesktopTerminalResult>
  terminalWrite: (payload: DesktopTerminalWritePayload) => Promise<DesktopTerminalResult>
  terminalResize: (payload: DesktopTerminalResizePayload) => Promise<DesktopTerminalResult>
  terminalDestroy: (payload: DesktopTerminalDestroyPayload) => Promise<DesktopTerminalResult>
  onTerminalData: (handler: (event: DesktopTerminalDataEvent) => void) => () => void
  onTerminalExit: (handler: (event: DesktopTerminalExitEvent) => void) => () => void
}

declare global {
  interface Window {
    eazyFiiDesktop?: DesktopApi
  }
}

export {}
