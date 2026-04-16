# 积木类型参考

## 基础控制积木

| 类型 | 说明 | 字段 |
|------|------|------|
| `block_inittime` | 时间开始 | `time` |
| `Goertek_HorizontalSpeed` | 水平速度 | `VH`, `AH` |
| `Goertek_VerticalSpeed` | 垂直速度 | `VV`, `AV` |
| `Goertek_UnLock` | 解锁 | - |
| `block_delay` | 延时 | `time` |

## 飞行控制积木

| 类型 | 说明 | 字段 |
|------|------|------|
| `Goertek_TakeOff2` | 起飞 | `alt` |
| `EazyFii_MoveToCoordAutoDelay` | 智能平移（默认使用） | `X`, `Y`, `Z`, `time` |
| `Goertek_MoveToCoord2` | 异步平移（仅明确要求时使用） | `X`, `Y`, `Z` |
| `Goertek_Move` | 异步相对平移 | `X`, `Y`, `Z` |
| `Goertek_TurnTo` | **转向**（绝对朝向） | `turnDirection`, `angle` |
| `Goertek_Turn` | **转动**（相对旋转） | `turnDirection`, `angle` |
| `Goertek_Land` | 降落 | - |

### 转向与转动积木的区别

**重要**：飞机平移时通常不需要手动控制转向，因为：

- `EazyFii_MoveToCoordAutoDelay` 等平移积木会**自动计算并调整机头朝向**，使其朝向目标坐标方向
- 手动转向只在**科目一等明确要求特定朝向**的场景下才需要使用

| 积木 | 作用 | 使用场景 |
|------|------|----------|
| `Goertek_TurnTo` | **转向**：将机头对准到指定的绝对角度（世界坐标系） | 科目一等需要特定机头朝向的场景 |
| `Goertek_Turn` | **转动**：相对于当前机头旋转指定角度 | 绕杆、原地转向等需要相对旋转的场景 |

**示例**：
- 转向 90°：`Goertek_TurnTo` 的 `angle` 为 `90`，表示机头朝向世界坐标的 90° 方向
- 转动 90°：`Goertek_Turn` 的 `angle` 为 `90`，表示从当前机头向右转 90°

## 灯光控制积木

| 类型 | 说明 | 字段 |
|------|------|------|
| `Goertek_LEDTurnOnAllSingleColor4` | 设置电机灯光 | `motor`, `color1` |
| `Goertek_LEDTurnOnAllSingleColor2` | 设置全部灯光 | `color1` |

## 字段值说明

### 坐标与时间

- `X`、`Y`、`Z`：非空字符串数字，如 `"120"`、`"100"`
- `time`：非空字符串数字，如 `"800"`、`"1000"`（毫秒）
- `alt`/`VH`/`VV`/`AH`/`AV`：速度/高度参数

### 灯光颜色

- 颜色值为十六进制 RGB，如 `"#00FF00"`（绿色）、`"#FF0000"`（红色）、`"#0000FF"`（蓝色）

### turnDirection

- `'r'` 或 `'l'`，表示右转或左转

### angle

- `Goertek_TurnTo`：`angle` 是绝对目标朝向角（世界坐标系）
- `Goertek_Turn`：`angle` 是相对当前机头的旋转量

### motor

- `"1"` 或 `"2"`，表示1号或2号电机

## 积木草稿 block 结构

```json
{
  "type": "EazyFii_MoveToCoordAutoDelay",
  "fields": { "X": "120", "Y": "120", "Z": "100", "time": "800" },
  "comment": "可选注释"
}
```

## 科目1积木写法示例

> **说明**：科目1需要特定机头朝向，因此示例中包含转向积木 `Goertek_TurnTo`。

```json
{ "type": "Goertek_LEDTurnOnAllSingleColor4", "fields": { "motor": "1", "color1": "#00FF00" } }
{ "type": "block_delay", "fields": { "time": "100" } }
{ "type": "Goertek_LEDTurnOnAllSingleColor4", "fields": { "motor": "2", "color1": "#00FF00" } }
{ "type": "block_delay", "fields": { "time": "100" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "120", "Y": "120", "Z": "100", "time": "800" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "120", "Y": "200", "Z": "100", "time": "800" } }
{ "type": "Goertek_TurnTo", "fields": { "turnDirection": "r", "angle": "90" } }
{ "type": "block_delay", "fields": { "time": "1000" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "200", "Y": "200", "Z": "100", "time": "800" } }
{ "type": "Goertek_TurnTo", "fields": { "turnDirection": "r", "angle": "180" } }
{ "type": "block_delay", "fields": { "time": "1000" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "200", "Y": "120", "Z": "100", "time": "800" } }
{ "type": "Goertek_TurnTo", "fields": { "turnDirection": "r", "angle": "270" } }
{ "type": "block_delay", "fields": { "time": "1000" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "120", "Y": "120", "Z": "100", "time": "800" } }
```

## 科目2积木写法示例

> **说明**：科目2只需平移飞行，平移积木会自动调整机头朝向，无需使用转向积木。

```json
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "280", "Y": "40", "Z": "130", "time": "800" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "280", "Y": "120", "Z": "130", "time": "800" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "280", "Y": "120", "Z": "170", "time": "800" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "280", "Y": "40", "Z": "170", "time": "800" } }
{ "type": "EazyFii_MoveToCoordAutoDelay", "fields": { "X": "280", "Y": "40", "Z": "130", "time": "800" } }
```
