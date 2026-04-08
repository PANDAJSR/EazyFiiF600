import type {
  DesktopAgentChatPayload,
  DesktopAgentChatResult,
  DesktopAgentEnvResult,
  DesktopAgentStreamEvent,
  DesktopAgentSetEnvPayload,
  DesktopAgentStopResult,
  DesktopAgentStatusResult,
  DesktopTrajectoryIssuesRequestPayload,
  DesktopTrajectoryIssuesResponsePayload,
  DesktopOpenResult,
  DesktopReadTextFilePayload,
  DesktopWritePayload,
  DesktopWriteResult,
  DesktopWriteTextFilePayload,
  DesktopTerminalCreatePayload,
  DesktopTerminalWritePayload,
  DesktopTerminalResizePayload,
  DesktopTerminalDestroyPayload,
  DesktopTerminalDataEvent,
  DesktopTerminalExitEvent,
  DesktopTerminalResult,
  DesktopUpdateAgentProjectContextResult,
} from '../types/desktop'

export const isDesktopRuntime = () => Boolean(window.eazyFiiDesktop)
export const isElectronShell = () => navigator.userAgent.includes('Electron')

export const pickOpenDirectory = async (): Promise<DesktopOpenResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.pickOpenDirectory()
}

export const pickSaveDirectory = async (): Promise<string | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.pickSaveDirectory()
}

export const writeProjectFiles = async (
  payload: DesktopWritePayload,
): Promise<DesktopWriteResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.writeProjectFiles(payload)
}

export const readDesktopTextFile = async (
  payload: DesktopReadTextFilePayload,
): Promise<string | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  const result = await window.eazyFiiDesktop.readTextFile(payload)
  return result.content
}

export const writeDesktopTextFile = async (
  payload: DesktopWriteTextFilePayload,
): Promise<boolean> => {
  if (!window.eazyFiiDesktop) {
    return false
  }
  const result = await window.eazyFiiDesktop.writeTextFile(payload)
  return result.written
}

export const chatWithAgent = async (
  payload: DesktopAgentChatPayload,
): Promise<DesktopAgentChatResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.agentChat(payload)
}

export const getAgentStatus = async (): Promise<DesktopAgentStatusResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.getAgentStatus()
}

export const getAgentEnv = async (): Promise<DesktopAgentEnvResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.getAgentEnv()
}

export const setAgentEnv = async (
  payload: DesktopAgentSetEnvPayload,
): Promise<DesktopAgentEnvResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.setAgentEnv(payload)
}

export const stopAgentRequest = async (requestId?: string): Promise<DesktopAgentStopResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.stopAgentRequest(requestId ? { requestId } : undefined)
}

export const updateAgentProjectContext = async (
  projectContext: unknown,
): Promise<DesktopUpdateAgentProjectContextResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.updateAgentProjectContext(projectContext)
}

export const sendAgentTrajectoryIssuesResponse = (
  payload: DesktopTrajectoryIssuesResponsePayload,
): void => {
  if (!window.eazyFiiDesktop) {
    return
  }
  window.eazyFiiDesktop.sendAgentTrajectoryIssuesResponse(payload)
}

export const onAgentTrajectoryIssuesRequest = (
  handler: (payload: DesktopTrajectoryIssuesRequestPayload) => void,
): (() => void) | null => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.onAgentTrajectoryIssuesRequest(handler)
}

export const onAgentProjectContextRequest = (
  handler: (payload: { token: string }) => void,
): (() => void) | null => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.onAgentProjectContextRequest(handler)
}

export const sendAgentProjectContextResponse = (
  payload: { token: string; projectContext: unknown },
): void => {
  if (!window.eazyFiiDesktop) {
    return
  }
  window.eazyFiiDesktop.sendAgentProjectContextResponse(payload)
}

export const onAgentStream = (
  handler: (event: DesktopAgentStreamEvent) => void,
): (() => void) | null => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.onAgentStream(handler)
}

export const terminalCreate = async (
  payload: DesktopTerminalCreatePayload,
): Promise<DesktopTerminalResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.terminalCreate(payload)
}

export const terminalWrite = async (
  payload: DesktopTerminalWritePayload,
): Promise<DesktopTerminalResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.terminalWrite(payload)
}

export const terminalResize = async (
  payload: DesktopTerminalResizePayload,
): Promise<DesktopTerminalResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.terminalResize(payload)
}

export const terminalDestroy = async (
  payload: DesktopTerminalDestroyPayload,
): Promise<DesktopTerminalResult | null> => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.terminalDestroy(payload)
}

export const onTerminalData = (
  handler: (event: DesktopTerminalDataEvent) => void,
): (() => void) | null => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.onTerminalData(handler)
}

export const onTerminalExit = (
  handler: (event: DesktopTerminalExitEvent) => void,
): (() => void) | null => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.onTerminalExit(handler)
}
