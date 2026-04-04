export const BLOCK_CATALOG_SNAPSHOT = {
  schema: 'eazyfii.project.blockCatalog.v1',
  blocks: [
    { type: 'block_inittime', label: '在时间开始', fields: { time: '00:00' }, keywords: ['时间', '开始', 'init', 'time'] },
    { type: 'Goertek_HorizontalSpeed', label: '水平速度', fields: { VH: '60', AH: '100' }, keywords: ['水平', '速度', 'vh', 'ah'] },
    { type: 'Goertek_VerticalSpeed', label: '垂直速度', fields: { VV: '60', AV: '100' }, keywords: ['垂直', '速度', 'vv', 'av'] },
    { type: 'Goertek_UnLock', label: '解锁', fields: {}, keywords: ['解锁', 'unlock'] },
    { type: 'block_delay', label: '延时', fields: { time: '500' }, keywords: ['延时', '等待', 'delay', 'time'] },
    { type: 'Goertek_TakeOff2', label: '起飞', fields: { alt: '100' }, keywords: ['起飞', 'takeoff', 'alt'] },
    {
      type: 'EazyFii_MoveToCoordAutoDelay',
      label: '智能平移',
      fields: { X: '0', Y: '0', Z: '100', time: '800' },
      keywords: ['平移', '自动延时', 'move', 'auto', 'delay', 'x', 'y', 'z'],
    },
    { type: 'Goertek_MoveToCoord2', label: '平移到（异步）', fields: { X: '0', Y: '0', Z: '100' }, keywords: ['平移', '坐标', 'move to', 'x', 'y', 'z'] },
    { type: 'Goertek_Move', label: '相对平移（异步）', fields: { X: '0', Y: '0', Z: '0' }, keywords: ['相对', '平移', 'move', 'x', 'y', 'z'] },
    { type: 'Goertek_Turn', label: '转动（异步）', fields: { turnDirection: 'r', angle: '90' }, keywords: ['转向', '转动', 'turn', 'angle'] },
    {
      type: 'Goertek_LEDTurnOnAllSingleColor4',
      label: '设置电机灯光',
      fields: { motor: '1', color1: '#ffffff' },
      keywords: ['灯光', 'led', '颜色', '电机'],
    },
    {
      type: 'Goertek_LEDTurnOnAllSingleColor2',
      label: '设置全部灯光颜色',
      fields: { color1: '#ffffff' },
      keywords: ['灯光', 'led', '颜色', '全部'],
    },
    { type: 'Goertek_Land', label: '降落', fields: {}, keywords: ['降落', 'land'] },
  ],
  constraints: [
    '默认优先使用 EazyFii_MoveToCoordAutoDelay，不要默认使用 Goertek_MoveToCoord2。',
    '禁止使用 Goertek_MoveToCoord（当前工程不识别）。',
    'Goertek_MoveToCoord2 与 EazyFii_MoveToCoordAutoDelay 的 X/Y/Z 建议范围: X[0,400], Y[0,400], Z[100,300]。',
    '仅使用工具返回的 fields 键名，不要自行改写键名大小写。',
  ],
}
