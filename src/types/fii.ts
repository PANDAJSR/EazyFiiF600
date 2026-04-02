export type DroneInfo = {
  id: string
  name: string
  actionGroup: string
  startPos: {
    x: string
    y: string
    z: string
  }
}

export type ParsedBlock = {
  id: string
  type: string
  fields: Record<string, string>
  comment?: string
}

export type DroneProgram = {
  drone: DroneInfo
  blocks: ParsedBlock[]
}

export type ParseResult = {
  programs: DroneProgram[]
  warnings: string[]
  sourceName: string
}
