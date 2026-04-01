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
