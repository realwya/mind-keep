// ===== 侧边栏筛选功能 =====
const TYPE_FILTER_ORDER = ['note', 'link', 'image'];

/**
 * 从所有项目中提取唯一标签并计数
 * 按字母顺序排序
 * @returns {Array} 标签数组 [{ name, count }]
 */
function extractAllTags() {
  const tagMap = new Map();

  items.forEach(item => {
    const { data } = getItemParsed(item);
    if (data.tags) {
      const tags = data.tags.split(',').map(t => t.trim()).filter(t => t);
      tags.forEach(tag => {
        const count = tagMap.get(tag) || 0;
        tagMap.set(tag, count + 1);
      });
    }
  });

  // Convert to array and sort alphabetically
  const sortedTags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  return sortedTags;
}

/**
 * 从所有项目中提取类型并计数
 * 按固定顺序输出: note -> link -> image
 * @returns {Array} 类型数组 [{ name, count }]
 */
function extractAllTypes() {
  const typeMap = new Map();

  items.forEach(item => {
    const { data } = getItemParsed(item);
    const type = (data.type || '').trim().toLowerCase();
    if (!TYPE_FILTER_ORDER.includes(type)) return;
    const count = typeMap.get(type) || 0;
    typeMap.set(type, count + 1);
  });

  return TYPE_FILTER_ORDER
    .filter(type => typeMap.has(type))
    .map(type => ({ name: type, count: typeMap.get(type) || 0 }));
}

/**
 * 更新侧边栏筛选列表
 */
function updateSidebarTags() {
  allTags = extractAllTags();
  allTypes = extractAllTypes();
  renderSidebarFilters();
  updateTypeCapsules();
  refreshTagSuggestions();
}

function refreshTagSuggestions() {
  if (editTagsInput) editTagsInput.refreshSuggestions();
  if (linkEditTagsInput) linkEditTagsInput.refreshSuggestions();
}

function updateViewControls() {
  elements.viewNotesBtn.classList.toggle('active', currentView === VIEW_ACTIVE);
  elements.viewArchiveBtn.classList.toggle('active', currentView === VIEW_ARCHIVE);
  elements.viewTrashBtn.classList.toggle('active', currentView === VIEW_TRASH);
  elements.addSection.classList.toggle('hidden', currentView !== VIEW_ACTIVE);
  updateTrashActions();
}

function refreshFeatherIcons() {
  if (window.feather && typeof window.feather.replace === 'function') {
    window.feather.replace();
  }
}

/**
 * 渲染侧边栏中的筛选（类型 + 标签）
 */
function renderSidebarFilters() {
  elements.tagsList.innerHTML = '';

  // Show/hide empty state
  if (allTags.length === 0 && allTypes.length === 0) {
    elements.noTagsState.classList.remove('hidden');
    elements.tagsSection.classList.add('hidden');
    updateActiveFilters();
    refreshFeatherIcons();
    return;
  }

  elements.noTagsState.classList.add('hidden');
  elements.tagsSection.classList.toggle('hidden', allTags.length === 0);

  // Render tag filters
  allTags.forEach(tag => {
    const tagEl = createTagFilterElement(tag);
    elements.tagsList.appendChild(tagEl);
  });

  // Update active filter display
  updateActiveFilters();
  refreshFeatherIcons();
}

/**
 * 创建筛选元素
 * @param {Object} filter - { name, count }
 * @param {boolean} isSelected
 * @param {Function} onClick
 * @returns {HTMLElement}
 */
function createFilterElement(filter, isSelected, onClick) {
  const item = document.createElement('div');
  item.className = `tag-filter-item${isSelected ? ' selected' : ''}`;
  item.dataset.filter = filter.name;

  const checkbox = document.createElement('div');
  checkbox.className = 'tag-filter-checkbox';
  const icon = document.createElement('i');
  icon.dataset.feather = 'check';
  icon.setAttribute('aria-hidden', 'true');
  checkbox.appendChild(icon);

  const nameSpan = document.createElement('span');
  nameSpan.className = 'tag-filter-name';
  nameSpan.textContent = filter.name;

  const countSpan = document.createElement('span');
  countSpan.className = 'tag-filter-count';
  countSpan.textContent = filter.count;

  item.append(checkbox, nameSpan, countSpan);

  item.addEventListener('click', onClick);

  return item;
}

function createTagFilterElement(tag) {
  return createFilterElement(
    tag,
    selectedTags.has(tag.name),
    () => toggleTagFilter(tag.name)
  );
}

/**
 * 切换标签选择状态
 * @param {string} tagName
 */
function toggleTagFilter(tagName) {
  if (selectedTags.has(tagName)) {
    selectedTags.delete(tagName);
  } else {
    selectedTags.add(tagName);
  }

  renderSidebarFilters();
  filterAndRenderItems();
}

/**
 * 切换类型选择状态（单选）
 * @param {string} typeName
 */
function toggleTypeFilter(typeName) {
  selectedType = selectedType === typeName ? null : typeName;
  renderSidebarFilters();
  updateTypeCapsules();
  filterAndRenderItems();
}

/**
 * 清除所有筛选
 */
function clearAllFilters() {
  selectedTags.clear();
  selectedType = null;
  renderSidebarFilters();
  updateTypeCapsules();
  filterAndRenderItems();
}

function handleSearchInput(e) {
  searchQuery = (e.target.value || '').trim().toLowerCase();
  updateSearchClearButton();
  filterAndRenderItems();
}

function handleSearchKeydown(e) {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
  clearSearchQuery();
  elements.searchInput.blur();
}

function clearSearchQuery() {
  elements.searchInput.value = '';
  searchQuery = '';
  updateSearchClearButton();
  filterAndRenderItems();
}

function updateSearchClearButton() {
  const hasQuery = Boolean(elements.searchInput.value.trim());
  elements.clearSearchBtn.classList.toggle('hidden', !hasQuery);
}

/**
 * 更新已选筛选显示
 */
function updateActiveFilters() {
  if (selectedTags.size === 0 && !selectedType) {
    elements.activeFilters.classList.add('hidden');
    return;
  }

  elements.activeFilters.classList.remove('hidden');
  elements.activeFiltersList.innerHTML = '';

  if (selectedType) {
    const typeEl = document.createElement('span');
    typeEl.className = 'tag';
    typeEl.textContent = `type: ${selectedType}`;

    const removeBtn = document.createElement('span');
    removeBtn.className = 'tag-remove';
    removeBtn.dataset.type = selectedType;
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTypeFilter(selectedType);
    });

    typeEl.appendChild(removeBtn);
    elements.activeFiltersList.appendChild(typeEl);
  }

  selectedTags.forEach(tagName => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tagName;

    const removeBtn = document.createElement('span');
    removeBtn.className = 'tag-remove';
    removeBtn.dataset.tag = tagName;
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTagFilter(tagName);
    });

    tagEl.appendChild(removeBtn);
    elements.activeFiltersList.appendChild(tagEl);
  });
}

/**
 * 更新类型胶囊按钮的显示/隐藏和选中状态
 */
function updateTypeCapsules() {
  const capsules = elements.typeCapsules;
  if (!capsules) return;

  const isTrash = currentView === VIEW_TRASH;
  const hasTrashItems = isTrash && items.length > 0;

  // Show container when types exist or trash has items (for empty-trash button)
  const hasVisibleContent = allTypes.length > 0 || hasTrashItems;
  capsules.classList.toggle('hidden', !hasVisibleContent);

  capsules.querySelectorAll('.type-capsule[data-type]').forEach(btn => {
    const type = btn.dataset.type;
    const typeData = allTypes.find(t => t.name === type);
    btn.classList.toggle('active', selectedType === type);
    btn.classList.toggle('hidden', !typeData);
  });
}

/**
 * 初始化类型胶囊按钮点击事件
 */
function initTypeCapsules() {
  const capsules = elements.typeCapsules;
  if (!capsules) return;

  capsules.addEventListener('click', (e) => {
    const btn = e.target.closest('.type-capsule');
    if (!btn) return;
    toggleTypeFilter(btn.dataset.type);
  });
}

/**
 * 根据选中的标签筛选项目（AND 逻辑）
 * @returns {Array} 筛选后的项目
 */
function matchesTagFilters(item) {
  if (selectedTags.size === 0) {
    return true;
  }

  const { data } = getItemParsed(item);
  if (!data.tags) return false;

  const itemTags = data.tags.split(',').map(t => t.trim()).filter(t => t);

  // Check if item contains all selected tags (AND logic)
  return [...selectedTags].every(selectedTag => itemTags.includes(selectedTag));
}

function matchesTypeFilter(item) {
  if (!selectedType) return true;
  const { data } = getItemParsed(item);
  return data.type === selectedType;
}

function buildSearchText(item) {
  const { data, content } = getItemParsed(item);
  const tags = data.tags || '';

  if (isLinkItemType(data.type)) {
    return [item.id, data.title, data.description, data.url, tags]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
  }

  return [item.id, content, tags]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function matchesSearchQuery(item) {
  if (!searchQuery) return true;
  return buildSearchText(item).includes(searchQuery);
}

function getFilteredItems() {
  return items.filter(item => matchesTagFilters(item) && matchesTypeFilter(item) && matchesSearchQuery(item));
}

/**
 * 筛选并渲染项目
 */
function filterAndRenderItems() {
  const filteredItems = getFilteredItems();

  elements.cardsGrid.innerHTML = '';
  filteredItems.forEach(item => renderOneItem(item, false));
  updateEmptyState();
  refreshFeatherIcons();
}

/**
 * 切换侧边栏（移动端）
 */
const SIDEBAR_COLLAPSE_BREAKPOINT = 1100;

function isMobileSidebarLayout() {
  return window.innerWidth <= SIDEBAR_COLLAPSE_BREAKPOINT;
}

function setSidebarActionButton(iconName, label) {
  if (!elements.closeSidebarBtn) return;
  elements.closeSidebarBtn.setAttribute('aria-label', label);
  elements.closeSidebarBtn.setAttribute('title', label);
  elements.closeSidebarBtn.innerHTML = `<i data-feather="${iconName}" aria-hidden="true"></i>`;
  refreshFeatherIcons();
}

function syncSidebarActionButton() {
  if (isMobileSidebarLayout()) {
    setSidebarActionButton('x', 'Close sidebar');
    return;
  }

  const isCollapsed = elements.sidebar.classList.contains('collapsed');
  if (isCollapsed) {
    setSidebarActionButton('chevrons-right', 'Expand sidebar');
  } else {
    setSidebarActionButton('chevrons-left', 'Collapse sidebar');
  }
}

function toggleSidebar() {
  elements.sidebar.classList.toggle('open');

  if (elements.sidebar.classList.contains('open')) {
    showSidebarOverlay();
  } else {
    hideSidebarOverlay();
  }
}

/**
 * 显示遮罩层
 */
function showSidebarOverlay() {
  if (!elements.sidebarOverlay) {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);
    elements.sidebarOverlay = overlay;
  }
  elements.sidebarOverlay.classList.add('visible');
}

/**
 * 隐藏遮罩层
 */
function hideSidebarOverlay() {
  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.classList.remove('visible');
  }
}

/**
 * 关闭侧边栏
 */
function closeSidebar() {
  elements.sidebar.classList.remove('open');
  hideSidebarOverlay();
}

/**
 * 侧边栏操作按钮：桌面端收起/展开，移动端关闭
 */
function toggleSidebarCollapse() {
  if (isMobileSidebarLayout()) {
    closeSidebar();
    syncSidebarActionButton();
    return;
  }

  elements.sidebar.classList.remove('open');
  hideSidebarOverlay();
  elements.sidebar.classList.toggle('collapsed');
  syncSidebarActionButton();
}
