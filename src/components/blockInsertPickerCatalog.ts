import { INSERTABLE_BLOCKS, type InsertableBlockDefinition } from './blockInsertCatalog'
import { INSERTABLE_TEMPLATES, type InsertableTemplateDefinition } from './blockTemplateCatalog'

export type InsertPickerItem = {
  id: string
  label: string
  keywords: string[]
  kind: 'block' | 'template'
  meta: string
  blockDefinition?: InsertableBlockDefinition
  templateDefinition?: InsertableTemplateDefinition
}

const blockItems: InsertPickerItem[] = INSERTABLE_BLOCKS.map((definition) => ({
  id: `block:${definition.type}`,
  label: definition.label,
  keywords: definition.keywords,
  kind: 'block',
  meta: definition.type,
  blockDefinition: definition,
}))

const templateItems: InsertPickerItem[] = INSERTABLE_TEMPLATES.map((definition) => ({
  id: `template:${definition.id}`,
  label: definition.label,
  keywords: definition.keywords,
  kind: 'template',
  meta: definition.description,
  templateDefinition: definition,
}))

export const INSERT_PICKER_ITEMS: InsertPickerItem[] = [...blockItems, ...templateItems]
