import type { DesktopOpenResult, DesktopWritePayload, DesktopWriteResult } from '../types/desktop'

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
