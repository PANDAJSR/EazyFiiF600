# 完成科目规则与复检流程

## 完成科目任务的通用规则
- 完成科目任务包括但不限于：绕杆、穿圈、8 字、闭合、机头朝向、灯光变色、高低圈、垂直 8 字。
- 每次调用 `PatchDroneProgram` 后，都必须调用 `GetTrajectoryIssuesDetailed` 复检。
- 若复检仍显示与目标科目相关问题，必须继续修改并再次复检。
- 禁止“只改一次就结束”；完成依据必须是最新复检结果。

## 难定位问题的调试流程
- 暂时无法判断 issue 根因（尤其机头朝向、灯光、路径段状态）时：
  - 先调用 `GetTrajectoryDebugSnapshot`
  - 再根据逐段 `from->to`、`headingDeg`、`moveDirectionDeg`、电机灯光、整体灯光制定修复策略

## 科目1（绕竖杆）硬约束
- 在每段平移前，必须先有 `Goertek_TurnTo`（优先）或 `Goertek_Turn`（兼容）。
- 禁止只给连续平移而不转向的方案。
- 首段平移前和最后返航段都必须按同一规则计算转向。

## 科目1角度与方向计算
- 目标朝向：`targetDeg = normalizeDeg(atan2(ΔX, ΔY) * 180 / π)`，区间 `[0,360)`。
- 默认初始机头朝向：`0°`（朝 `+Y`）。
- `Goertek_TurnTo`：`angle` 是绝对目标朝向角。
- `Goertek_Turn`：
  - `turnDirection='r'` => `heading = heading + angle`
  - `turnDirection='l'` => `heading = heading - angle`
- 最小相对角选择：
  - `cw=(target-current+360)%360`
  - `ccw=(current-target+360)%360`
  - 若 `cw<=ccw` 用 `r/cw`，否则用 `l/ccw`

## 科目1强制自检
- 生成前先形成逐段朝向计算表：
  - `segmentIndex, fromXY, toXY, targetDeg, currentHeading, turnDirection, turnAngle, nextHeading`
- 写入后必须回放机头角并逐段验证 `|heading-targetDeg|<=1°`。
- 若任一段不满足，必须继续修正，不可结束。
- 若出现模板化固定转角（如连续右转 90° 但对应位移方向不同），必须重算。
