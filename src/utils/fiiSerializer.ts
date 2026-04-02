import type { ParseResult } from '../types/fii'
import { expandAutoDelayBlocks } from './autoDelayBlocks'

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
const normalizeXmlTagName = (value: string) =>
  (value || 'Action').replace(/[^\u4e00-\u9fa5A-Za-z0-9_]/g, '_')

const ensureActionGroupName = (_groupName: string, index: number) => `动作组${index + 1}`

const ensureFiiName = (sourceName: string) => {
  const safeName = normalizeName(sourceName || 'project.fii')
  return safeName.toLowerCase().endsWith('.fii') ? safeName : `${safeName}.fii`
}

const toIntString = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed)) {
    return String(parsed)
  }
  return String(fallback)
}

const buildProgramNames = (_program: ParseResult['programs'][number], index: number) => {
  const actionGroup = ensureActionGroupName('', index)
  const droneNo = String(index + 1)
  const flightName = `${actionGroup}无人机${droneNo}`
  const flightId = `${flightName}UAVID${2111 + index}`
  return { actionGroup, flightName, flightId }
}

const buildBlockXml = (program: ParseResult['programs'][number], index: number): string => {
  const serializedBlocks = expandAutoDelayBlocks(program.blocks, program.drone.startPos)
  const lines: string[] = []
  const emitBlockFields = (blockIndex: number) => {
    const block = serializedBlocks[blockIndex]
    if (!block) {
      return
    }
    Object.entries(block.fields).forEach(([key, value]) => {
      lines.push(`<field name="${escapeXml(key)}">${escapeXml(value)}</field>`)
    })
    if (block.type === 'block_delay' && !Object.prototype.hasOwnProperty.call(block.fields, 'delay')) {
      lines.push('<field name="delay">0</field>')
    }
    if (block.type === 'block_inittime' && !Object.prototype.hasOwnProperty.call(block.fields, 'color')) {
      lines.push('<field name="color">#cccccc</field>')
    }
    if (block.comment?.trim()) {
      lines.push(`<comment pinned="false" h="80" w="160">${escapeXml(block.comment)}</comment>`)
    }
  }

  const emitBlockChain = (startIndex: number, isRoot = false) => {
    const block = serializedBlocks[startIndex]
    if (!block) {
      return
    }
    if (isRoot) {
      lines.push(`<block type="${escapeXml(block.type)}" x="100" y="20">`)
    } else {
      lines.push(`<block type="${escapeXml(block.type)}">`)
    }
    emitBlockFields(startIndex)
    if (startIndex + 1 < serializedBlocks.length) {
      lines.push('<next>')
      emitBlockChain(startIndex + 1)
      lines.push('</next>')
    }
    lines.push('</block>')
  }

  const emitOfficialStartChain = () => {
    const horizontal = serializedBlocks[2]
    const vertical = serializedBlocks[3]
    lines.push('<block type="Goertek_Start" x="100" y="20">')
    lines.push('<next>')
    lines.push('<block type="block_inittime">')
    emitBlockFields(1)
    if (horizontal) {
      lines.push('<statement name="functionIntit">')
      lines.push(`<block type="${escapeXml(horizontal.type)}">`)
      emitBlockFields(2)
      if (vertical) {
        lines.push('<next>')
        lines.push(`<block type="${escapeXml(vertical.type)}">`)
        emitBlockFields(3)
        if (serializedBlocks.length > 4) {
          lines.push('<next>')
          emitBlockChain(4)
          lines.push('</next>')
        }
        lines.push('</block>')
        lines.push('</next>')
      } else if (serializedBlocks.length > 3) {
        lines.push('<next>')
        emitBlockChain(3)
        lines.push('</next>')
      }
      lines.push('</block>')
      lines.push('</statement>')
    }
    lines.push('</block>')
    lines.push('</next>')
    lines.push('</block>')
  }

  lines.push('<xml xmlns="http://www.w3.org/1999/xhtml">')
  lines.push('  <variables></variables>')
  if (serializedBlocks.length > 0) {
    const first = serializedBlocks[0]
    const second = serializedBlocks[1]
    if (first?.type === 'Goertek_Start' && second?.type === 'block_inittime') {
      emitOfficialStartChain()
    } else {
      emitBlockChain(0, true)
    }
  } else {
    lines.push(`<!-- empty block list for drone ${index + 1} -->`)
  }
  lines.push('</xml>')
  return lines.join('\n')
}

const buildFiiXml = (result: ParseResult): string => {
  const lines: string[] = []
  const meta = result.programs.map((program, index) => buildProgramNames(program, index))
  const groupNames = Array.from(new Set(meta.map((item) => item.actionGroup)))

  lines.push('<?xml version="1.0" encoding="utf-8"?>')
  lines.push('<GoertekGraphicXml>')
  lines.push('  <DeviceType DeviceType="F600" />')
  groupNames.forEach((groupName) => {
    lines.push(`  <Actions actionname="${escapeXml(groupName)}" />`)
  })
  lines.push('  <AreaL AreaL="400" />')
  lines.push('  <AreaW AreaW="400" />')
  lines.push('  <AreaH AreaH="300" />')
  groupNames.forEach((groupName) => {
    lines.push(`  <${normalizeXmlTagName(groupName)}Controls time="0" />`)
  })

  result.programs.forEach((program, index) => {
    const item = meta[index]
    const x = toIntString(program.drone.startPos.x || '0', 0)
    const y = toIntString(program.drone.startPos.y || '0', 0)
    const z = toIntString(program.drone.startPos.z || '0', 0)
    lines.push(`  <ActionFlight actionfname="${escapeXml(item.flightName)}" />`)
    lines.push(`  <ActionFlightID actionfid="${escapeXml(item.flightId)}" />`)
    lines.push(`  <ActionFlightPosX actionfX="${escapeXml(`${item.flightName}pos${x}`)}" />`)
    lines.push(`  <ActionFlightPosY actionfY="${escapeXml(`${item.flightName}pos${y}`)}" />`)
    lines.push(`  <ActionFlightPosZ actionfZ="${escapeXml(`${item.flightName}pos${z}`)}" />`)
  })

  lines.push('</GoertekGraphicXml>')
  return lines.join('\n')
}

export const serializeProjectFiles = (result: ParseResult): SerializedProjectFile[] => {
  const files: SerializedProjectFile[] = []
  files.push({
    relativePath: ensureFiiName(result.sourceName),
    content: buildFiiXml(result),
  })
  result.programs.forEach((program, index) => {
    const { actionGroup } = buildProgramNames(program, index)
    files.push({
      relativePath: `动作组/${actionGroup}/webCodeAll.xml`,
      content: buildBlockXml(program, index),
    })
  })
  return files
}
