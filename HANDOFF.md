# HANDOFF — Free Mode WYSIWYG Caption 对齐问题

## 📋 当前状态
- **Branch**: `main` (所有修改都已直接 commit push)
- **Build**: ✅ `npm run build` 通过
- **TSC**: ✅ 无类型错误
- **Open PRs**: 无
- **Vercel**: 自动部署到 trace-recap.vercel.app

## 🐛 要修的问题

**Free Mode 编辑器 (FreeCanvas) 和实际回放 (PhotoOverlay) 之间的 caption 位置对不上。**

用户在 FreeCanvas 里拖拽 caption 到某个位置，但点 Play 回放时 caption 偏了。照片位置已经对上了，只有 caption 有偏差。

### 已尝试的修复（最近 5 个 commit，全在 main 上）

| Commit | 做了什么 | 结果 |
|--------|---------|------|
| `390c627` | FreeCanvas 用 ResizeObserver 测量自身 DOM 宽度来算 captionScale | ✅ 主人还没测试就说要开新 session fix |
| `53bc6e7` | PhotoOverlay(parent mode) + FreeCanvas 都加 95%×88% inset | 照片对了，caption 还差一点 |
| `4254dcf` | 去掉 95%×88% wrapper，两边都用 100% | 在这之前照片也对不上 |
| `998dbb2` | FreeCanvas 包在 95%×88% inset 容器里 | 照片还是对不上 |
| `bcf1497` | editor preview 保持 viewport aspect ratio | 让 preview 比例对了 |

### 问题根因分析

三个渲染场景要保持一致：
1. **FreeCanvas** (编辑器拖拽模式) — `src/components/editor/FreeCanvas.tsx`
2. **PhotoOverlay in editor** (非 free mode 预览) — `containerMode="parent"`, 100%×100%
3. **PhotoOverlay in playback** (实际回放) — `containerMode="viewport"`, 95%×88% inset

Caption 定位用 CSS 百分比 (`left: ${x*100}%`)，照片也是百分比。所以**只要容器一致，百分比就一致**。

照片已经对了，说明容器大小匹配成功了。Caption 偏差的原因：

**`captionScale = containerSize.w / 1000`** — 用于计算字体大小。字体大小影响 caption pill 的实际像素尺寸，进而影响 `translate(-50%, -50%)` 的居中偏移。

- **FreeCanvas** 之前用外部传入的 `previewPixelSize.width * 0.95` 估算
- **PhotoOverlay** 用 ResizeObserver 实测 DOM 宽度
- 两者有几像素差异 → 字体大小微偏 → pill 尺寸不同 → `-50%` 偏移不同

**commit `390c627` 的修复**: 让 FreeCanvas 也用 ResizeObserver 测量自己的 DOM 实际宽度，跟 PhotoOverlay 完全一致的方式。**这个修复应该是正确的**，但主人还没验证就说要开新 session。

## 📁 关键文件

### 核心三文件
- **`src/components/editor/FreeCanvas.tsx`** — Free mode 拖拽编辑器，处理照片和 caption 的拖拽、缩放、旋转。Commit `390c627` 加了 ResizeObserver
- **`src/components/editor/PhotoOverlay.tsx`** — 照片回放渲染组件，有 `containerMode` (viewport/parent) 两种模式
- **`src/components/editor/PhotoLayoutEditor.tsx`** — 包含预览区域，在 free mode 下渲染 FreeCanvas，非 free mode 渲染 PhotoOverlay

### 数据流
- 照片位置/大小存在 `freeTransforms: Map<photoId, FreeTransform>` (Zustand store)
- FreeTransform: `{ x, y, width, height, rotation, zIndex, caption?: { offsetX, offsetY } }`
- 所有坐标都是 **0-1 比例值**（相对容器）
- Caption 位置: `centerX = photo.x + photo.width/2 + caption.offsetX`, `centerY = photo.y + photo.height/2 + caption.offsetY`
- 字体缩放: `captionScale = containerWidth / 1000`

### 布局层次
```
PhotoLayoutEditor
  └─ PreviewWithMapBackground (preserves viewport aspect ratio)
       ├─ [non-free] PhotoOverlay (containerMode="parent", 100%×100%)
       └─ [free mode] wrapper div
            └─ FreeCanvas (absolute inset-0)
```

实际回放：
```
MapStage
  └─ PhotoOverlay (containerMode="viewport", 95%×88% + margin:auto)
```

## ✅ 已确认可以正常工作的
- `npm run build` 通过
- 照片位置在 FreeCanvas vs PhotoOverlay 之间已对齐
- Google Fonts 加载正常（Noto Sans SC, ZCOOL KuaiLe 等中文字体）
- Caption toolbar 不再被 overflow:hidden 裁切
- 扩展模式(expanded)正常工作

## 🔧 建议下一步

1. **先验证 commit `390c627` 是否已修复** — 在 Vercel 部署后测试 FreeCanvas 和 playback 的 caption 是否对齐
2. 如果还没对齐，可能需要：
   - Debug: 在 FreeCanvas 和 PhotoOverlay 里 `console.log` captionScale 值对比
   - 确保两边用的 `containerSize.w` 完全一致（DOM 实测值 vs 估算值）
   - 考虑 `translate(-50%, -50%)` 的替代方案（比如用 `text-align: center` + `position` 来避免自身尺寸影响）

## 📌 其他待做的 TASK 文件（不急）
- `TASK-breadcrumb-trail.md` — 面包屑照片轨迹
- `TASK-chapter-pins.md` — 章节标记
- `TASK-trip-stats.md` — 旅程统计条
- `TASK-waypoint.md` — 途经点动画修复
- `TASK.md` — Free Mode UX R2（大部分已完成，可能还有残留问题）

## 🏗️ 项目基本信息
- **Stack**: Next.js 14+ / TypeScript / Tailwind CSS / shadcn/ui / Mapbox GL JS v3 / Zustand
- **Repo**: github.com/kaikezhang/trace-recap
- **Node**: v22, npm
- **Working dir**: `/home/kaike/.openclaw/workspace/trace-recap`
