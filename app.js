/**
 * Keep 风格收藏应用 - 本地文件系统版
 * 功能：基于 File System Access API 直接读写本地 Markdown 文件
 */

// ===== 常量配置 =====
const API_URL = 'https://api.microlink.io';
const DB_NAME = 'keep-db';
const STORE_NAME = 'handles';

// ===== IndexedDB 简易封装 =====
const db = {
  db: null,
  async open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async set(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};

// ===== DOM 元素 =====
const elements = {
  // 布局容器
  folderPrompt: document.getElementById('folderPrompt'),
  mainContent: document.getElementById('mainContent'),
  promptTitle: document.querySelector('#folderPrompt h2'),
  promptDesc: document.querySelector('#folderPrompt p'),
  openFolderBtn: document.getElementById('openFolderBtn'),

  // Header
  folderName: document.getElementById('folderName'),
  changeFolderBtn: document.getElementById('changeFolderBtn'),

  // 输入框
  addBox: document.getElementById('addBox'),
  addBoxCollapsed: document.getElementById('addBoxCollapsed'),
  noteForm: document.getElementById('noteForm'),

  // 笔记输入
  noteTitleInput: document.getElementById('noteTitleInput'),
  noteContentInput: document.getElementById('noteContentInput'),
  noteTagsContainer: document.getElementById('noteTagsContainer'),
  closeNoteForm: document.getElementById('closeNoteForm'),
  saveNoteBtn: document.getElementById('saveNoteBtn'),
  titleError: document.getElementById('titleError'),

  // 卡片
  cardsGrid: document.getElementById('cardsGrid'),
  emptyState: document.getElementById('emptyState'),

  // 模板
  linkCardTemplate: document.getElementById('linkCardTemplate'),
  linkLoadingTemplate: document.getElementById('linkLoadingTemplate'),
  noteCardTemplate: document.getElementById('noteCardTemplate'),
};

// ===== 编辑弹窗 DOM =====
const editModal = {
  modal: document.getElementById('editModal'),
  textarea: document.getElementById('editContentTextarea'),
  tagsContainer: document.getElementById('editTagsContainer'),
  filename: document.querySelector('.edit-modal-filename'),
  charCount: document.querySelector('.char-count'),
  closeBtn: document.querySelector('.edit-modal-close'),
  saveBtn: document.querySelector('.btn-save-edit'),
  backdrop: document.querySelector('.edit-modal-backdrop')
};

// ===== 链接编辑弹窗 DOM =====
const linkEditModal = {
  modal: document.getElementById('linkEditModal'),
  form: document.getElementById('linkEditForm'),
  tagsContainer: document.getElementById('linkEditTagsContainer'),
  filename: document.querySelector('#linkEditModal .edit-modal-filename'),
  closeBtn: document.querySelector('.link-edit-close'),
  saveBtn: document.querySelector('.btn-save-link-edit'),
  backdrop: document.querySelector('#linkEditModal .edit-modal-backdrop')
};

// ===== 状态管理 =====
let dirHandle = null;
let items = []; // { id, content, createdAt, handle }
const pendingUrls = new Set();

// 编辑相关状态
let currentEditingItem = null;

// TagsInput 组件实例
let noteTagsInput = null;
let editTagsInput = null;
let linkEditTagsInput = null;

// ===== TagsInput 组件 =====
class TagsInput {
  constructor(container, options = {}) {
    this.tags = [];
    this.container = container;
    this.placeholder = options.placeholder || '添加标签（按回车）';
    this.maxTags = options.maxTags || Infinity;
    this.onChange = options.onChange || (() => {});

    this.init();
  }

  init() {
    this.container.classList.add('tags-input-container');

    // 创建输入框
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'tags-input-field';
    this.input.placeholder = this.placeholder;
    this.container.appendChild(this.input);

    // 绑定事件
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.input.addEventListener('blur', () => this.handleBlur());
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addTag(this.input.value.trim());
    } else if (e.key === 'Backspace' && this.input.value === '' && this.tags.length > 0) {
      this.removeTag(this.tags.length - 1);
    } else if (e.key === ',' && this.input.value.trim()) {
      e.preventDefault();
      this.addTag(this.input.value.trim());
    }
  }

  handleBlur() {
    // 失焦时如果有内容，尝试添加为标签
    const value = this.input.value.trim();
    if (value) {
      this.addTag(value);
    }
  }

  addTag(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.tags.includes(trimmed)) {
      this.input.value = '';
      return;
    }
    if (this.tags.length >= this.maxTags) {
      alert('最多添加 ' + this.maxTags + ' 个标签');
      return;
    }

    this.tags.push(trimmed);
    this.render();
    this.input.value = '';
    this.onChange(this.tags);
  }

  removeTag(index) {
    this.tags.splice(index, 1);
    this.render();
    this.onChange(this.tags);
  }

  getTags() {
    return [...this.tags];
  }

  setTags(tags) {
    this.tags = Array.isArray(tags) ? [...tags] : [];
    this.render();
    this.onChange(this.tags);
  }

  clear() {
    this.tags = [];
    this.render();
    this.onChange(this.tags);
  }

  render() {
    // 移除旧的标签元素（保留输入框）
    const oldTags = this.container.querySelectorAll('.tag');
    oldTags.forEach(t => t.remove());

    // 在输入框之前插入标签
    this.tags.forEach((tag, index) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.innerHTML = `
        ${this.escapeHtml(tag)}
        <span class="tag-remove" data-index="${index}">&times;</span>
      `;

      // 点击删除按钮
      tagEl.querySelector('.tag-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTag(index);
      });

      this.container.insertBefore(tagEl, this.input);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  focus() {
    this.input.focus();
  }
}

// ===== 初始化 =====
async function init() {
  // 初始化 TagsInput 组件
  noteTagsInput = new TagsInput(elements.noteTagsContainer);
  editTagsInput = new TagsInput(editModal.tagsContainer);
  linkEditTagsInput = new TagsInput(linkEditModal.tagsContainer);

  bindEvents();
  bindEditModalEvents();
  bindLinkEditModalEvents();

  // 检查是否有缓存的句柄
  try {
    const handle = await db.get('dirHandle');
    if (handle) {
      dirHandle = handle;
      // 更新 UI 为“恢复模式”
      elements.promptTitle.textContent = `继续访问 "${handle.name}"?`;
      elements.promptDesc.innerHTML = '为了安全，浏览器需要你再次确认访问权限。';
      elements.openFolderBtn.textContent = '恢复访问';
    }
  } catch (e) {
    console.warn('DB error:', e);
  }
}

let eventsBound = false;

// ===== 事件绑定 =====
function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  // 文件夹操作
  elements.openFolderBtn.addEventListener('click', handleOpenFolder);
  elements.changeFolderBtn.addEventListener('click', handleChangeFolder);

  // 点击收起的输入框展开笔记表单
  elements.addBoxCollapsed.addEventListener('click', expandNoteForm);

  // 关闭表单
  elements.closeNoteForm.addEventListener('click', collapseForm);

  // 标题输入验证
  elements.noteTitleInput.addEventListener('input', handleTitleInput);

  // 提交表单
  elements.noteForm.addEventListener('submit', handleNoteSubmit);

  // 点击外部关闭表单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-box') && !elements.addBoxCollapsed.classList.contains('hidden')) {
      return;
    }
    if (!e.target.closest('.add-box')) {
      collapseForm();
    }
  });

  // 卡片操作
  elements.cardsGrid.addEventListener('click', handleCardClick);
}

// ===== 文件系统操作 =====
async function handleOpenFolder() {
  try {
    // 如果已有 handle，尝试 verifyPermission
    if (dirHandle) {
      const permission = await verifyPermission(dirHandle, true);
      if (permission) {
        await finishSetupFolder();
        return;
      }
      // 如果 verify 失败（用户拒绝），则重新通过 picker 选择
    }

    // 打开选择器
    const handle = await window.showDirectoryPicker();
    dirHandle = handle;
    await db.set('dirHandle', handle);

    await finishSetupFolder();

  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Failed to open folder:', e);
      alert('打开文件夹失败，请重试');
    }
  }
}

async function handleChangeFolder() {
  // 重置状态
  dirHandle = null;
  items = [];
  elements.cardsGrid.innerHTML = '';

  // 触发打开流程
  const handle = await window.showDirectoryPicker();
  dirHandle = handle;
  await db.set('dirHandle', handle);

  await finishSetupFolder();
}

async function finishSetupFolder() {
  elements.folderName.textContent = dirHandle.name;
  elements.folderPrompt.classList.add('hidden');
  elements.mainContent.classList.remove('hidden');

  await loadItems();
  updateEmptyState();
}

async function verifyPermission(fileHandle, readWrite) {
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }

  // Check if permission was already granted
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }

  // Request permission
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }

  return false;
}

// ===== 数据加载 (R) =====
async function loadItems() {
  if (!dirHandle) return;

  items = [];
  elements.cardsGrid.innerHTML = ''; // Clear current

  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        const file = await entry.getFile();
        const text = await file.text();
        const stat = file.lastModified;

        items.push({
          id: entry.name.replace('.md', ''), // Use filename as ID
          content: text,
          createdAt: stat,
          fileName: entry.name,
          handle: entry
        });
      }
    }

    // Sort by created/modified time (desc)
    items.sort((a, b) => b.createdAt - a.createdAt);
    renderItems();

  } catch (e) {
    console.error('Failed to load items:', e);
    alert('读取文件失败');
  }
}

// ===== 数据写入 (C/U) =====
async function saveFile(filename, content) {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });

    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    return fileHandle;
  } catch (e) {
    console.error('Save file failed:', e);
    throw e;
  }
}

async function deleteFile(filename) {
  try {
    // 1. 获取/创建 .trash 文件夹
    const trashHandle = await dirHandle.getDirectoryHandle('.trash', { create: true });

    // 2. 获取源文件句柄
    const fileHandle = await dirHandle.getFileHandle(filename);

    // 3. 尝试移动 (支持 Chrome 109+ 等现代浏览器)
    if (fileHandle.move) {
      await fileHandle.move(trashHandle);
    } else {
      // 兼容处理：复制 -> 删除
      const file = await fileHandle.getFile();
      const content = await file.text();

      // 在 trash 中新建
      const newFileHandle = await trashHandle.getFileHandle(filename, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // 删除原文件
      await dirHandle.removeEntry(filename);
    }
  } catch (e) {
    console.error('Move to trash failed:', e);
    throw e;
  }
}

// ===== 业务逻辑：添加笔记/链接 =====
async function handleNoteSubmit(e) {
  e.preventDefault();

  const title = elements.noteTitleInput.value.trim();
  const content = elements.noteContentInput.value.trim();
  const tags = noteTagsInput ? noteTagsInput.getTags() : [];

  if (!content) {
    collapseForm();
    return;
  }

  // 单行链接检查
  if (isValidUrl(content)) {
    collapseForm(); // 提前关闭表单
    await addLinkItem(content, tags);
  } else {
    // 检查标题是否已存在
    if (title && isTitleExists(title)) {
      showTitleError('该标题已存在，请使用其他标题');
      elements.noteTitleInput.focus();
      return;
    }

    // 普通笔记
    await addItem(title, content, tags);

    // 清空
    clearTitleError();
    elements.noteTitleInput.value = '';
    elements.noteContentInput.value = '';
    noteTagsInput.clear();
    collapseForm();
  }
}

async function addItem(title, content, tags = []) {
  // 如果标题为空，使用时间戳
  const finalTitle = title || generateTimestampTitle();
  const filename = `${finalTitle}.md`;

  // 如果有 tags，使用 front matter
  let finalContent = content;
  if (tags.length > 0) {
    finalContent = createMarkdownWithFrontMatter({ tags: tags.join(',') }, content);
  }

  try {
    // 写入文件系统
    await saveFile(filename, finalContent);

    // 更新内存状态 - 使用文件名（不含扩展名）作为 id
    const newItem = {
      id: finalTitle,
      content: finalContent,
      createdAt: Date.now(),
      fileName: filename
    };

    items.unshift(newItem);

    // 渲染
    renderOneItem(newItem, true);
    updateEmptyState();

  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

async function addLinkItem(url, tags = []) {
  if (items.some(item => {
    const { data } = parseFrontMatter(item.content);
    return data.type === 'link' && data.url === url;
  })) {
    alert('该链接已存在');
    return;
  }

  if (pendingUrls.has(url)) return;
  pendingUrls.add(url);

  // Loading UI
  const loadingCard = createLoadingCard();
  elements.cardsGrid.prepend(loadingCard);
  updateEmptyState();

  try {
    const metadata = await fetchLinkMetadata(url);

    // 使用链接标题作为文件名（清理不适合文件名的字符）
    const rawTitle = metadata.title || extractDomain(url);
    const sanitizedTitle = sanitizeFilename(rawTitle);

    // 检查标题是否已存在
    if (isTitleExists(sanitizedTitle)) {
      loadingCard.remove();
      alert(`标题 "${rawTitle}" 已存在，该链接可能是重复的`);
      updateEmptyState();
      return;
    }

    const filename = `${sanitizedTitle}.md`;

    const frontMatterData = {
      type: 'link',
      title: metadata.title || extractDomain(url),
      url: url,
      description: (metadata.description || '').replace(/\n/g, ' '),
      image: metadata.image || ''
    };

    // 如果有 tags，添加到 front matter
    if (tags.length > 0) {
      frontMatterData.tags = tags.join(',');
    }

    const markdownContent = createMarkdownWithFrontMatter(frontMatterData);

    // Save to FS
    await saveFile(filename, markdownContent);

    // Update Memory - 使用文件名（不含扩展名）作为 id
    const newItem = {
      id: filename.replace('.md', ''),
      content: markdownContent,
      createdAt: Date.now(),
      fileName: filename
    };
    items.unshift(newItem);

    // Replace Card
    const realCard = createLinkCard({ ...frontMatterData, id: newItem.id });
    loadingCard.replaceWith(realCard);

  } catch (e) {
    console.error('Add link failed:', e);
    alert('添加链接失败');
    loadingCard.remove();
    updateEmptyState();
  } finally {
    pendingUrls.delete(url);
  }
}

// ===== 删除逻辑 =====
async function handleCardClick(e) {
  // 1. 处理删除按钮点击
  const deleteBtn = e.target.closest('.delete-button');
  if (deleteBtn) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    deleteBtn.blur();

    const card = deleteBtn.closest('.card');

    // 防止重复打开覆盖层
    if (card.querySelector('.card-overlay')) return;

    const id = card.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    // 创建确认覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    overlay.innerHTML = `
      <p>移入回收站？</p>
      <div class="overlay-actions">
        <button class="overlay-btn btn-cancel">取消</button>
        <button class="overlay-btn btn-confirm">确定</button>
      </div>
    `;

    // 绑定内部事件
    const btnCancel = overlay.querySelector('.btn-cancel');
    const btnConfirm = overlay.querySelector('.btn-confirm');

    // 阻止点击冒泡，防止触发卡片其他点击事件
    overlay.addEventListener('click', (ev) => ev.stopPropagation());

    btnCancel.addEventListener('click', (ev) => {
      ev.stopPropagation();
      overlay.remove();
    });

    btnConfirm.addEventListener('click', async (ev) => {
      ev.stopPropagation();

      // Loading 状态
      btnConfirm.textContent = '...';
      btnConfirm.style.opacity = '0.7';

      try {
        await deleteFile(item.fileName || `${item.id}.md`);

        // UI 移除动画
        items = items.filter(i => i.id !== id);
        card.style.transition = 'all 0.2s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';

        setTimeout(() => {
          if (card.parentNode) card.remove();
          updateEmptyState();
        }, 200);

      } catch (err) {
        alert('删除失败: ' + err.message);
        overlay.remove();
      }
    });

    card.appendChild(overlay);
    return;
  }

  // 2. 处理笔记卡片编辑点击
  const card = e.target.closest('.card');
  if (!card) return;

  const id = card.dataset.id;
  const item = items.find(i => i.id === id);
  if (!item) return;

  // 打开编辑弹窗（链接或笔记）
  e.preventDefault();
  e.stopPropagation();
  openEditModal(item);
}

// ===== 编辑功能 =====
// 打开编辑弹窗
function openEditModal(item) {
  currentEditingItem = item;

  // 解析现有内容
  const { data, content } = parseFrontMatter(item.content);

  if (data.type === 'link') {
    // 打开链接编辑弹窗
    openLinkEditModal(item, data);
  } else {
    // 打开笔记编辑弹窗
    openNoteEditModal(item, data, content);
  }
}

// 打开笔记编辑弹窗
function openNoteEditModal(item, data, content) {
  // 填充内容（不包含 front matter）
  editModal.textarea.value = content;
  editModal.filename.textContent = item.fileName;
  updateCharCount(content);

  // 填充 tags
  const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
  editTagsInput.setTags(tags);

  // 重置保存按钮状态
  editModal.saveBtn.disabled = false;
  editModal.saveBtn.textContent = '保存';

  editModal.modal.classList.remove('hidden');
  editModal.textarea.focus();
}

// 打开链接编辑弹窗
function openLinkEditModal(item, data) {
  // 填充表单
  linkEditModal.form.title.value = data.title || '';
  linkEditModal.form.url.value = data.url || '';
  linkEditModal.form.description.value = data.description || '';
  linkEditModal.form.image.value = data.image || '';
  linkEditModal.filename.textContent = item.fileName;

  // 填充 tags
  const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
  linkEditTagsInput.setTags(tags);

  linkEditModal.modal.classList.remove('hidden');
}

// 关闭笔记编辑弹窗（自动保存）
async function closeEditModal() {
  if (!currentEditingItem) {
    editModal.modal.classList.add('hidden');
    return;
  }

  // 自动保存
  const saved = await saveEditedNote();
  if (saved) {
    editModal.modal.classList.add('hidden');
  }
}

// 保存编辑
async function saveEditedNote() {
  if (!currentEditingItem) return false;

  const newContent = editModal.textarea.value.trim();
  if (!newContent) {
    alert('内容不能为空');
    return false;
  }

  // 获取 tags
  const tags = editTagsInput.getTags();

  editModal.saveBtn.disabled = true;
  editModal.saveBtn.textContent = '保存中...';

  try {
    // 解析原有 front matter（保留其他属性）
    const { data: originalData } = parseFrontMatter(currentEditingItem.content);

    // 构建新的 front matter 数据
    const frontMatterData = { ...originalData };
    if (tags.length > 0) {
      frontMatterData.tags = tags.join(',');
    } else {
      delete frontMatterData.tags;
    }

    // 生成新内容
    let finalContent = newContent;
    if (Object.keys(frontMatterData).length > 0) {
      finalContent = createMarkdownWithFrontMatter(frontMatterData, newContent);
    }

    // 1. 保存到文件系统
    await saveFile(currentEditingItem.fileName, finalContent);

    // 2. 更新内存
    const index = items.findIndex(i => i.id === currentEditingItem.id);
    if (index !== -1) {
      items[index].content = finalContent;
      items[index].createdAt = Date.now();
    }

    // 3. 更新 UI（局部更新卡片）
    const card = document.querySelector(`.card[data-id="${currentEditingItem.id}"]`);
    if (card) {
      let body = newContent;
      const titleMatch = newContent.match(/^#\s+(.*)\n/);
      if (titleMatch) {
        body = newContent.replace(/^#\s+.*\n/, '').trim();
      }

      const titleEl = card.querySelector('.note-title');
      const contentEl = card.querySelector('.note-content');
      const tagsEl = card.querySelector('.card-tags');

      if (titleEl) titleEl.textContent = currentEditingItem.id;
      if (contentEl) contentEl.innerHTML = marked.parse(body);
      if (tagsEl) renderTags(tagsEl, tags);
    }

    // 重置状态
    currentEditingItem = null;
    editModal.textarea.value = '';
    editTagsInput.clear();

    return true;

  } catch (e) {
    console.error('Save failed:', e);
    alert('保存失败: ' + e.message);
    editModal.saveBtn.disabled = false;
    editModal.saveBtn.textContent = '保存';
    return false;
  }
}

// 输入监听
function handleEditInput() {
  updateCharCount(editModal.textarea.value);
}

// 更新字符计数
function updateCharCount(content) {
  editModal.charCount.textContent = `${content.length} 字符`;
}

// 绑定编辑弹窗事件
function bindEditModalEvents() {
  editModal.closeBtn.addEventListener('click', () => closeEditModal());
  editModal.saveBtn.addEventListener('click', async () => {
    const saved = await saveEditedNote();
    if (saved) {
      editModal.modal.classList.add('hidden');
    }
  });
  editModal.backdrop.addEventListener('click', () => closeEditModal());
  editModal.textarea.addEventListener('input', handleEditInput);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.modal.classList.contains('hidden')) {
      closeEditModal();
    }
  });

  editModal.modal.querySelector('.edit-modal-container')
    .addEventListener('click', (e) => e.stopPropagation());
}

// 绑定链接编辑弹窗事件
function bindLinkEditModalEvents() {
  linkEditModal.closeBtn.addEventListener('click', () => closeLinkEditModal());
  linkEditModal.saveBtn.addEventListener('click', async () => {
    const saved = await saveLinkEdit();
    if (saved) {
      linkEditModal.modal.classList.add('hidden');
    }
  });
  linkEditModal.backdrop.addEventListener('click', () => closeLinkEditModal());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !linkEditModal.modal.classList.contains('hidden')) {
      closeLinkEditModal();
    }
  });

  linkEditModal.modal.querySelector('.edit-modal-container')
    .addEventListener('click', (e) => e.stopPropagation());
}

// 关闭链接编辑弹窗（自动保存）
async function closeLinkEditModal() {
  if (!currentEditingItem) {
    linkEditModal.modal.classList.add('hidden');
    return;
  }

  // 自动保存
  const saved = await saveLinkEdit();
  if (saved) {
    linkEditModal.modal.classList.add('hidden');
  }
}

// 保存链接编辑
async function saveLinkEdit() {
  if (!currentEditingItem) return false;

  // 获取表单数据
  const formData = {
    type: 'link',
    title: linkEditModal.form.title.value.trim(),
    url: linkEditModal.form.url.value.trim(),
    description: linkEditModal.form.description.value.trim(),
    image: linkEditModal.form.image.value.trim(),
  };

  if (!formData.url) {
    alert('链接不能为空');
    return false;
  }

  const tags = linkEditTagsInput.getTags();
  if (tags.length > 0) {
    formData.tags = tags.join(',');
  }

  // 生成 front matter 内容
  const content = createMarkdownWithFrontMatter(formData);

  linkEditModal.saveBtn.disabled = true;
  linkEditModal.saveBtn.textContent = '保存中...';

  try {
    // 1. 保存到文件系统
    await saveFile(currentEditingItem.fileName, content);

    // 2. 更新内存
    const index = items.findIndex(i => i.id === currentEditingItem.id);
    if (index !== -1) {
      items[index].content = content;
      items[index].createdAt = Date.now();
    }

    // 3. 更新 UI（局部更新卡片）
    const card = document.querySelector(`.card[data-id="${currentEditingItem.id}"]`);
    if (card) {
      const titleEl = card.querySelector('.card-title');
      const descEl = card.querySelector('.card-description');
      const urlEl = card.querySelector('.url-text');
      const imgEl = card.querySelector('.card-image img');
      const openLinkBtn = card.querySelector('.open-link-button');
      const tagsEl = card.querySelector('.card-tags');

      if (titleEl) titleEl.textContent = formData.title;
      if (descEl) descEl.textContent = formData.description;
      if (urlEl) urlEl.textContent = extractDomain(formData.url);
      if (openLinkBtn) openLinkBtn.href = formData.url;
      if (imgEl) {
        if (formData.image) {
          imgEl.src = formData.image;
          imgEl.classList.remove('error');
        } else {
          imgEl.classList.add('error');
        }
      }
      if (tagsEl) renderTags(tagsEl, tags);
    }

    // 重置状态
    currentEditingItem = null;
    linkEditModal.form.reset();
    linkEditTagsInput.clear();

    // 重置按钮状态
    linkEditModal.saveBtn.disabled = false;
    linkEditModal.saveBtn.textContent = '保存';

    return true;

  } catch (e) {
    console.error('Save failed:', e);
    alert('保存失败: ' + e.message);
    linkEditModal.saveBtn.disabled = false;
    linkEditModal.saveBtn.textContent = '保存';
    return false;
  }
}

// ===== 渲染 & 工具 (复用原有逻辑) =====
function renderItems() {
  elements.cardsGrid.innerHTML = '';
  items.forEach(item => renderOneItem(item, false));
  updateEmptyState();
}

function renderOneItem(item, prepend) {
  const { data, content } = parseFrontMatter(item.content);
  let card;

  if (data.type === 'link') {
    card = createLinkCard({ ...data, id: item.id });
  } else {
    // 使用 id（文件名）作为标题，并从内容中移除 heading
    let title = item.id; // 文件名就是标题
    let body = content;
    const titleMatch = content.match(/^#\s+(.*)\n/);
    if (titleMatch) {
      // 如果内容中有 heading，从正文中移除
      body = content.replace(/^#\s+.*\n/, '').trim();
    }

    // 解析 tags
    const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];

    card = createNoteCard({
      id: item.id,
      title: title,
      content: body,
      tags: tags
    });
  }

  if (prepend) {
    elements.cardsGrid.prepend(card);
  } else {
    elements.cardsGrid.appendChild(card);
  }
}

// ... 保持 parseFrontMatter, createMarkdownWithFrontMatter, 
// createLinkCard, createNoteCard, createLoadingCard, 
// form control functions 一致 ...

// ===== 辅助函数实现 =====
function parseFrontMatter(text) {
  const pattern = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = text.match(pattern);
  if (!match) return { data: {}, content: text };

  const yaml = match[1];
  const content = match[2].trim();
  const data = {};
  yaml.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      data[key.trim()] = valueParts.join(':').trim();
    }
  });
  return { data, content };
}

function createMarkdownWithFrontMatter(data, content = '') {
  let yaml = '---\n';
  Object.entries(data).forEach(([key, value]) => {
    if (value) yaml += `${key}: ${value}\n`;
  });
  yaml += '---\n';
  return yaml + content;
}

function expandNoteForm() {
  elements.addBoxCollapsed.classList.add('hidden');
  elements.noteForm.classList.remove('hidden');
  clearTitleError();
  elements.noteContentInput.focus();
}

function collapseForm() {
  elements.noteForm.classList.add('hidden');
  elements.addBoxCollapsed.classList.remove('hidden');
}

function createLinkCard(data) {
  const template = elements.linkCardTemplate.content.cloneNode(true);
  const card = template.querySelector('.card');
  card.dataset.id = data.id;

  // 设置打开链接按钮的 href
  const openLinkBtn = card.querySelector('.open-link-button');
  if (openLinkBtn) {
    openLinkBtn.href = data.url;
  }

  const img = card.querySelector('.card-image img');
  if (data.image) {
    img.src = data.image;
    img.alt = data.title;
    img.onerror = () => img.classList.add('error');
  } else {
    img.classList.add('error');
  }

  card.querySelector('.card-title').textContent = data.title;
  card.querySelector('.card-description').textContent = data.description;
  card.querySelector('.url-text').textContent = extractDomain(data.url);

  // 渲染 tags
  const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
  const tagsEl = card.querySelector('.card-tags');
  if (tagsEl) {
    renderTags(tagsEl, tags);
  }

  return card;
}

function createNoteCard(data) {
  const template = elements.noteCardTemplate.content.cloneNode(true);
  const card = template.querySelector('.card');
  card.dataset.id = data.id;

  const titleEl = card.querySelector('.note-title');
  if (data.title) titleEl.textContent = data.title;

  const contentEl = card.querySelector('.note-content');
  if (data.content) contentEl.innerHTML = marked.parse(data.content);

  // 渲染 tags
  const tags = data.tags || [];
  const tagsEl = card.querySelector('.card-tags');
  if (tagsEl) {
    renderTags(tagsEl, tags);
  }

  return card;
}

// 渲染 tags 到容器
function renderTags(container, tags) {
  container.innerHTML = '';
  if (!tags || tags.length === 0) return;

  tags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tag;
    container.appendChild(tagEl);
  });
}

function createLoadingCard() {
  const template = elements.linkLoadingTemplate.content.cloneNode(true);
  return template.querySelector('.card');
}

function updateEmptyState() {
  const hasItems = elements.cardsGrid.children.length > 0;
  elements.emptyState.classList.toggle('hidden', hasItems);
}

// API Utils
async function fetchLinkMetadata(url) {
  const apiUrl = `${API_URL}?url=${encodeURIComponent(url)}&screenshot=true`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error('API request failed');
  const data = await response.json();
  if (data.status !== 'success') throw new Error('Failed to fetch');

  const imgData = data.data.image || {};
  const screenData = data.data.screenshot || {};
  const logoData = data.data.logo || {};

  // Choose best image
  let finalImage = imgData.url;

  // heuristic check for logo vs main image
  const w = imgData.width || 0;
  const h = imgData.height || 0;
  const isLogo = w < 400 || h < 200 || (w === h && w < 500);

  if (!finalImage || isLogo) {
    if (screenData.url) finalImage = screenData.url;
    else if (finalImage) { } // keep logo if no screenshot
    else if (logoData.url) finalImage = logoData.url;
  }

  return {
    title: data.data.title,
    description: data.data.description,
    image: finalImage
  };
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 清理文件名中的非法字符
function sanitizeFilename(name) {
  // 移除或替换不适合文件系统的字符
  // Windows 不允许: < > : " / \ | ? *
  // 同时移除控制字符和前后空格
  let cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // 移除非法字符
    .replace(/\s+/g, ' ')  // 多个空格合并为一个
    .trim();               // 移除前后空格

  // 如果清理后为空，使用时间戳
  if (!cleaned) {
    cleaned = generateTimestampTitle();
  }

  // 限制长度（大多数文件系统限制255字符）
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200);
  }

  return cleaned;
}

// 生成时间戳标题（当标题为空时使用）
function generateTimestampTitle() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// ===== 标题验证相关 =====

// 检查标题是否已存在
function isTitleExists(title) {
  const sanitizedTitle = sanitizeFilename(title);
  return items.some(item => {
    // 对于笔记，id 就是文件名（不含扩展名）
    // 对于链接，id 也是文件名（不含扩展名）
    return item.id === sanitizedTitle;
  });
}

// 标题输入处理
function handleTitleInput() {
  const title = elements.noteTitleInput.value.trim();

  if (!title) {
    clearTitleError();
    return;
  }

  if (isTitleExists(title)) {
    showTitleError('该标题已存在，请使用其他标题');
  } else {
    clearTitleError();
  }
}

// 显示标题错误
function showTitleError(message) {
  elements.titleError.textContent = message;
  elements.titleError.classList.add('visible');
  elements.noteTitleInput.classList.add('error');
  elements.saveNoteBtn.disabled = true;
}

// 清除标题错误
function clearTitleError() {
  elements.titleError.textContent = '';
  elements.titleError.classList.remove('visible');
  elements.noteTitleInput.classList.remove('error');
  elements.saveNoteBtn.disabled = false;
}

document.addEventListener('DOMContentLoaded', init);
