export type TemplateInsertionContext = {
  x: number
  y: number
  z: number
  orientationDeg: number
}

export type Subject1SquareStableParams = {
  subject1X: number
  subject1Y: number
  insertionContext?: TemplateInsertionContext
}

export type Subject1SquareTurnAndFlyParams = Subject1SquareStableParams

export type Subject2RectangleStableParams = {
  subject2RodAX: number
  subject2RodAY: number
  subject2RodBX: number
  subject2RodBY: number
  insertionContext?: TemplateInsertionContext
}

export type Subject5HexagonFigureEightParams = {
  subject5RodAX: number
  subject5RodAY: number
  subject5RodBX: number
  subject5RodBY: number
  insertionContext?: TemplateInsertionContext
}

export type Subject6OctagonFigureEightParams = {
  subject6RodAX: number
  subject6RodAY: number
  subject6RodBX: number
  subject6RodBY: number
  subject6RodCX: number
  subject6RodCY: number
  subject6RodDX: number
  subject6RodDY: number
  insertionContext?: TemplateInsertionContext
}

export type Subject7ThreeColorRingsParams = {
  subject7RodAX: number
  subject7RodAY: number
  subject7RodBX: number
  subject7RodBY: number
  insertionContext?: TemplateInsertionContext
}

export type TemplateBuildParams =
  | Subject1SquareStableParams
  | Subject1SquareTurnAndFlyParams
  | Subject2RectangleStableParams
  | Subject5HexagonFigureEightParams
  | Subject6OctagonFigureEightParams
  | Subject7ThreeColorRingsParams
