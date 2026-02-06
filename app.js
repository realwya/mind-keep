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
  filename: document.querySelector('.edit-modal-filename'),
  charCount: document.querySelector('.char-count'),
  closeBtn: document.querySelector('.edit-modal-close'),
  saveBtn: document.querySelector('.btn-save-edit'),
  backdrop: document.querySelector('.edit-modal-backdrop')
};

// ===== 状态管理 =====
let dirHandle = null;
let items = []; // { id, content, createdAt, handle }
const pendingUrls = new Set();

// 编辑相关状态
let currentEditingItem = null;

// ===== 初始化 =====
async function init() {
  bindEvents();
  bindEditModalEvents();

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

  if (!content) {
    collapseForm();
    return;
  }

  // 单行链接检查
  if (isValidUrl(content)) {
    collapseForm(); // 提前关闭表单
    await addLinkItem(content);
  } else {
    // 检查标题是否已存在
    if (title && isTitleExists(title)) {
      showTitleError('该标题已存在，请使用其他标题');
      elements.noteTitleInput.focus();
      return;
    }

    // 普通笔记
    await addItem(title, content);

    // 清空
    clearTitleError();
    elements.noteTitleInput.value = '';
    elements.noteContentInput.value = '';
    collapseForm();
  }
}

async function addItem(title, content) {
  // 如果标题为空，使用时间戳
  const finalTitle = title || generateTimestampTitle();
  const filename = `${finalTitle}.md`;

  try {
    // 写入文件系统
    await saveFile(filename, content);

    // 更新内存状态 - 使用文件名（不含扩展名）作为 id
    const newItem = {
      id: finalTitle,
      content: content,
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

async function addLinkItem(url) {
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

  // 判断卡片类型
  const { data } = parseFrontMatter(item.content);

  // 链接卡片不处理编辑（保持默认跳转行为）
  if (data.type === 'link') {
    return;
  }

  // 笔记卡片打开编辑弹窗
  e.preventDefault();
  e.stopPropagation();
  openEditModal(item);
}

// ===== 编辑功能 =====
// 打开编辑弹窗
function openEditModal(item) {
  currentEditingItem = item;

  editModal.textarea.value = item.content;
  editModal.filename.textContent = item.fileName;
  updateCharCount(item.content);

  // 重置保存按钮状态
  editModal.saveBtn.disabled = false;
  editModal.saveBtn.textContent = '保存';

  editModal.modal.classList.remove('hidden');
  editModal.textarea.focus();
}

// 关闭编辑弹窗（自动保存）
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

  editModal.saveBtn.disabled = true;
  editModal.saveBtn.textContent = '保存中...';

  try {
    // 1. 保存到文件系统
    await saveFile(currentEditingItem.fileName, newContent);

    // 2. 更新内存
    const index = items.findIndex(i => i.id === currentEditingItem.id);
    if (index !== -1) {
      items[index].content = newContent;
      items[index].createdAt = Date.now();
    }

    // 3. 更新 UI（局部更新卡片）
    const card = document.querySelector(`.card[data-id="${currentEditingItem.id}"]`);
    if (card) {
      const { content: bodyContent } = parseFrontMatter(newContent);
      let body = bodyContent;
      const titleMatch = bodyContent.match(/^#\s+(.*)\n/);
      if (titleMatch) {
        body = bodyContent.replace(/^#\s+.*\n/, '').trim();
      }

      const titleEl = card.querySelector('.note-title');
      const contentEl = card.querySelector('.note-content');
      if (titleEl) titleEl.textContent = currentEditingItem.id;
      if (contentEl) contentEl.innerHTML = marked.parse(body);
    }

    // 重置状态
    currentEditingItem = null;
    editModal.textarea.value = '';

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

    card = createNoteCard({
      id: item.id,
      title: title,
      content: body
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
  const cardLink = card.querySelector('.card-link');
  cardLink.href = data.url;

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

  return card;
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
