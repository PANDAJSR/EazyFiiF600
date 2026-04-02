import type { SerializedProjectFile } from '../utils/fiiSerializer'

export type DesktopTextFile = {
  name: string
  relativePath: string
  text: string
}

export type DesktopOpenResult = {
  directoryPath: string
  files: DesktopTextFile[]
}

export type DesktopWritePayload = {
  directoryPath: string
  files: SerializedProjectFile[]
}

export type DesktopWriteResult = {
  writtenCount: number
}

export type DesktopReadTextFilePayload = {
  directoryPath: string
  relativePath: string
}

export type DesktopReadTextFileResult = {
  content: string | null
}

export type DesktopWriteTextFilePayload = {
  directoryPath: string
  relativePath: string
  content: string
}

export type DesktopWriteTextFileResult = {
  written: boolean
}
