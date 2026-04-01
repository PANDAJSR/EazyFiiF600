import type { DesktopOpenResult, DesktopWritePayload, DesktopWriteResult } from './desktop'

type DesktopApi = {
  pickOpenDirectory: () => Promise<DesktopOpenResult | null>
  pickSaveDirectory: () => Promise<string | null>
  writeProjectFiles: (payload: DesktopWritePayload) => Promise<DesktopWriteResult>
}

declare global {
  interface Window {
    eazyFiiDesktop?: DesktopApi
  }
}

export {}
