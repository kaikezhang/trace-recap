# TraceRecap 9:16 Demo — 优化方案

**基于:** 美学分析报告 (`docs/demo-aesthetics-analysis.md`)  
**日期:** 2026-04-05

---

## 执行摘要

Demo 视频综合美学评分 **6.3/10**。当前 app 对 9:16 竖屏的支持处于"能用但不精致"阶段。最严重的问题是数据错误（P0）和照片卡在竖屏下几乎不可用（P0），其次是录制时 UI 元素破坏视频感（P1）和运输图标方向僵硬（P1）。

---

## P0 — 必须修复（阻断性问题）

### 1. 🔴 替换 alishan-1.jpg（数据错误）

**问题:** `public/demo-photos/alishan-1.jpg` 是二战 Enigma 密码机博物馆照片，不是阿里山风景。这会直接误导用户。

**修复方案:**
```bash
# 替换为真正的阿里山照片（云海、森林小火车、日出等）
# 建议从 Unsplash / Pexels 下载授权照片
# 推荐关键词: "Alishan sunrise", "Alishan forest railway", "Taiwan mountain mist"
```

**验收标准:** `alishan-1.jpg` 必须是台湾阿里山实景照片，与文件名匹配。

---

### 2. 🔴 Photo Card 竖屏布局重构

**问题:** 9:16 masonry 布局中，每张照片只有约 130×80px，完全不可读。东京塔的宽图被压缩成细条。

**当前行为 (16:9):**
```
┌─────────┬─────────┬─────────┐
│  photo1 │ photo2  │ photo3  │  ← 每张约 300×200px
└─────────┴─────────┴─────────┘
```

**9:16 当前行为（问题）:**
```
┌────┬────┬────┐
│  p │ p  │ p  │  ← 每张约 130×80px，太小！
└────┴────┴────┘
```

**优化方案 — 9:16 竖屏单图模式:**

当 `viewportRatio === "9:16"` 时，photo card 应改为**全屏单图展示**：

```
┌──────────────────┐
│                  │
│                  │
│     photo        │  ← 占据地图区域 70%+ 高度
│                  │
│                  │
├──────────────────┤
│  City Label      │  ← 底部城市名
│  Caption         │  ← 照片说明
└──────────────────┘
```

**实现位置:** `src/components/editor/PhotoOverlay.tsx` + `src/lib/photoLayout.ts`

**关键代码思路:**
```typescript
// 在 PhotoOverlay 中检测竖屏模式
const isVertical = viewportRatio === "9:16" || viewportRatio === "3:4";

// 竖屏时强制单图布局，忽略 masonry
const layout = isVertical
  ? { type: "single", photoIndex: activePhotoIndex }
  : { type: "masonry", columns: 3 };
```

---

## P1 — 重要优化

### 3. 🟡 Demo 录制时强制沉浸模式

**问题:** 顶部工具栏（map style、speed slider、aspect buttons）在录制时暴露"编辑器 UI"，破坏视频感。

**优化方案:**
- 在录制脚本中，playback 开始后执行 Immersive Mode toggle（隐藏工具栏）
- 或者新增 `?demo=true&immersive=true` URL 参数，自动进入沉浸模式

**实现:** `src/components/editor/EditorLayout.tsx` 中的 `immersiveMode` 状态支持 URL 参数初始化。

---

### 4. 🟡 运输图标动态旋转

**问题:** 飞机/火车图标始终水平朝右，不随路线方位变化。

**优化方案:**
```typescript
// 在 iconAnimator 中根据 segment 方位角旋转
const bearing = getBearing(fromCoords, toCoords);
iconElement.style.transform = `rotate(${bearing}deg)`;
```

**适用场景:** 仅在 9:16 竖屏且 segment 斜向（bearing ≠ 0°/180°）时激活，避免图标倒置。

---

### 5. 🟡 Trip Stats Bar 竖屏适配

**问题:** 底部 Stats Bar (`23,225 km | 3 cities | 13 photos`) 横向排列，在 9:16 中与 breadcrumb trail 紧贴。

**优化方案 — 竖屏图标化:**
```
9:16 竖屏下:
┌──────────────────┐
│  ✈️ 23k  🏙️ 3  📷 13  │  ← 图标 + 数字，紧凑竖向排列
└──────────────────┘
```

---

### 6. 🟡 Breadcrumb Trail 竖屏动态位置

**问题:** 竖屏下 breadcrumb markers 聚集在狭窄底部带，与地图内容重叠。

**优化方案:**
- 竖屏时 breadcrumb markers 允许浮动到画面**左右两侧边缘**
- 使用 `position: absolute` + `left/right` 交替布局，避免垂直重叠

---

## P2 — 体验增强（可选）

### 7. 🎯 横幅照片 Ken Burns 竖屏适配

对于宽幅照片（如 Seattle 全景），在 9:16 展示时启用 slow pan：
- 从左到右缓慢平移（2-3 秒）
- 避免静态裁切导致主体丢失

**实现位置:** `src/lib/photoAnimation.ts` 中的 Ken Burns 逻辑。

---

### 8. 🎯 9:16 专属地图样式

竖屏下自动切换到**标注更少、留白更多**的地图样式：
- 隐藏不必要的 road labels
- 降低 POI (Points of Interest) 密度
- 给航线和图标更多视觉呼吸空间

---

### 9. 🎯 照片 Ken Burns 针对横幅优化

横幅照片在 9:16 下自动启用水平 slow pan，让用户看到完整画面。

---

## 推荐实施顺序

```
Week 1 (P0 紧急):
  └─ 替换 alishan-1.jpg
  └─ Photo Card 竖屏重构 → 单图模式

Week 2 (P1 重要):
  └─ 沉浸模式 URL 参数支持
  └─ 运输图标旋转
  └─ Trip Stats Bar 竖屏图标化

Week 3 (P2 体验):
  └─ Breadcrumb 动态位置
  └─ 横幅照片 Ken Burns
  └─ 9:16 地图样式优化
```

---

## Demo 录制最佳配置（立即可用）

在当前未优化版本上录制最优 demo 的推荐配置：

| 设置项 | 推荐值 |
|--------|--------|
| 地图样式 | Light 或 Vintage |
| 照片布局 | Overlap 或 Full |
| Overlay 元素 | 只开 Chapter Pins，关闭 Breadcrumbs + Stats |
| 模式 | Immersive Mode（隐藏工具栏）|
| 速度 | 1.0× |
| 比例 | 9:16 |
| 录制范围 | 选择最有视觉冲击的 3-4 个 segment（Tokyo 夜拍必选）|

