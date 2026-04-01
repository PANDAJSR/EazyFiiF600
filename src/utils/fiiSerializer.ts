import type { ParseResult } from '../types/fii'

export type SerializedProjectFile = {
  relativePath: string
  content: string
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const normalizeName = (value: string) => value.trim().replace(/[\\/:*?"<>|]/g, '_')

const ensureActionGroupName = (groupName: string, index: number) =>
  normalizeName(groupName || `动作组${index + 1}`) || `动作组${index + 1}`

const ensureFiiName = (sourceName: string) => {
  const safeName = normalizeName(sourceName || 'project.fii')
  return safeName.toLowerCase().endsWith('.fii') ? safeName : `${safeName}.fii`
}

const buildBlockXml = (blocks: ParseResult['programs'][number]['blocks'], index: number): string => {
  const lines: string[] = []
  const emitBlock = (blockIndex: number) => {
    const block = blocks[blockIndex]
    if (!block) {
      return
    }
    lines.push(`<block type="${escapeXml(block.type)}" id="block_${blockIndex + 1}">`)
    Object.entries(block.fields).forEach(([key, value]) => {
      lines.push(`<field name="${escapeXml(key)}">${escapeXml(value)}</field>`)
    })
    if (blockIndex + 1 < blocks.length) {
      lines.push('<next>')
      emitBlock(blockIndex + 1)
      lines.push('</next>')
    }
    lines.push('</block>')
  }

  lines.push('<?xml version="1.0" encoding="utf-8"?>')
  lines.push('<xml xmlns="https://developers.google.com/blockly/xml">')
  if (blocks.length > 0) {
    emitBlock(0)
  } else {
    lines.push(`<!-- empty block list for drone ${index + 1} -->`)
  }
  lines.push('</xml>')
  return lines.join('\n')
}

const buildFiiXml = (result: ParseResult): string => {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="utf-8"?>')
  lines.push('<Root>')
  result.programs.forEach((program, index) => {
    const actionGroup = ensureActionGroupName(program.drone.actionGroup, index)
    lines.push(`  <Actions actionname="${escapeXml(actionGroup)}" />`)
  })
  result.programs.forEach((program) => {
    lines.push(`  <ActionFlight actionfname="${escapeXml(program.drone.name)}" />`)
    lines.push(`  <ActionFlightID actionfid="${escapeXml(program.drone.id)}" />`)
    lines.push(`  <ActionFlightPosX actionfX="${escapeXml(program.drone.startPos.x || '0')}" />`)
    lines.push(`  <ActionFlightPosY actionfY="${escapeXml(program.drone.startPos.y || '0')}" />`)
    lines.push(`  <ActionFlightPosZ actionfZ="${escapeXml(program.drone.startPos.z || '0')}" />`)
  })
  lines.push('</Root>')
  return lines.join('\n')
}

export const serializeProjectFiles = (result: ParseResult): SerializedProjectFile[] => {
  const files: SerializedProjectFile[] = []
  files.push({
    relativePath: ensureFiiName(result.sourceName),
    content: buildFiiXml(result),
  })
  result.programs.forEach((program, index) => {
    const actionGroup = ensureActionGroupName(program.drone.actionGroup, index)
    files.push({
      relativePath: `动作组/${actionGroup}/webCodeAll.xml`,
      content: buildBlockXml(program.blocks, index),
    })
  })
  return files
}
