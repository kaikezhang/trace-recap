# TraceRecap — UI 重设计 Brief（给 AI 设计师）

## 产品介绍

TraceRecap 是一个 web 端旅行路线动画视频生成工具。用户添加旅行途经城市，选择交通方式（飞机、火车、汽车等），系统自动生成带有路线动画、城市标签、照片展示的短视频，可导出 MP4 分享到社交媒体。

**技术栈**: Next.js + React + Tailwind CSS + Mapbox GL 地图 + shadcn/ui 组件库

**目标用户**: 旅行博主、喜欢记录旅行的年轻人（20-35 岁）

## 当前 UI 问题

1. **功能堆叠感强** — 工具栏按钮太多（Undo/Redo/Import/Save/Clear/MapStyle/Export 全挤在一行），像 2010 年的后台管理系统
2. **没有视觉层级** — 所有按钮同等重要，用户不知道先干什么
3. **首页太简陋** — 只有一个标题和两个按钮，没有产品说明、没有预览
4. **移动端体验差** — 底部面板不流畅，播放控件太小
5. **空状态没设计** — 打开编辑器是空白地图 + 空白侧栏，新手完全懵
6. **缺少呼吸感** — 间距不统一，卡片太紧凑

## 设计目标

**简洁、美观、有质感。** 参考 Linear.app / Notion / Arc Browser 的设计语言。

具体：
- 干净而不简陋
- 功能齐全但不拥挤
- 主次分明：核心操作一眼可见，高级功能藏在合理的地方
- 移动端体验和桌面端同样好
- 有品牌感：不只是一堆 UI 组件拼在一起

## 需要设计的页面

### 页面 1: Landing Page（首页）

**功能**: 产品介绍 + 引导用户开始创建

**内容**:
- 品牌 logo + 标语（"Turn your travel routes into cinematic animated videos"）
- 两个 CTA：主按钮 "Try Demo"（加载预设的台湾旅行 demo）、次按钮 "New Journey"
- 产品预览区域：展示一段旅行路线动画的效果（可以是一张高质量截图或 GIF）
- 3 步流程说明卡片：① 添加城市 → ② 自定义路线 → ③ 导出视频
- 页脚：简单的 "Built with ❤️" 或其他

**设计要求**:
- 背景不要纯白，可以用微妙的渐变、地图纹理或 mesh gradient
- Demo 按钮是主 CTA（视觉最突出），New Journey 是次 CTA
- 移动端竖排，桌面端可以左右布局（文字左 + 预览右）

### 页面 2: Editor（编辑器）— Desktop

**整体布局**: 三栏 — 左侧面板 (360px) + 中间地图 (flex-1) + 底部播放条

**顶部工具栏（极简版）**:
- 左侧：Logo（可点回首页）
- 中间/右侧：只放 Undo、Redo 图标按钮 + 一个 "⋮" 更多菜单
- "更多菜单" 里收纳：Import Route / Save Route / Clear Route / Map Style / Export Video
- 工具栏高度约 48px，不要太高

**左侧面板**:
- 顶部：大搜索框（高度 44px，圆角大一些）
  - Placeholder 动画："Search Tokyo..." → "Search Paris..." → "Search New York..."（缓慢轮播）
- 中间：城市卡片列表（可滚动）
  - 每个卡片默认收起态：拖拽手柄 + 序号圆圈 + 英文名/中文名 + 照片缩略图 (3 个小方块) + 删除按钮
  - 卡片之间：交通方式选择器（已有，保持不变 — 药丸形按钮显示当前模式 + 距离）
  - 点击卡片展开：显示名称编辑、照片管理、waypoint 切换等详细功能
- 面板底部：无（所有操作都在顶栏 More 菜单里）

**地图区域**:
- 占据剩余所有空间
- 空状态（没添加城市时）：地图中央显示引导 — 图标 + "Start by searching for a city" + 搜索按钮 + 加载 Demo 按钮
- 有路线时：城市标签用带毛玻璃的浮动标签显示
- 地图加载前显示 skeleton loading（浅灰色脉冲动画），不要空白

**播放控件（地图底部浮动）**:
- 浮动在地图底部居中，圆角药丸形
- 布局：Reset | ▶ Play (大圆形按钮) | Progress bar | 时间
- 进度条较粗（4px 默认，hover 时 6px）
- 毛玻璃背景 + 轻阴影
- 播放中上方显示当前段信息："Taipei → Taichung"

### 页面 3: Editor — Mobile

**布局**: 全屏地图 + 底部 Sheet

**Bottom Sheet 三个状态**:
1. **收起态 (120px)**: 搜索栏 + "3 stops" badge
2. **半展开 (50vh)**: 搜索 + 城市卡片列表
3. **全展开 (85vh)**: 搜索 + 卡片 + 选中卡片的照片编辑

**播放控件 (Mobile)**:
- 固定底部，在 sheet 上方
- Play 按钮居中、更大 (56px)、primary 色
- 进度条在按钮上方，占满宽度

### 页面 4: Export Dialog（导出弹窗）

**两步流程**:
1. 第一步 — 基本设置：
   - 宽高比选择：两个大卡片对比（横屏 16:9 / 竖屏 9:16），选中的有高亮边框
   - "Quick Export (720p)" 主按钮
   - "Advanced Settings ▼" 折叠区域
2. 高级设置（折叠内）：
   - Resolution: 720p / 1080p
   - City Label: English / 中文
   - Label Size slider

**导出中**: 圆环进度动画 + 百分比 + 阶段文字（Capturing frames... / Encoding...）
**完成**: 大 ✓ + 文件大小 + Download 按钮

## 设计规范

### 颜色
- Primary: Indigo-500 (#6366F1) — 用于 CTA 按钮、活跃路线、进度条
- Background: #FAFAFA 或 #F8F9FC（不是纯白 #FFF）
- Surface (卡片): #FFFFFF，带微妙的 border
- Text: #1A1A2E (heading), #64748B (muted)
- Accent 色：交通方式各有自己的颜色（飞机 indigo、火车 emerald、汽车 amber、巴士 violet...）

### 圆角
- 卡片: 12px
- 按钮: 8px
- 输入框: 8px
- 播放条: 16px
- Bottom Sheet 顶部: 20px
- 大 CTA 按钮: 12px

### 间距
- 组件间: 16px
- 卡片内 padding: 12px (mobile) / 16px (desktop)
- Section 间: 24px

### 字体
- 标题: Inter/系统字体, font-weight 600-700
- 正文: Inter/系统字体, font-weight 400
- 数字/时间: tabular-nums（等宽数字）

### 动画
- 展开/折叠: 300ms ease-out
- 淡入淡出: 200ms ease
- 弹出: 350ms spring
- Hover: 150ms ease

## 参考产品

风格参考（简洁、有质感、重交互）:
- **Linear.app** — 极简工具栏、流畅动画、清晰的视觉层级
- **Notion** — 干净的卡片设计、优雅的空状态
- **Arc Browser** — 独特的 sidebar 设计、毛玻璃效果
- **Figma** — 专业工具但不复杂的 UI 布局
- **Craft.do** — 精致的细节处理

## 交付物

请为以上 4 个页面/状态分别出设计稿：

1. **Landing Page** — Desktop + Mobile
2. **Editor Desktop** — 有路线数据的状态 + 空状态
3. **Editor Mobile** — Bottom sheet 三种状态 + 播放态
4. **Export Dialog** — 两步流程

每个页面标注关键尺寸、间距、颜色值。如果有交互动画建议，用文字说明或分帧展示。
