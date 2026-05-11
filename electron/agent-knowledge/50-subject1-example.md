# 科目1示例（绕竖杆）

> 仅用于示例说明，实际坐标、速度、延时需按现场与路线复检后调整。

## 示例前提
- 假设科目1竖杆中心约为 `(160,160)`。
- 示例目标：围绕竖杆完成封闭矩形轨迹并离开科目区域。

## 示例步骤（仅示例）
1. 设置电机 1 号灯光为 `#00FF00`（将前面两个灯光置为绿色）
2. 延时 `100 ms`（防止因飞机程序神秘 bug 导致灯光无法点亮）
3. 设置电机 2 号灯光为 `#00FF00`
4. 延时 `100 ms`
5. 智能平移到 `(120,120,100)`（前往杆子左下角，可根据实际路线情况调整，高度 `<150` 即可；进场段不要求机头朝向飞行方向）
6. 转动（`Goertek_Turn`）：按当前机头相对转到第一条正方形边的飞行方向
7. 延时 `1000 ms`（转动是异步的，按飞机角速度建议延时 1 秒）
8. 智能平移到 `(120,200,100)`（杆子左上角）
9. 转动（`Goertek_Turn`）：相对转到下一条边方向（从 `(120,200)` 飞往 `(200,200)`）
10. 延时 `1000 ms`
11. 智能平移到 `(200,200,100)`（杆子右上角）
12. 转动（`Goertek_Turn`）：相对转到下一条边方向
13. 延时 `1000 ms`
14. 智能平移到 `(200,120,100)`（杆子右下角）
15. 转动（`Goertek_Turn`）：相对转到下一条边方向
16. 延时 `1000 ms`
17. 智能平移到 `(120,120,100)`（杆子左下角，完成科目1封闭图形）
18. 离开科目1区域（离场段位于封闭图形外，默认不强制机头朝向）

## 对应积木写法（字段示意）
- `Goertek_LEDTurnOnAllSingleColor4`：`{ motor: "1", color1: "#00FF00" }`
- `block_delay`：`{ time: "100" }`
- `Goertek_LEDTurnOnAllSingleColor4`：`{ motor: "2", color1: "#00FF00" }`
- `block_delay`：`{ time: "100" }`
- `EazyFii_MoveToCoordAutoDelay`：`{ X: "120", Y: "120", Z: "100", time: "800" }`
- `Goertek_Turn`：`{ turnDirection: "r", angle: "0" }`（示例假设当前机头已朝 `+Y`，实际应按当前机头计算相对角；若角度为 `0` 可省略）
- `block_delay`：`{ time: "1000" }`
- `EazyFii_MoveToCoordAutoDelay`：`{ X: "120", Y: "200", Z: "100", time: "800" }`
- `Goertek_Turn`：`{ turnDirection: "r", angle: "90" }`
- `block_delay`：`{ time: "1000" }`
- `EazyFii_MoveToCoordAutoDelay`：`{ X: "200", Y: "200", Z: "100", time: "800" }`
- `Goertek_Turn`：`{ turnDirection: "r", angle: "90" }`
- `block_delay`：`{ time: "1000" }`
- `EazyFii_MoveToCoordAutoDelay`：`{ X: "200", Y: "120", Z: "100", time: "800" }`
- `Goertek_Turn`：`{ turnDirection: "r", angle: "90" }`
- `block_delay`：`{ time: "1000" }`
- `EazyFii_MoveToCoordAutoDelay`：`{ X: "120", Y: "120", Z: "100", time: "800" }`

## 复检提醒
- 写入示例后，仍需调用轨迹问题复检工具确认科目1是否真正达成。
- 若机头朝向或封闭判定未通过，优先检查封闭绕行段；不要把封闭图形外的进场/离场段误当成必修复机头段。
