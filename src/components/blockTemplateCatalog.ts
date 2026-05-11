import type { ParsedBlock } from '../types/fii'
import type { RodConfig } from './trajectory/rodConfig'
import {
  buildSubject1SquareStableBlocks,
  buildSubject1SquareTurnAndFlyBlocks,
} from './blockTemplates/subject1SquareTemplates'
import {
  buildSubject2RectangleStableBlocks,
  buildSubject5HexagonFigureEightBlocks,
  buildSubject6OctagonFigureEightBlocks,
  buildSubject7ThreeColorRingsBlocks,
} from './blockTemplates/subjectLoopTemplates'
import type {
  Subject1SquareStableParams,
  Subject1SquareTurnAndFlyParams,
  Subject2RectangleStableParams,
  Subject5HexagonFigureEightParams,
  Subject6OctagonFigureEightParams,
  Subject7ThreeColorRingsParams,
  TemplateBuildParams,
} from './blockTemplates/templateParams'

export type {
  Subject1SquareStableParams,
  Subject1SquareTurnAndFlyParams,
  Subject2RectangleStableParams,
  Subject5HexagonFigureEightParams,
  Subject6OctagonFigureEightParams,
  Subject7ThreeColorRingsParams,
  TemplateBuildParams,
  TemplateInsertionContext,
} from './blockTemplates/templateParams'

export const SUBJECT1_SQUARE_STABLE_TEMPLATE_ID = 'subject1_square_stable'
export const SUBJECT1_SQUARE_TURN_AND_FLY_TEMPLATE_ID = 'subject1_square_turn_and_fly'
export const SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID = 'subject2_rectangle_stable'
export const SUBJECT5_HEXAGON_FIGURE_EIGHT_TEMPLATE_ID = 'subject5_hexagon_figure_eight'
export const SUBJECT6_OCTAGON_FIGURE_EIGHT_TEMPLATE_ID = 'subject6_octagon_figure_eight'
export const SUBJECT7_THREE_COLOR_RINGS_TEMPLATE_ID = 'subject7_three_color_rings'

export type InsertableTemplateDefinition = {
  id: string
  label: string
  keywords: string[]
  description: string
}

export const INSERTABLE_TEMPLATES: InsertableTemplateDefinition[] = [
  {
    id: SUBJECT1_SQUARE_STABLE_TEMPLATE_ID,
    label: '科目一_正方形_稳定',
    keywords: ['模板', '科目一', '正方形', '稳定', 'subject1', 'square'],
    description: '围绕科目一杆点执行稳定正方形飞行',
  },
  {
    id: SUBJECT1_SQUARE_TURN_AND_FLY_TEMPLATE_ID,
    label: '科目一_正方形_边转边飞',
    keywords: ['模板', '科目一', '正方形', '边转边飞', '异步', 'subject1', 'square'],
    description: '围绕科目一杆点执行正方形飞行，转动后延时1.5秒再异步平移',
  },
  {
    id: SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID,
    label: '科目二_长方形_稳定',
    keywords: ['模板', '科目二', '长方形', '稳定', 'subject2', 'rectangle'],
    description: '围绕科目二横杆执行稳定长方形绕行并闭合',
  },
  {
    id: SUBJECT5_HEXAGON_FIGURE_EIGHT_TEMPLATE_ID,
    label: '科目五_六边8字',
    keywords: ['模板', '科目五', '六边', '8字', 'subject5', 'hexagon', 'figure8'],
    description: '围绕科目五双杆执行六边8字闭合飞行（起点自动取两端最近点）',
  },
  {
    id: SUBJECT6_OCTAGON_FIGURE_EIGHT_TEMPLATE_ID,
    label: '科目六_八边8字',
    keywords: ['模板', '科目六', '八边', '8字', 'subject6', 'octagon', 'figure8'],
    description: '围绕科目六双横杆执行八边8字闭合飞行（两端4点自动取最近起点）',
  },
  {
    id: SUBJECT7_THREE_COLOR_RINGS_TEMPLATE_ID,
    label: '科目七_三色穿圈',
    keywords: ['模板', '科目七', '三色', '穿圈', 'subject7', 'ring', 'color'],
    description: '先下探再异步上升穿过三圈，中间分段切换红绿蓝灯光',
  },
]

export const buildTemplateBlocks = (
  templateId: string,
  params: TemplateBuildParams,
): ParsedBlock[] => {
  if (templateId === SUBJECT1_SQUARE_STABLE_TEMPLATE_ID) {
    return buildSubject1SquareStableBlocks(params as Subject1SquareStableParams)
  }
  if (templateId === SUBJECT1_SQUARE_TURN_AND_FLY_TEMPLATE_ID) {
    return buildSubject1SquareTurnAndFlyBlocks(params as Subject1SquareTurnAndFlyParams)
  }
  if (templateId === SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID) {
    return buildSubject2RectangleStableBlocks(params as Subject2RectangleStableParams)
  }
  if (templateId === SUBJECT5_HEXAGON_FIGURE_EIGHT_TEMPLATE_ID) {
    return buildSubject5HexagonFigureEightBlocks(params as Subject5HexagonFigureEightParams)
  }
  if (templateId === SUBJECT6_OCTAGON_FIGURE_EIGHT_TEMPLATE_ID) {
    return buildSubject6OctagonFigureEightBlocks(params as Subject6OctagonFigureEightParams)
  }
  if (templateId === SUBJECT7_THREE_COLOR_RINGS_TEMPLATE_ID) {
    return buildSubject7ThreeColorRingsBlocks(params as Subject7ThreeColorRingsParams)
  }
  return []
}

export const getSubject1TemplateDefaultCenter = (rodConfig?: RodConfig): Subject1SquareStableParams => {
  const point = rodConfig?.subject1?.[0]
  const x = typeof point?.x === 'number' && Number.isFinite(point.x) ? point.x : 0
  const y = typeof point?.y === 'number' && Number.isFinite(point.y) ? point.y : 0
  return {
    subject1X: x,
    subject1Y: y,
  }
}

export const getSubject1SquareTurnAndFlyTemplateDefaultCenter = (rodConfig?: RodConfig): Subject1SquareTurnAndFlyParams => {
  const point = rodConfig?.subject1?.[0]
  const x = typeof point?.x === 'number' && Number.isFinite(point.x) ? point.x : 0
  const y = typeof point?.y === 'number' && Number.isFinite(point.y) ? point.y : 0
  return {
    subject1X: x,
    subject1Y: y,
  }
}

export const getSubject2TemplateDefaultRods = (rodConfig?: RodConfig): Subject2RectangleStableParams => {
  const pointA = rodConfig?.subject2?.[0]
  const pointB = rodConfig?.subject2?.[1]
  const ax = typeof pointA?.x === 'number' && Number.isFinite(pointA.x) ? pointA.x : 0
  const ay = typeof pointA?.y === 'number' && Number.isFinite(pointA.y) ? pointA.y : 0
  const bx = typeof pointB?.x === 'number' && Number.isFinite(pointB.x) ? pointB.x : ax
  const by = typeof pointB?.y === 'number' && Number.isFinite(pointB.y) ? pointB.y : ay
  return {
    subject2RodAX: ax,
    subject2RodAY: ay,
    subject2RodBX: bx,
    subject2RodBY: by,
  }
}

export const getSubject5TemplateDefaultRods = (rodConfig?: RodConfig): Subject5HexagonFigureEightParams => {
  const pointA = rodConfig?.subject5?.[0]
  const pointB = rodConfig?.subject5?.[1]
  const ax = typeof pointA?.x === 'number' && Number.isFinite(pointA.x) ? pointA.x : 0
  const ay = typeof pointA?.y === 'number' && Number.isFinite(pointA.y) ? pointA.y : 0
  const bx = typeof pointB?.x === 'number' && Number.isFinite(pointB.x) ? pointB.x : ax + 100
  const by = typeof pointB?.y === 'number' && Number.isFinite(pointB.y) ? pointB.y : ay
  return {
    subject5RodAX: ax,
    subject5RodAY: ay,
    subject5RodBX: bx,
    subject5RodBY: by,
  }
}

export const getSubject6TemplateDefaultRods = (rodConfig?: RodConfig): Subject6OctagonFigureEightParams => {
  const pointA = rodConfig?.subject6?.[0]
  const pointB = rodConfig?.subject6?.[1]
  const pointC = rodConfig?.subject6?.[2]
  const pointD = rodConfig?.subject6?.[3]
  const ax = typeof pointA?.x === 'number' && Number.isFinite(pointA.x) ? pointA.x : 100
  const ay = typeof pointA?.y === 'number' && Number.isFinite(pointA.y) ? pointA.y : 60
  const bx = typeof pointB?.x === 'number' && Number.isFinite(pointB.x) ? pointB.x : 100
  const by = typeof pointB?.y === 'number' && Number.isFinite(pointB.y) ? pointB.y : 140
  const cx = typeof pointC?.x === 'number' && Number.isFinite(pointC.x) ? pointC.x : 220
  const cy = typeof pointC?.y === 'number' && Number.isFinite(pointC.y) ? pointC.y : 60
  const dx = typeof pointD?.x === 'number' && Number.isFinite(pointD.x) ? pointD.x : 220
  const dy = typeof pointD?.y === 'number' && Number.isFinite(pointD.y) ? pointD.y : 140
  return {
    subject6RodAX: ax,
    subject6RodAY: ay,
    subject6RodBX: bx,
    subject6RodBY: by,
    subject6RodCX: cx,
    subject6RodCY: cy,
    subject6RodDX: dx,
    subject6RodDY: dy,
  }
}

export const getSubject7TemplateDefaultRods = (rodConfig?: RodConfig): Subject7ThreeColorRingsParams => {
  const pointA = rodConfig?.subject7?.[0]
  const pointB = rodConfig?.subject7?.[1]
  const ax = typeof pointA?.x === 'number' && Number.isFinite(pointA.x) ? pointA.x : 100
  const ay = typeof pointA?.y === 'number' && Number.isFinite(pointA.y) ? pointA.y : 60
  const bx = typeof pointB?.x === 'number' && Number.isFinite(pointB.x) ? pointB.x : 160
  const by = typeof pointB?.y === 'number' && Number.isFinite(pointB.y) ? pointB.y : 60
  return {
    subject7RodAX: ax,
    subject7RodAY: ay,
    subject7RodBX: bx,
    subject7RodBY: by,
  }
}
