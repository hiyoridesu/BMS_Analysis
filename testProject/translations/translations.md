# 翻译词表使用指南

本工具支持多语言界面切换。语言切换下拉框位于页面右上角。

---

## 1. 词表位置

```
lib/translations.js
```

这是一个普通的 JavaScript 文件，可用任何文本编辑器（VSCode、Notepad++、记事本…）打开编辑。

---

## 2. 词表结构

```javascript
window.TRANSLATIONS = {
    languages: ['zh', 'en', 'ja'],           // 支持的语言代码列表
    default:   'zh',                          // 默认语言
    languageNames: {                          // 下拉框中显示的语言名称
        zh: '中文',
        en: 'English',
        ja: '日本語'
    },
    entries: [
        { key: 'header.title', zh: 'BMS 谱面分析系统', en: 'BMS Chart Analyzer', ja: 'BMS譜面解析' },
        { key: 'btn.upload',   zh: '选择文件',         en: 'Browse',             ja: 'ファイル選択' },
        // ……
    ]
};
```

字段说明：

| 字段 | 含义 |
|---|---|
| `languages` | 支持的语言代码数组，下拉框按此顺序展示 |
| `default` | 默认语言代码（必须出现在 `languages` 中） |
| `languageNames` | 语言代码到下拉框显示名称的映射 |
| `entries` | 词条列表 |
| `entries[i].key` | 词条标识，对应 HTML 中的 `data-i18n="..."` |
| `entries[i].<lang>` | 该词条在某种语言下的翻译 |

---

## 3. 修改翻译

**修改已有词条**：直接编辑 `entries` 中对应行的 `zh/en/ja` 值即可。

```js
{ key: 'btn.upload', zh: '选择文件', en: 'Pick File', ja: 'ファイル選択' }
//                                   ↑ 改这里
```

**添加新词条**：

1. 在 `entries` 数组追加一行：
   ```js
   { key: '新.key', zh: '中文翻译', en: 'English', ja: '日本語' }
   ```
2. 在 HTML 中给对应元素加上 `data-i18n="新.key"` 属性

**找不到翻译时的行为**：页面会保留 HTML 中的原文（即源文本）。

---

## 4. 添加新语言

1. 在 `languages` 数组中追加新语言代码（如 `ko`）：
   ```js
   languages: ['zh', 'en', 'ja', 'ko']
   ```
2. 在 `languageNames` 中补充显示名称：
   ```js
   languageNames: { zh: '中文', en: 'English', ja: '日本語', ko: '한국어' }
   ```
3. 给所有 `entries` 补充该语言的翻译（如缺失，下拉框选到该语言时该词条会回退到原文）

---

## 5. 修改后如何生效

保存 `lib/translations.js`，然后**刷新浏览器页面**即可。无需重新构建。

下拉框选择的语言会被保存在浏览器 `localStorage` 中，下次打开页面会自动恢复。

---

## 6. 翻译不生效 / 加载被拦截的处理

部分浏览器以 `file://` 协议直接打开本地 HTML 时，可能会拦截 JS 文件的加载（尤其是 Chrome 对 `<script>` 引用的本地 JS 限制较为严格）。

如果遇到这种情况，按下面任一方式启动一个本地静态服务器：

### 方式 A：Python（推荐）

```bash
cd <项目根目录>
python -m http.server 8080
# 然后浏览器访问 http://localhost:8080/
```

### 方式 B：Node.js

```bash
cd <项目根目录>
npx serve .
# 终端会显示访问地址，通常是 http://localhost:3000/
```

### 方式 C：VSCode Live Server 插件

1. 在 VSCode 中安装 **Live Server** 扩展
2. 右键 `index.html` → 选择 "Open with Live Server"

### 方式 D：Chrome 启动参数（不推荐）

```bash
chrome.exe --allow-file-access-from-files
```

---

## 7. 翻译范围

**会被翻译的内容**：

- 页面静态文字：导航、按钮、章节标题、上传提示、个人偏好选项等

**不会被翻译的内容**：

- 雷达图 6 轴标签（NOTES / PEAK / CHORD …，统一用英文）
- 图表、仪表盘卡片、数据列表（由 JS 动态生成）
- 动态错误信息、文件大小提示等

如需调整翻译范围，需在源码中给相应元素加上 `data-i18n="..."` 属性，并在词表中补充对应词条。

---

## 8. 常见问题

**Q：编辑词表后页面没变化？**
A：浏览器可能缓存了旧版 JS。按 `Ctrl+Shift+R`（Windows）或 `Cmd+Shift+R`（Mac）强制刷新。

**Q：某个词条切换语言后变成空白？**
A：检查词表中该 key 是否在新语言下有对应的翻译。若缺失，工具会回退到 HTML 原文，不会变空白。如果变空白，说明 HTML 原文本身已被前一次切换覆盖——重新加载页面即可恢复。

**Q：可以用 Excel 编辑吗？**
A：目前词表是 JS 文件，建议用文本编辑器编辑。如果习惯 Excel，可以维护一份 Excel 作为"源"，手工同步到 `translations.js` 中（项目当前未提供自动转换工具）。
