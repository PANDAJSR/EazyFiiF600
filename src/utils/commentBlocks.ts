import type { ParsedBlock } from '../types/fii'

export const COMMENT_BLOCK_TYPE = 'EazyFii_Comment'
const COMMENT_BLOCK_MARKER_KEY = 'eazyfii_comment_block'
const COMMENT_BLOCK_CONTENT_KEY = 'content'

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const readCommentPayload = (comment?: string): { content: string } | undefined => {
  if (!comment?.trim()) {
    return undefined
  }
  try {
    const parsed = JSON.parse(comment)
    const marker = parsed?.[COMMENT_BLOCK_MARKER_KEY]
    const content = parsed?.[COMMENT_BLOCK_CONTENT_KEY]
    if (
      marker !== true &&
      marker !== 1 &&
      marker !== '1' &&
      marker !== 'true'
    ) {
      return undefined
    }
    if (typeof content !== 'string') {
      return undefined
    }
    return { content }
  } catch {
    return undefined
  }
}

const buildCommentPayload = (content: string) =>
  JSON.stringify({
    [COMMENT_BLOCK_MARKER_KEY]: true,
    [COMMENT_BLOCK_CONTENT_KEY]: content,
  })

export const collapseCommentBlocks = (blocks: ParsedBlock[]): ParsedBlock[] =>
  blocks.map((block) => {
    if (block.type !== 'block_delay') {
      return block
    }
    const delayMs = toNumber(block.fields.time)
    if (delayMs !== 0) {
      return block
    }
    const payload = readCommentPayload(block.comment)
    if (!payload) {
      return block
    }
    return {
      id: block.id,
      type: COMMENT_BLOCK_TYPE,
      fields: { content: payload.content },
    }
  })

export const expandCommentBlocks = (blocks: ParsedBlock[]): ParsedBlock[] =>
  blocks.map((block) => {
    if (block.type !== COMMENT_BLOCK_TYPE) {
      return block
    }
    return {
      id: block.id,
      type: 'block_delay',
      fields: { time: '0' },
      comment: buildCommentPayload(block.fields.content ?? ''),
    }
  })
