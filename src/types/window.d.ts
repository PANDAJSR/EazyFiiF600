import type {
  DesktopOpenResult,
  DesktopReadTextFilePayload,
  DesktopReadTextFileResult,
  DesktopAgentChatPayload,
  DesktopAgentChatResult,
  DesktopAgentStatusResult,
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
}

declare global {
  interface Window {
    eazyFiiDesktop?: DesktopApi
  }
}

export {}
