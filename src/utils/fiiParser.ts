import type { DroneInfo, ParseResult, ParsedBlock } from '../types/fii'
import { collapseAutoDelayBlocks } from './autoDelayBlocks'
import { collapseCommentBlocks } from './commentBlocks'

type FileLookup = {
  byName: Map<string, InputFile>
  byPath: Map<string, InputFile>
}

type InputFile = {
  name: string
  webkitRelativePath?: string
  text: () => Promise<string>
}

export type ParsedTextFile = {
  name: string
  relativePath: string
  text: string
}

type XmlBlockNode = {
  type: string
  fields: Record<string, string>
  comment?: string
  statementBlocks: XmlBlockNode[]
  next?: XmlBlockNode
}

const normalize = (value: string) => value.replace(/\\/g, '/').toLowerCase()

const buildFileLookup = (files: InputFile[]): FileLookup => {
  const byName = new Map<string, InputFile>()
  const byPath = new Map<string, InputFile>()

  files.forEach((file) => {
    const rel = file.webkitRelativePath
    byName.set(normalize(file.name), file)
    if (rel) {
      byPath.set(normalize(rel), file)
    }
  })

  return { byName, byPath }
}

const parseXml = (text: string): Document => {
  const parser = new DOMParser()
  return parser.parseFromString(text, 'text/xml')
}

const findAllAttr = (xml: Document, tagName: string, attrName: string): string[] => {
  return Array.from(xml.getElementsByTagName(tagName))
    .map((node) => node.getAttribute(attrName)?.trim() ?? '')
    .filter(Boolean)
}

const extractPosValue = (posStr: string | undefined): string => {
  if (!posStr) return ''
  const match = posStr.match(/(\d+)$/)
  return match ? match[1] : posStr
}

const parseDronesFromFii = (fiiText: string): DroneInfo[] => {
  const xml = parseXml(fiiText)
  const actionGroups = findAllAttr(xml, 'Actions', 'actionname')

  const names = findAllAttr(xml, 'ActionFlight', 'actionfname')
  const ids = findAllAttr(xml, 'ActionFlightID', 'actionfid')
  const posX = findAllAttr(xml, 'ActionFlightPosX', 'actionfX')
  const posY = findAllAttr(xml, 'ActionFlightPosY', 'actionfY')
  const posZ = findAllAttr(xml, 'ActionFlightPosZ', 'actionfZ')

  const drones: DroneInfo[] = []
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i] ?? `无人机${i + 1}`
    const id = ids[i] ?? name
    const matchedGroup = actionGroups.find((group) => name.includes(group))

    drones.push({
      id,
      name,
      actionGroup: matchedGroup ?? actionGroups[i] ?? '',
      startPos: {
        x: extractPosValue(posX[i]),
        y: extractPosValue(posY[i]),
        z: extractPosValue(posZ[i]),
      },
    })
  }

  return drones
}

const firstElement = (node: ParentNode, tag: string): Element | undefined => {
  return Array.from(node.childNodes).find(
    (it): it is Element => it.nodeType === Node.ELEMENT_NODE && it.nodeName === tag,
  )
}

const parseXmlBlockNode = (blockEl: Element): XmlBlockNode => {
  const type = blockEl.getAttribute('type') ?? 'Unknown'
  const fields: Record<string, string> = {}

  Array.from(blockEl.children)
    .filter((it) => it.nodeName === 'field')
    .forEach((field) => {
      const fieldName = field.getAttribute('name') ?? 'field'
      fields[fieldName] = (field.textContent ?? '').trim()
    })

  const commentNode = Array.from(blockEl.children).find((it) => it.nodeName === 'comment')
  const comment = (commentNode?.textContent ?? '').trim() || undefined

  const statementBlocks: XmlBlockNode[] = []
  Array.from(blockEl.children)
    .filter((it) => it.nodeName === 'statement')
    .forEach((statement) => {
      const nested = firstElement(statement, 'block')
      if (nested) {
        statementBlocks.push(parseXmlBlockNode(nested))
      }
    })

  const nextContainer = firstElement(blockEl, 'next')
  const nextBlock = nextContainer ? firstElement(nextContainer, 'block') : undefined

  return {
    type,
    fields,
    comment,
    statementBlocks,
    next: nextBlock ? parseXmlBlockNode(nextBlock) : undefined,
  }
}

const flattenBlocks = (node: XmlBlockNode | undefined, result: ParsedBlock[]): void => {
  if (!node) {
    return
  }

  result.push({
    id: `${node.type}-${result.length + 1}`,
    type: node.type,
    fields: node.fields,
    comment: node.comment,
  })

  node.statementBlocks.forEach((child) => flattenBlocks(child, result))
  flattenBlocks(node.next, result)
}

const parseBlocksFromXml = (xmlText: string): ParsedBlock[] => {
  const xml = parseXml(xmlText)
  const root = xml.getElementsByTagName('block')[0]
  if (!root) {
    return []
  }

  const tree = parseXmlBlockNode(root)
  const blocks: ParsedBlock[] = []
  flattenBlocks(tree, blocks)
  return collapseCommentBlocks(collapseAutoDelayBlocks(blocks))
}

const resolveActionXml = (actionGroup: string, lookup: FileLookup): InputFile | undefined => {
  const guesses = [
    `动作组/${actionGroup}/webCodeAll.xml`,
    `${actionGroup}/webCodeAll.xml`,
    'webCodeAll.xml',
  ]

  for (const guess of guesses) {
    const hit = lookup.byPath.get(normalize(guess))
    if (hit) {
      return hit
    }
  }

  for (const [relPath, file] of lookup.byPath.entries()) {
    if (relPath.endsWith(`/${normalize(actionGroup)}/webcodeall.xml`)) {
      return file
    }
  }

  return lookup.byName.get('webcodeall.xml')
}

const parseFiiFromInputFiles = async (files: InputFile[]): Promise<ParseResult> => {
  const lookup = buildFileLookup(files)
  const warnings: string[] = []

  const fiiFile = files.find((file) => file.name.toLowerCase().endsWith('.fii'))
  if (!fiiFile) {
    return {
      programs: [],
      warnings: ['未找到 .fii 文件，请选择包含 .fii 的文件夹或文件集合。'],
      sourceName: '',
    }
  }

  const fiiText = await fiiFile.text()
  const drones = parseDronesFromFii(fiiText)

  const programs = await Promise.all(
    drones.map(async (drone) => {
      const actionXml = resolveActionXml(drone.actionGroup, lookup)
      if (!actionXml) {
        warnings.push(`未找到动作组 ${drone.actionGroup || '(未命名)'} 的 webCodeAll.xml`)
        return { drone, blocks: [] }
      }

      const xmlText = await actionXml.text()
      const blocks = parseBlocksFromXml(xmlText)
      return { drone, blocks }
    }),
  )

  return {
    programs,
    warnings,
    sourceName: fiiFile.name,
  }
}

export const parseFiiFromFiles = async (files: File[]): Promise<ParseResult> => parseFiiFromInputFiles(files)

export const parseFiiFromTextFiles = async (files: ParsedTextFile[]): Promise<ParseResult> => {
  const inputFiles: InputFile[] = files.map((file) => ({
    name: file.name,
    webkitRelativePath: file.relativePath,
    text: async () => file.text,
  }))
  return parseFiiFromInputFiles(inputFiles)
}
