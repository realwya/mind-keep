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

// Return cached parseFrontMatter result for an item, auto-invalidating when content changes.
function getItemParsed(item) {
  if (!item._parsed || item._parsedSource !== item.content) {
    item._parsed = parseFrontMatter(item.content || '');
    item._parsedSource = item.content;
  }
  return item._parsed;
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
  autoResizeNoteContentInput();
  elements.noteContentInput.focus();
}

function collapseForm() {
  elements.noteForm.classList.add('hidden');
  elements.addBoxCollapsed.classList.remove('hidden');
  autoResizeNoteContentInput();
}

function ensureXWidgetsLoaded() {
  if (window.twttr && window.twttr.widgets && typeof window.twttr.widgets.createTweet === 'function') {
    return Promise.resolve(window.twttr);
  }

  if (xWidgetsLoadPromise) return xWidgetsLoadPromise;

  xWidgetsLoadPromise = new Promise((resolve, reject) => {
    const onReady = () => {
      if (!window.twttr || typeof window.twttr.ready !== 'function') {
        reject(new Error('X widgets API unavailable'));
        return;
      }
      window.twttr.ready(() => resolve(window.twttr));
    };

    let script = document.getElementById(X_WIDGETS_SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = X_WIDGETS_SCRIPT_ID;
      script.src = X_WIDGETS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.charset = 'utf-8';
      document.head.appendChild(script);
    }

    if (window.twttr && window.twttr.widgets) {
      onReady();
      return;
    }

    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', () => {
      reject(new Error('Failed to load X widgets.js'));
    }, { once: true });
  }).catch(error => {
    xWidgetsLoadPromise = null;
    throw error;
  });

  return xWidgetsLoadPromise;
}

function renderXPostEmbed(container, xPostId, postUrl) {
  const skeleton = document.createElement('div');
  skeleton.className = 'x-post-skeleton skeleton';
  skeleton.setAttribute('aria-hidden', 'true');
  container.appendChild(skeleton);

  const fallbackLink = document.createElement('a');
  fallbackLink.className = 'x-post-fallback-link';
  fallbackLink.href = postUrl;
  fallbackLink.target = '_blank';
  fallbackLink.rel = 'noopener noreferrer';
  fallbackLink.textContent = 'Open post on X';
  container.appendChild(fallbackLink);

  ensureXWidgetsLoaded()
    .then(twttr => twttr.widgets.createTweet(xPostId, container, {
      dnt: true,
      align: 'center'
    }))
    .then(tweetEl => {
      skeleton.remove();
      if (tweetEl) fallbackLink.remove();
    })
    .catch(error => {
      skeleton.remove();
      console.warn('Failed to render X post embed:', error);
    });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

function extractXPostId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const isXDomain = host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com';
    if (!isXDomain) return null;

    const match = url.pathname.match(/\/status\/(\d+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function extractDirectImageUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.toLowerCase();
    const extMatch = pathname.match(/\.([a-z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : '';
    const format = (url.searchParams.get('format') || '').toLowerCase();
    const imageExtSet = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);

    if (imageExtSet.has(ext) || imageExtSet.has(format)) {
      return url.toString();
    }

    return null;
  } catch {
    return null;
  }
}

function getLinkTypeFromUrl(url) {
  return extractDirectImageUrl(url) ? 'image' : 'link';
}

function isLinkItemType(type) {
  return type === 'link' || type === 'image';
}

function normalizeItemTypeInContent(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const hasFrontMatter = Boolean(match);
  const { data } = parseFrontMatter(text);
  const body = hasFrontMatter ? match[2] : text;

  const nextData = { ...data };
  if (nextData.url) {
    nextData.type = getLinkTypeFromUrl(nextData.url);
  } else {
    nextData.type = 'note';
  }

  if (hasFrontMatter) {
    if (nextData.type === data.type) return text;
    return createMarkdownWithFrontMatter(nextData, body);
  }

  return createMarkdownWithFrontMatter(nextData, body);
}

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function extractReadableTitleFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const segments = url.pathname
      .split('/')
      .map(segment => segment.trim())
      .filter(Boolean)
      .filter(segment => !/^[a-z]{2}(-[a-z]{2})?$/i.test(segment)); // remove locale-like segment: en / en-US

    const candidate = segments.length > 0 ? segments[segments.length - 1] : '';
    if (!candidate) return extractDomain(rawUrl);

    const title = decodeURIComponent(candidate)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return title || extractDomain(rawUrl);
  } catch {
    return extractDomain(rawUrl);
  }
}

function sanitizeRenderedHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;

  const blockedTags = new Set(['script', 'iframe', 'object', 'embed', 'link', 'style', 'meta', 'base']);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];

  while (walker.nextNode()) {
    const el = walker.currentNode;
    const tagName = el.tagName.toLowerCase();
    if (blockedTags.has(tagName)) {
      toRemove.push(el);
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      const lowerValue = value.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === 'href' || name === 'src') && (lowerValue.startsWith('javascript:') || lowerValue.startsWith('vbscript:'))) {
        el.removeAttribute(attr.name);
      }
    }
  }

  toRemove.forEach(node => node.remove());
  return template.innerHTML;
}

// Sanitize illegal characters in filename
function sanitizeFilename(name) {
  // Remove or replace characters invalid for filesystems
  // Windows disallows: < > : " / \ | ? *
  // Also remove control characters and leading/trailing spaces
  let cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove illegal characters
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .trim();               // Trim whitespace

  // Fall back to timestamp if empty after sanitization
  if (!cleaned) {
    cleaned = generateTimestampTitle();
  }

  // Limit length (most filesystems cap at 255 chars)
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200);
  }

  return cleaned;
}

// Generate timestamp title (used when title is empty)
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

function ensureUniqueTitle(baseTitle, excludeId = null) {
  const sanitizedBase = sanitizeFilename(baseTitle || generateTimestampTitle());
  let candidate = sanitizedBase;
  let suffixNumber = 1;

  while (isTitleExists(candidate, excludeId)) {
    const suffix = `-${suffixNumber}`;
    const maxBaseLength = 200 - suffix.length;
    const base = sanitizedBase.length > maxBaseLength
      ? sanitizedBase.slice(0, maxBaseLength).trimEnd()
      : sanitizedBase;
    candidate = `${base}${suffix}`;
    suffixNumber += 1;
  }

  return candidate;
}

function withHttpProtocol(rawUrl) {
  const value = (rawUrl || '').trim();
  if (!value) return '';
  if (isValidUrl(value)) return value;
  const prefixed = `https://${value}`;
  return isValidUrl(prefixed) ? prefixed : '';
}

// API Utils
async function fetchLinkMetadata(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const apiUrl = `${API_URL}?url=${encodeURIComponent(url)}&screenshot=true`;
    const response = await fetch(apiUrl, { signal: controller.signal });
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

    const title = data.data.title || '';
    const description = data.data.description || '';
    const pageText = `${title}\n${description}`;
    const hasBlockedTitle = /error:\s*the request could not be satisfied|403\s*error/i.test(title);
    const matchedCloudFrontSignals = CLOUDFRONT_ERROR_PATTERNS.filter(pattern => pattern.test(pageText)).length;
    const isBlockedPage = hasBlockedTitle || matchedCloudFrontSignals >= 2;

    // Some sites return CDN error pages as metadata/screenshot. Do not persist them as cover/title.
    if (isBlockedPage) {
      finalImage = '';
    }

    return {
      title: isBlockedPage ? '' : title,
      description: isBlockedPage ? '' : description,
      image: finalImage
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function updateTrashActions() {
  const show = currentView === VIEW_TRASH && items.length > 0;
  elements.emptyTrashBtn.classList.toggle('hidden', !show);
}

function updateEmptyState() {
  if (searchQuery) {
    elements.emptyStateText.textContent = 'No results found';
  } else if (currentView === VIEW_ARCHIVE) {
    elements.emptyStateText.textContent = 'No files in Archive';
  } else if (currentView === VIEW_TRASH) {
    elements.emptyStateText.textContent = 'No files in .trash';
  } else {
    elements.emptyStateText.textContent = 'Your links and notes will appear here';
  }
  const hasItems = elements.cardsGrid.children.length > 0;
  elements.emptyState.classList.toggle('hidden', hasItems);
}

function renderNoteMarkdown(contentEl, markdownContent) {
  const parsedHtml = marked.parse(markdownContent);
  const sanitizedHtml = sanitizeRenderedHtml(parsedHtml);
  contentEl.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(sanitizedHtml) : sanitizedHtml;
  enhanceTaskCheckboxes(contentEl);
}

function enhanceTaskCheckboxes(container) {
  if (!container) return;
  const boxes = container.querySelectorAll('input[type="checkbox"]');
  boxes.forEach((box, index) => {
    box.removeAttribute('disabled');
    box.disabled = false;
    box.dataset.taskIndex = String(index);
  });
}

function toggleTaskInMarkdown(markdownText, taskIndex, checked) {
  const lines = markdownText.split('\n');
  const taskLinePattern = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\](.*)$/;
  let cursor = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(taskLinePattern);
    if (!match) continue;

    if (cursor === taskIndex) {
      const prefix = match[1];
      const suffix = match[3];
      lines[i] = `${prefix}[${checked ? 'x' : ' '}]${suffix}`;
      return lines.join('\n');
    }

    cursor += 1;
  }

  return null;
}

// ===== 标题验证相关 =====

// Check if title already exists
function isTitleExists(title, excludeId = null) {
  const sanitizedTitle = sanitizeFilename(title);
  return items.some(item => {
    // Skip the item being edited
    if (excludeId && item.id === excludeId) return false;
    // id is the filename without extension
    return item.id === sanitizedTitle;
  });
}

// Title input handling
// ===== 编辑模态框专用的标题验证 =====
function handleEditTitleInput() {
  const title = editModal.titleInput.value.trim();

  if (!title) {
    clearEditTitleError();
    return;
  }

  // Exclude the item currently being edited
  if (isTitleExists(title, currentEditingItem?.id)) {
    showEditTitleError('This title already exists. Please use a different title.');
  } else {
    clearEditTitleError();
  }
}

function showEditTitleError(message) {
  editModal.titleError.textContent = message;
  editModal.titleError.classList.add('visible');
  editModal.titleInput.classList.add('error');
  editModal.saveBtn.disabled = true;
}

function clearEditTitleError() {
  editModal.titleError.textContent = '';
  editModal.titleError.classList.remove('visible');
  editModal.titleInput.classList.remove('error');
  editModal.saveBtn.disabled = false;
}
