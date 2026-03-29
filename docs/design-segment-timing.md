# 手动 Override 段落时间设计

## 需求
用户可以手动设置每段路径（segment group）的播放时长，覆盖自动计算的值。

## 当前机制
AnimationEngine.computeTimeline() 自动分配时间：
- 总时长 = max(20s, segments×4s), 上限 180s
- 每段按路线长度比例分配 variable time
- 每段包含 5 个 phase: HOVER → ZOOM_OUT → FLY → ZOOM_IN → ARRIVE
- Phase 比例固定: hover 1-2s, zoom_out 20%, fly 65%, zoom_in 15%, arrive 1.5-3.5s

## 设计方案

### 数据模型

```typescript
// 在 Segment 类型上添加（或在 project store 中独立管理）
interface Segment {
  // ...existing
  durationOverride?: number; // 用户设定的该段总时长（秒），undefined = auto
}
```

实际上 override 应该作用在 **animation group** 级别（多个 waypoint segment 合并成一个 group）。但 group 是动态计算的，用户界面看到的是 segment。

**更好的方案**：在 project store 中存一个独立 map：

```typescript
// projectStore 新增
segmentTimingOverrides: Record<string, number>; // segmentId → duration in seconds
setSegmentTiming: (segmentId: string, duration: number | null) => void;
// null = 清除 override，恢复自动
```

### UI 交互

在 TransportSelector 组件旁边（两个地点之间的连接区域）添加时间控件：

```
┌─────────────────────────┐
│ 1  Seoul                │
└─────────────────────────┘
   ✈️ Flight ▾  ⏱ 8.2s [━━━━●━━━━] ← 时间滑块/输入框
┌─────────────────────────┐
│ 2  Atlanta              │
└─────────────────────────┘
   🚗 Car ▾    ⏱ 4.0s [━━━●━━━━━━]
┌─────────────────────────┐
│ 3  Miami                │
└─────────────────────────┘
```

**交互方式（二选一）：**

#### 方案 A: 内联滑块（推荐 ✅）
- TransportSelector 下方显示一行：`⏱ Auto (8.2s)` 或 `⏱ 8.2s`
- 点击时间值 → 展开滑块 (2s - 30s 范围)
- 拖动滑块即时更新
- 右侧有 "Auto" 按钮恢复自动

```
┌──────────────────────────────────┐
│ ✈️ Flight ▾                      │
│ ⏱ 8.2s [━━━━━━●━━━━━━━] [Auto] │
└──────────────────────────────────┘
```

#### 方案 B: 点击编辑
- 显示 `⏱ 8.2s`（灰色小字）
- 点击数字 → 变成 input 可输入
- 输入完 Enter 确认

**推荐方案 A**，更直观，拖动时可以实时预览动画时长变化。

### AnimationEngine 适配

computeTimeline() 需要接收 timing overrides：

```typescript
constructor(
  map: mapboxgl.Map,
  locations: Location[],
  segments: Segment[],
  timingOverrides?: Record<string, number> // segmentId → duration
)
```

在 computeTimeline 中：
1. 先按现有逻辑计算每段的自动时长
2. 如果某段有 override，替换该段的总时长
3. 按 override 后的总时长重新分配 phase 比例（保持 hover/arrive 固定，fly 等比例缩放）

### Phase 分配规则（有 override 时）

```
override_duration = user_set_seconds
hover = fixed (camera.getHoverDuration)
arrive = fixed (1.5s + photo_time)
variable = override_duration - hover - arrive
zoom_out = variable * 0.2
fly = variable * 0.65
zoom_in = variable * 0.15
```

如果 override 太短（< hover + arrive），限制最小值 = hover + arrive + 1s。

### 预览联动

- 用户拖动滑块时，实时重建 timeline
- PlaybackControls 的时间轴长度自动更新
- 如果正在播放，暂停并 seekTo 当前段的开始位置

### 导出/导入

segmentTimingOverrides 保存在 route JSON 中：
```json
{
  "segments": [...],
  "timingOverrides": {
    "seg_1": 10,
    "seg_3": 5.5
  }
}
```

## 实现优先级

1. 数据模型 + projectStore
2. AnimationEngine 支持 override
3. TransportSelector UI（滑块）
4. 导出/导入持久化
