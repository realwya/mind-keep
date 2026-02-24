# app.js Code Review

Date: 2026-02-24 | Status: High-priority issues fixed

---

## High Priority

### H1. innerHTML 使用与 AGENTS.md 安全规范冲突

AGENTS.md 明确规定 "No eval(), innerHTML from user input (use textContent)"，但以下位置使用了 innerHTML：

| 位置 | 上下文 | 当前防护 |
|------|--------|----------|
| L606 | `createFilterElement` 构建筛选项 | `escapeHtml()` |
| L721-723 | `updateActiveFilters` 构建已选标签 | `escapeHtml()` |
| L375-378 | `TagsInput.render` 构建标签元素 | `escapeHtml()` |
| L1483-1488 | 删除确认覆盖层 | 硬编码 HTML |

虽然功能上安全（均有转义或硬编码），但违反项目自身规范。

**建议**: 改用 `document.createElement` + `textContent` 构建 DOM。

### H2. CDN 依赖缺少 Subresource Integrity (SRI)

`index.html` 中三个 CDN 脚本均无 `integrity` 属性：

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
```

CDN 被入侵时会直接注入恶意代码。应锁定版本号并添加 `integrity` + `crossorigin="anonymous"`。

### H3. parseFrontMatter 重复解析（性能瓶颈）

每次筛选/搜索时，同一个 item 的 front matter 被解析多次：

- `getFilteredItems` → 每个 item 调用 3 次（`matchesTagFilters` / `matchesTypeFilter` / `matchesSearchQuery`）
- `extractAllTags` + `extractAllTypes` → 各遍历全部 items 再解析一次

笔记数量增长后会成为性能瓶颈。

**建议**: 在 `loadItems` 和写入时缓存解析结果到 item 对象：

```js
item._parsed = parseFrontMatter(item.content);
```

后续所有读取直接使用 `item._parsed.data` / `item._parsed.content`。

### H4. disabled 正则替换可能误伤正文内容

```js
// L1598
const sanitizedHtml = sanitizeRenderedHtml(parsedHtml).replace(/\sdisabled(?:="")?/g, '');
```

该正则在 DOMPurify 之前对整个 HTML 字符串做替换。如果笔记正文中包含 "disabled" 一词（如 `the button is disabled`），前面恰好有空格就会被误删。

**建议**: 改为在 `enhanceTaskCheckboxes` 中通过 DOM API 移除 disabled 属性，而非字符串正则。

### H5. 注释语言不符合 AGENTS.md 规范

AGENTS.md 规定 "Section headers in Chinese, inline comments in English"，但大量行内注释使用中文：

```js
// L312: // 失焦时如果有内容，尝试添加为标签
// L1219: // 1. 获取/创建 .trash 文件夹
// L1371: // 使用链接标题作为文件名
// L265: // 绑定事件
// L500: // 转换为数组并按字母顺序排序
```

**建议**: 将所有行内注释统一为英文，仅保留 `// ===== 中文段落标题 =====` 格式的 section header 使用中文。

### H6. 死代码: generateId()

```js
// L2575-2577
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
```

该函数已被 `generateTimestampTitle()` 替代，全文无任何调用。应删除。

---

## Low Priority

### L1. 单文件 2722 行，职责过多

app.js 涵盖 IndexedDB 封装、文件系统操作、UI 渲染、编辑器管理、筛选搜索、卡片交互等全部逻辑。即使不引入构建工具，也可拆分为多个 `<script>` 文件按功能模块加载（如 `db.js`、`fs.js`、`ui.js`、`filters.js`）。

### L2. 全局可变状态过多

模块顶层约 15 个 `let` 变量分散管理状态：

```
dirHandle, items, currentView, searchQuery, selectedTags, selectedType,
currentEditingItem, noteEditorView, noteEditorLoader, popupHideTimer,
xWidgetsLoadPromise, editTagsInput, linkEditTagsInput, eventsBound, pendingUrls
```

**建议**: 收拢到一个 `state` 对象中，便于调试和追踪数据流。

### L3. filterAndRenderItems 全量重建 DOM

```js
// L807
elements.cardsGrid.innerHTML = '';
filteredItems.forEach(item => renderOneItem(item, false));
```

每次搜索输入都销毁并重建所有卡片 DOM。笔记量大时体验会下降。

**建议**: 对搜索输入加 debounce（150-200ms），或改用 DOM diff 策略只更新变化的卡片。

### L4. createMarkdownWithFrontMatter 的 falsy 值过滤过于宽泛

```js
// L2221
if (value) yaml += `${key}: ${value}\n`;
```

`if (value)` 会跳过 `0`、`false`、空字符串。当前场景下空字符串被跳过是合理的，但如果未来新增数值型字段会出问题。

**建议**: 改为显式检查：

```js
if (value !== undefined && value !== null && value !== '') {
```

### L5. 空 else-if 分支

```js
// L2453
else if (finalImage) { } // keep logo if no screenshot
```

空代码块依赖注释说明意图，容易被误认为遗漏。

**建议**: 改为纯注释或调整条件逻辑：

```js
// If no screenshot available, keep the existing finalImage (logo)
```

### L6. void popup.offsetHeight 缺少意图说明

```js
// L221
void popup.offsetHeight;
```

这是强制浏览器 reflow 以重播 CSS 动画的常见技巧，但对不熟悉的开发者来说不直观。上方已有注释 "Force reflow to replay animation"，但可以更明确。

### L7. markedRenderer.checkbox 参数兼容处理缺少说明

```js
// L897-899
markedRenderer.checkbox = function checkboxRenderer(arg) {
  const checked = typeof arg === 'boolean' ? arg : Boolean(arg && arg.checked);
  return `<input type="checkbox"${checked ? ' checked' : ''}>`;
};
```

这段代码兼容了 marked 不同版本的 API 变化（旧版传 boolean，新版传 object），但没有注释说明为什么需要这样处理。

---

## Summary

| 优先级 | 数量 | 核心关注点 |
|--------|------|-----------|
| High | 6 | 安全规范一致性、性能瓶颈、正则误伤、死代码 |
| Low | 7 | 架构拆分、状态管理、DOM 性能、代码清晰度 |
