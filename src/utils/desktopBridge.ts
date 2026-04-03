import type {
  DesktopAgentChatPayload,
  DesktopAgentChatResult,
  DesktopAgentEnvResult,
  DesktopAgentStreamEvent,
  DesktopAgentSetEnvPayload,
  DesktopAgentStatusResult,
  DesktopOpenResult,
  DesktopReadTextFilePayload,
  DesktopWritePayload,
  DesktopWriteResult,
  DesktopWriteTextFilePayload,
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

export const onAgentStream = (
  handler: (event: DesktopAgentStreamEvent) => void,
): (() => void) | null => {
  if (!window.eazyFiiDesktop) {
    return null
  }
  return window.eazyFiiDesktop.onAgentStream(handler)
}
