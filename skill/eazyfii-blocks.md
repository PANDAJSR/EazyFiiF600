# 积木类型参考

| 类型 | 说明 | 字段 |
|------|------|------|
| `block_inittime` | 时间开始 | `time` |
| `Goertek_HorizontalSpeed` | 水平速度 | `VH`, `AH` |
| `Goertek_VerticalSpeed` | 垂直速度 | `VV`, `AV` |
| `Goertek_UnLock` | 解锁 | - |
| `block_delay` | 延时 | `time` |
| `Goertek_TakeOff2` | 起飞 | `alt` |
| `EazyFii_MoveToCoordAutoDelay` | 智能平移 | `X`, `Y`, `Z`, `time` |
| `Goertek_MoveToCoord2` | 平移到（异步） | `X`, `Y`, `Z` |
| `Goertek_Move` | 相对平移（异步） | `X`, `Y`, `Z` |
| `Goertek_TurnTo` | 转向（绝对） | `turnDirection`, `angle` |
| `Goertek_Turn` | 转动（相对） | `turnDirection`, `angle` |
| `Goertek_LEDTurnOnAllSingleColor4` | 设置电机灯光 | `motor`, `color1` |
| `Goertek_LEDTurnOnAllSingleColor2` | 设置全部灯光 | `color1` |
| `Goertek_Land` | 降落 | - |
