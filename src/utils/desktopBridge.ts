import type {
  DesktopAgentChatPayload,
  DesktopAgentChatResult,
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
