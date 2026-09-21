# BMS 谱面分析系统

面向玩家的 BMS 谱面难度与键型分析工具。纯前端实现，零部署。

## 使用方式

直接用浏览器打开 `index.html` 即可。

> ⚠️ 部分浏览器对 `file://` 协议下加载本地 JS 有限制。如果出现脚本无法加载的问题，请用任意静态服务器启动，例如：
>
> ```bash
> # 任选其一
> python -m http.server 8080
> npx serve .
> ```
>
> 然后浏览器访问 `http://localhost:8080/`。

## 功能

1. 上传单个 `.bms` / `.bme` / `.pms` 谱面文件
2. 自动分析：
   - 平均密度、加权平均密度（期望值）
   - 瞬时峰值密度（1 秒窗口）、持续峰值密度（2 秒窗口）
   - 峰值操作要求（高密度区间累积音符数）
   - 键型识别：纵连、多押、楼梯、皿复合
   - 左右手压力分配（仅作统计）
   - 加权总难度（公式见 `BMS谱面分析系统-方案设计文档.md`）
3. 可视化：
   - 难度曲线图（小节粒度 + 15 秒段粒度，密度折线 + 键型堆叠柱）
   - 六维难度雷达图（归一化 0~200）
   - 总览仪表盘 + 完整数据列表
4. 一键导出 PDF 分析报告（文件名基于谱面名）

## 项目范围

- 仅支持 7K（7 键 + Scratch）
- 不含变速、不处理 `#RANDOM` 等流程指令
- LN 兼容 51~59 通道与 `#LNOBJ`，仅统计开始点
- 不支持 BMSON 格式

## 项目结构

```
project/
├── index.html                 # 页面入口
├── styles/main.css            # 样式
├── src/
│   ├── main.js                # 应用入口
│   ├── parser/
│   │   ├── bms-parser.js      # 文本格式解析
│   │   └── normalizer.js      # 时间/轨道/LN 标准化
│   ├── analyzer/
│   │   ├── density.js         # 密度分析
│   │   ├── pattern.js         # 键型识别
│   │   ├── segment.js         # 15 秒分段 + 左右手统计
│   │   └── difficulty.js      # 难度加权和 + 雷达归一化
│   ├── visualizer/
│   │   ├── density-chart.js   # 难度曲线图
│   │   ├── radar-chart.js     # 雷达图
│   │   └── dashboard.js       # 仪表盘 + 数据列表
│   ├── exporter/
│   │   └── pdf-exporter.js    # html2pdf.js 封装
│   └── ui/
│       └── controller.js      # 流程编排
├── lib/                       # 第三方库（Chart.js / html2pdf.js）
└── BMS谱面分析系统-方案设计文档.md
```

## 模块依赖关系

```
[上传文件]
   ↓
BMSParser → Normalizer → ChartData
                            ↓
           ┌────────────────┼────────────────┐
           ↓                ↓                ↓
     DensityAnalyzer  PatternDetector  SegmentAnalyzer
           ↓                ↓                ↓
           └──────→ DifficultyCalculator ←───┘
                            ↓
                ┌───────────┼───────────┐
                ↓           ↓           ↓
       DensityChartView RadarChartView DashboardView
                            ↓
                       PDFExporter
```

## 详细方案

完整算法与设计决策见：[BMS谱面分析系统-方案设计文档.md](./BMS谱面分析系统-方案设计文档.md)
