/**
 * Keep 风格收藏应用 - 主入口
 * Orchestration: init, event binding, business logic, card interaction
 */

let eventsBound = false;

// marked adds disabled to task-list checkboxes by default.
// Override the renderer to allow direct interaction on cards.
const markedRenderer = new marked.Renderer();
markedRenderer.checkbox = function checkboxRenderer(arg) {
  const checked = typeof arg === 'boolean' ? arg : Boolean(arg && arg.checked);
  return `<input type="checkbox"${checked ? ' checked' : ''}>`;
};
marked.use({ renderer: markedRenderer });

let activeCardTagPopover = null;
let cardTagSaveQueue = Promise.resolve();

function normalizeTagList(tags) {
  const list = Array.isArray(tags) ? tags : [];
  const seen = new Set();
  return list
    .map(tag => typeof tag === 'string' ? tag.trim() : '')
    .filter(tag => {
      if (!tag) return false;
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

function closeCardTagPopover() {
  if (!activeCardTagPopover) return;

  const {
    popover,
    onDocumentPointerDown,
    onDocumentKeydown,
    onViewportChange
  } = activeCardTagPopover;

  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  document.removeEventListener('keydown', onDocumentKeydown, true);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);

  if (popover?.parentNode) {
    popover.parentNode.removeChild(popover);
  }

  activeCardTagPopover = null;
}

function positionCardTagPopover() {
  if (!activeCardTagPopover) return;

  const { button, popover } = activeCardTagPopover;
  if (!button?.isConnected || !popover?.isConnected) {
    closeCardTagPopover();
    return;
  }

  const margin = 8;
  const buttonRect = button.getBoundingClientRect();

  popover.style.visibility = 'hidden';
  popover.style.pointerEvents = 'none';
  const popoverRect = popover.getBoundingClientRect();

  // Prefer placing the popover at the button's upper-right corner.
  let left = buttonRect.right + margin;
  if (left + popoverRect.width > window.innerWidth - margin) {
    left = buttonRect.left - popoverRect.width - margin;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - popoverRect.width - margin));

  let top = buttonRect.top - popoverRect.height - margin;
  if (top < margin) {
    top = buttonRect.bottom + margin;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - popoverRect.height - margin));

  popover.style.left = `${Math.round(left + window.scrollX)}px`;
  popover.style.top = `${Math.round(top + window.scrollY)}px`;
  popover.style.visibility = 'visible';
  popover.style.pointerEvents = 'auto';
}

function enqueueCardTagSave(task) {
  const run = cardTagSaveQueue.then(task);
  cardTagSaveQueue = run.catch(() => {});
  return run;
}

function shouldReapplyCardFilters() {
  return selectedTags.size > 0 || Boolean(selectedType) || Boolean(searchQuery);
}

async function persistCardTags(item, cardEl, nextTags) {
  const normalizedTags = normalizeTagList(nextTags);
  const { data, content } = getItemParsed(item);
  const nextData = { ...data };

  if (normalizedTags.length > 0) {
    nextData.tags = normalizedTags.join(',');
  } else {
    delete nextData.tags;
  }

  const nextContent = createMarkdownWithFrontMatter(nextData, content);
  if (nextContent === item.content) return;

  const filename = item.fileName || `${item.id}.md`;
  await saveFile(filename, nextContent, currentView);

  item.content = nextContent;
  item.createdAt = Date.now();
  item._parsed = { data: nextData, content };
  item._parsedSource = nextContent;

  const tagsEl = cardEl.querySelector('.card-tags');
  if (tagsEl) {
    renderTags(tagsEl, normalizedTags);
  }

  updateSidebarTags();

  if (shouldReapplyCardFilters()) {
    filterAndRenderItems();
  }
}

function openCardTagPopover(buttonEl, item, cardEl) {
  if (!buttonEl || !item || !cardEl) return;
  if (currentView === VIEW_TRASH) return;

  if (activeCardTagPopover?.button === buttonEl) {
    closeCardTagPopover();
    return;
  }
  closeCardTagPopover();

  const popover = document.createElement('div');
  popover.className = 'card-tag-popover';

  const header = document.createElement('div');
  header.className = 'card-tag-popover-header';
  const title = document.createElement('span');
  title.className = 'card-tag-popover-title';
  title.textContent = 'Manage tags';
  header.appendChild(title);

  const body = document.createElement('div');
  body.className = 'card-tag-popover-body';
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'tags-input-container';
  body.appendChild(tagsContainer);

  popover.append(header, body);
  document.body.appendChild(popover);

  const { data } = getItemParsed(item);
  const initialTags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(t => t) : [];
  const popoverId = `${item.id}:${Date.now()}`;

  const tagsInput = new TagsInput(tagsContainer, {
    enableSuggestions: true,
    matchMode: 'includes',
    suggestionsProvider: () => allTags.map(t => t.name),
    onChange: () => {}
  });
  tagsInput.setTags(initialTags);

  const onDocumentPointerDown = (event) => {
    if (!activeCardTagPopover || activeCardTagPopover.id !== popoverId) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (popover.contains(target) || buttonEl.contains(target)) return;
    closeCardTagPopover();
  };

  const onDocumentKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (!activeCardTagPopover || activeCardTagPopover.id !== popoverId) return;
    event.preventDefault();
    event.stopPropagation();
    closeCardTagPopover();
  };

  const onViewportChange = () => {
    if (!activeCardTagPopover || activeCardTagPopover.id !== popoverId) return;
    if (!buttonEl.isConnected || !cardEl.isConnected) {
      closeCardTagPopover();
      return;
    }
    positionCardTagPopover();
  };

  tagsInput.onChange = (tags) => {
    const nextTags = normalizeTagList(tags);
    enqueueCardTagSave(async () => {
      if (!activeCardTagPopover || activeCardTagPopover.id !== popoverId) return;
      await persistCardTags(item, cardEl, nextTags);
      if (!cardEl.isConnected) {
        closeCardTagPopover();
      }
    }).catch((err) => {
      showPopup('Save failed: ' + err.message, 'error');
    });
  };

  activeCardTagPopover = {
    id: popoverId,
    button: buttonEl,
    card: cardEl,
    popover,
    onDocumentPointerDown,
    onDocumentKeydown,
    onViewportChange
  };

  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  document.addEventListener('keydown', onDocumentKeydown, true);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onViewportChange, true);

  positionCardTagPopover();
  tagsInput.focus();
}

// ===== 初始化 =====
async function init() {
  // Initialize TagsInput components
  editTagsInput = new TagsInput(editModal.tagsContainer, {
    enableSuggestions: true,
    matchMode: 'includes',
    suggestionsProvider: () => allTags.map(t => t.name)
  });
  linkEditTagsInput = new TagsInput(linkEditModal.tagsContainer, {
    enableSuggestions: true,
    matchMode: 'includes',
    suggestionsProvider: () => allTags.map(t => t.name)
  });

  bindEvents();
  bindEditModalEvents();
  bindLinkEditModalEvents();
  scheduleNoteEditorWarmup();
  warmupXPostEmbedding();

  // Check for cached directory handle
  try {
    const handle = await db.get('dirHandle');
    if (handle) {
      dirHandle = handle;
      // Update UI to restore mode
      elements.promptTitle.textContent = `Continue with "${handle.name}"?`;
      elements.promptDesc.innerHTML = 'For security, your browser needs you to confirm access again.';
      elements.openFolderBtn.textContent = 'Restore access';
    }
  } catch (e) {
    console.warn('DB error:', e);
  }

  refreshFeatherIcons();
}

// ===== 事件绑定 =====
function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  // Folder operations
  elements.openFolderBtn.addEventListener('click', handleOpenFolder);
  elements.changeFolderBtn.addEventListener('click', handleChangeFolder);

  // Click collapsed input to expand note form
  elements.addBoxCollapsed.addEventListener('click', expandNoteForm);

  // Close form
  elements.closeNoteForm.addEventListener('click', collapseForm);

  // Submit form
  elements.noteForm.addEventListener('submit', handleNoteSubmit);
  elements.noteContentInput.addEventListener('input', autoResizeNoteContentInput);

  // Click outside to close form
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-box') && !elements.addBoxCollapsed.classList.contains('hidden')) {
      return;
    }
    if (!e.target.closest('.add-box')) {
      collapseForm();
    }
  });

  // Card actions
  elements.cardsGrid.addEventListener('click', handleCardClick);
  elements.cardsGrid.addEventListener('change', handleCardCheckboxChange);

  // Sidebar toggle
  elements.sidebarToggleBtn.addEventListener('click', toggleSidebar);
  elements.closeSidebarBtn.addEventListener('click', toggleSidebarCollapse);
  window.addEventListener('resize', syncSidebarActionButton);
  syncSidebarActionButton();
  elements.viewNotesBtn.addEventListener('click', () => {
    closeCardTagPopover();
    switchView(VIEW_ACTIVE);
  });
  elements.viewArchiveBtn.addEventListener('click', () => {
    closeCardTagPopover();
    switchView(VIEW_ARCHIVE);
  });
  elements.viewTrashBtn.addEventListener('click', () => {
    closeCardTagPopover();
    switchView(VIEW_TRASH);
  });
  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.searchInput.addEventListener('keydown', handleSearchKeydown);
  elements.clearSearchBtn.addEventListener('click', clearSearchQuery);

  // Clear all filters
  elements.clearAllFiltersBtn.addEventListener('click', clearAllFilters);

  // Empty trash
  elements.emptyTrashBtn.addEventListener('click', handleEmptyTrash);

  // Type capsule filters
  initTypeCapsules();

  // Global paste shortcut: route plain text to main note input when app is focused
  document.addEventListener('paste', (e) => {
    if (isNoteEditOpen() || isLinkEditOpen()) return;
    if (isTextEditingTarget(e.target)) return;

    const pastedText = e.clipboardData?.getData('text/plain') ?? '';
    if (!pastedText) return;

    e.preventDefault();

    if (!isNoteFormOpen()) {
      expandNoteForm();
    }

    const input = elements.noteContentInput;
    if (!input) return;

    input.focus();

    const selectionStart = Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length;
    const selectionEnd = Number.isFinite(input.selectionEnd) ? input.selectionEnd : selectionStart;
    const nextValue = `${input.value.slice(0, selectionStart)}${pastedText}${input.value.slice(selectionEnd)}`;
    const nextCursor = selectionStart + pastedText.length;

    input.value = nextValue;
    input.setSelectionRange(nextCursor, nextCursor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' && activeCardTagPopover) {
      e.preventDefault();
      closeCardTagPopover();
      return;
    }

    // ESC closes sidebar
    if (e.key === 'Escape' && elements.sidebar.classList.contains('open')) {
      closeSidebar();
      return;
    }

    // ESC closes main input (when focus is inside the form)
    if (
      e.key === 'Escape' &&
      isNoteFormOpen() &&
      !isNoteEditOpen() &&
      !isLinkEditOpen() &&
      elements.noteForm.contains(document.activeElement)
    ) {
      e.preventDefault();
      collapseForm();
      return;
    }

    // Cmd/Ctrl + B: collapse/expand sidebar
    if (
      e.key.toLowerCase() === 'b' &&
      (e.metaKey || e.ctrlKey) &&
      !e.altKey &&
      !e.shiftKey &&
      !isTextEditingTarget(e.target) &&
      !isNoteEditOpen() &&
      !isLinkEditOpen()
    ) {
      e.preventDefault();
      toggleSidebarCollapse();
      return;
    }

    // n: Focus main input (only when not editing and no modal open)
    if (
      e.key.toLowerCase() === 'n' &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !isTextEditingTarget(e.target) &&
      !isNoteEditOpen() &&
      !isLinkEditOpen()
    ) {
      e.preventDefault();
      if (!isNoteFormOpen()) {
        expandNoteForm();
      }
      elements.noteContentInput.focus();
      return;
    }

    // /: Focus search input (only when not editing and no modal open)
    if (
      e.key === '/' &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !isTextEditingTarget(e.target) &&
      !isNoteEditOpen() &&
      !isLinkEditOpen()
    ) {
      e.preventDefault();
      if (!elements.sidebar.classList.contains('open') && window.innerWidth <= 1024) {
        elements.sidebar.classList.add('open');
        showSidebarOverlay();
      }
      elements.searchInput.focus();
      elements.searchInput.select();
      return;
    }

    // Cmd/Ctrl + Enter: Save
    if (isMetaOrCtrlEnter(e)) {
      // 1) Note edit modal
      if (isNoteEditOpen()) {
        e.preventDefault();
        if (editModal.saveBtn.disabled) return;
        const saved = await saveEditedNote();
        if (saved) {
          editModal.modal.classList.add('hidden');
        }
        return;
      }

      // 2) Link edit modal
      if (isLinkEditOpen()) {
        e.preventDefault();
        if (linkEditModal.saveBtn.disabled) return;
        const saved = await saveLinkEdit();
        if (saved) {
          linkEditModal.modal.classList.add('hidden');
        }
        return;
      }

      // 3) Main input form
      if (isNoteFormOpen()) {
        e.preventDefault();
        elements.noteForm.requestSubmit();
      }
    }
  });
}

// ===== 业务逻辑：添加笔记/链接 =====
async function handleNoteSubmit(e) {
  e.preventDefault();

  const content = elements.noteContentInput.value.trim();

  if (!content) {
    collapseForm();
    return;
  }

  // Single-line URL check
  if (isValidUrl(content)) {
    elements.noteContentInput.value = '';
    collapseForm(); // Close form early
    await addLinkItem(content, []);
  } else {
    // Plain note without title or tags
    await addItem('', content, []);

    // Clear input
    elements.noteContentInput.value = '';
    collapseForm();
  }
}

async function addItem(title, content, tags = []) {
  const baseTitle = sanitizeFilename(title || generateTimestampTitle());
  const finalTitle = ensureUniqueTitle(baseTitle);
  const filename = `${finalTitle}.md`;

  // Notes always use front matter with type: note
  const frontMatterData = { type: 'note' };
  if (tags.length > 0) {
    frontMatterData.tags = tags.join(',');
  }
  const finalContent = createMarkdownWithFrontMatter(frontMatterData, content);

  try {
    // Write to filesystem
    await saveFile(filename, finalContent);

    // Update in-memory state (filename without extension as id)
    const newItem = {
      id: finalTitle,
      content: finalContent,
      createdAt: Date.now(),
      fileName: filename
    };

    items.unshift(newItem);

    // Render
    renderOneItem(newItem, true);
    updateEmptyState();
    updateSidebarTags();

  } catch (e) {
    showPopup('Save failed: ' + e.message, 'error');
  }
}

async function addLinkItem(url, tags = []) {
  if (items.some(item => {
    const { data } = getItemParsed(item);
    return isLinkItemType(data.type) && data.url === url;
  })) {
    showPopup('This link already exists.', 'error');
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

    // Use link title as filename (sanitize invalid characters)
    const rawTitle = metadata.title || extractReadableTitleFromUrl(url);
    const sanitizedTitle = sanitizeFilename(rawTitle);
    const uniqueTitle = ensureUniqueTitle(sanitizedTitle);
    const filename = `${uniqueTitle}.md`;

    const frontMatterData = {
      type: getLinkTypeFromUrl(url),
      title: metadata.title || extractReadableTitleFromUrl(url),
      url: url,
      description: (metadata.description || '').replace(/\n/g, ' '),
      image: metadata.image || ''
    };

    // Add tags to front matter if present
    if (tags.length > 0) {
      frontMatterData.tags = tags.join(',');
    }

    const markdownContent = createMarkdownWithFrontMatter(frontMatterData);

    // Save to FS
    await saveFile(filename, markdownContent);

    // Update in-memory state (filename without extension as id)
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
    updateSidebarTags();

  } catch (e) {
    console.error('Add link failed:', e);
    showPopup('Failed to add link.', 'error');
    loadingCard.remove();
    updateEmptyState();
  } finally {
    pendingUrls.delete(url);
  }
}

// ===== 清空回收站 =====
async function handleEmptyTrash() {
  if (items.length === 0) return;

  const confirmed = window.confirm(`Permanently delete all ${items.length} item(s) in Trash? This cannot be undone.`);
  if (!confirmed) return;

  try {
    await deleteAllTrashFiles();
    items = [];
    elements.cardsGrid.innerHTML = '';
    updateEmptyState();
    updateTrashActions();
    updateTypeCapsules();
    updateSidebarTags();
    showPopup('Trash emptied');
  } catch (err) {
    showPopup('Empty trash failed: ' + err.message, 'error');
  }
}

// ===== 卡片交互处理 =====
async function handleCardClick(e) {
  // 1. Handle open-link button — let the link open normally
  const openLinkBtn = e.target.closest('.open-link-button');
  if (openLinkBtn) {
    // Do not prevent default, let the link open
    return;
  }

  // 1.2 Handle card-url click — open link in new tab
  const cardUrl = e.target.closest('.card-url');
  if (cardUrl) {
    e.preventDefault();
    e.stopPropagation();
    const card = cardUrl.closest('.card');
    const href = card?.querySelector('.open-link-button')?.href;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }

  // 1.1 Handle task checkbox click: toggle and persist to markdown file
  const taskCheckbox = e.target.closest('.note-content input[type="checkbox"]');
  if (taskCheckbox) {
    e.stopPropagation();
    return;
  }

  // 2. Handle copy-markdown button (body only, no front matter)
  const copyMarkdownBtn = e.target.closest('.copy-markdown-button');
  if (copyMarkdownBtn) {
    e.preventDefault();
    e.stopPropagation();
    copyMarkdownBtn.blur();

    const card = copyMarkdownBtn.closest('.card');
    if (!card) return;

    const id = card.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const { content } = getItemParsed(item);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(content);
      showPopup('Markdown copied');
    } catch (err) {
      showPopup('Copy failed', 'error');
    }
    return;
  }

  // 2.5 Handle copy-link button
  const copyLinkBtn = e.target.closest('.copy-link-button');
  if (copyLinkBtn) {
    e.preventDefault();
    e.stopPropagation();
    copyLinkBtn.blur();

    const card = copyLinkBtn.closest('.card');
    if (!card) return;

    const id = card.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      const { data } = getItemParsed(item);
      await navigator.clipboard.writeText(data.url);
      showPopup('Link copied');
    } catch (err) {
      showPopup('Copy failed', 'error');
    }
    return;
  }

  // 2.6 Handle tag-manage button
  const tagManageBtn = e.target.closest('.tag-manage-button');
  if (tagManageBtn) {
    e.preventDefault();
    e.stopPropagation();
    tagManageBtn.blur();

    if (currentView === VIEW_TRASH) return;

    const card = tagManageBtn.closest('.card');
    if (!card) return;

    const id = card.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    openCardTagPopover(tagManageBtn, item, card);
    return;
  }

  // 2.7 Handle archive button
  const archiveBtn = e.target.closest('.archive-button');
  if (archiveBtn) {
    e.preventDefault();
    e.stopPropagation();
    closeCardTagPopover();
    archiveBtn.blur();
    if (currentView !== VIEW_ACTIVE) return;

    const card = archiveBtn.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    try {
      await archiveFile(item.fileName || `${item.id}.md`);

      items = items.filter(i => i.id !== id);
      card.style.transition = 'all 0.2s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';

      setTimeout(() => {
        if (card.parentNode) card.remove();
        updateEmptyState();
        updateTypeCapsules();
        updateSidebarTags();
      }, 200);

      showPopup('Archived');
    } catch (err) {
      showPopup('Archive failed: ' + err.message, 'error');
    }
    return;
  }

  // 3. Handle restore button click
  const restoreBtn = e.target.closest('.restore-button');
  if (restoreBtn) {
    e.preventDefault();
    e.stopPropagation();
    closeCardTagPopover();
    restoreBtn.blur();

    const card = restoreBtn.closest('.card');
    const id = card.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    try {
      if (currentView === VIEW_ARCHIVE) {
        await restoreArchiveFile(item.fileName || `${item.id}.md`);
      } else {
        await restoreFile(item.fileName || `${item.id}.md`);
      }

      items = items.filter(i => i.id !== id);
      card.style.transition = 'all 0.2s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';

      setTimeout(() => {
        if (card.parentNode) card.remove();
        updateEmptyState();
        updateTrashActions();
        updateTypeCapsules();
        updateSidebarTags();
      }, 200);

      showPopup('Restored');
    } catch (err) {
      showPopup('Restore failed: ' + err.message, 'error');
    }
    return;
  }

  // 4. Handle delete button click
  const deleteBtn = e.target.closest('.delete-button');
  if (deleteBtn) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeCardTagPopover();
    deleteBtn.blur();

    const card = deleteBtn.closest('.card');

    // Prevent duplicate overlay
    if (card.querySelector('.card-overlay')) return;

    const id = card.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Create confirmation overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    const isTrashView = currentView === VIEW_TRASH;

    const msg = document.createElement('p');
    msg.textContent = isTrashView ? 'Delete permanently?' : 'Move to Trash?';

    const actions = document.createElement('div');
    actions.className = 'overlay-actions';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'overlay-btn btn-cancel';
    btnCancel.textContent = 'Cancel';

    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'overlay-btn btn-confirm';
    btnConfirm.textContent = 'Confirm';

    actions.append(btnCancel, btnConfirm);
    overlay.append(msg, actions);

    // Stop propagation to prevent triggering other card click handlers
    overlay.addEventListener('click', (ev) => ev.stopPropagation());

    btnCancel.addEventListener('click', (ev) => {
      ev.stopPropagation();
      overlay.remove();
    });

    btnConfirm.addEventListener('click', async (ev) => {
      ev.stopPropagation();

      // Loading state
      btnConfirm.textContent = '...';
      btnConfirm.style.opacity = '0.7';

      try {
        if (isTrashView) {
          await deleteTrashFile(item.fileName || `${item.id}.md`);
        } else {
          await deleteFile(item.fileName || `${item.id}.md`, currentView);
        }

        // Animate card removal
        items = items.filter(i => i.id !== id);
        card.style.transition = 'all 0.2s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';

        setTimeout(() => {
          if (card.parentNode) card.remove();
          updateEmptyState();
          updateTrashActions();
          updateSidebarTags();
        }, 200);

      } catch (err) {
        showPopup('Delete failed: ' + err.message, 'error');
        overlay.remove();
      }
    });

    card.appendChild(overlay);
    return;
  }

  // 4. Handle card edit click
  const card = e.target.closest('.card');
  if (!card) return;

  const id = card.dataset.id;
  const item = items.find(i => i.id === id);
  if (!item) return;

  if (currentView === VIEW_TRASH) {
    return;
  }

  // Open edit modal (link or note)
  closeCardTagPopover();
  e.preventDefault();
  e.stopPropagation();
  openEditModal(item);
}

async function handleCardCheckboxChange(e) {
  const taskCheckbox = e.target.closest('.note-content input[type="checkbox"]');
  if (!taskCheckbox) return;
  e.stopPropagation();
  await handleTaskCheckboxToggle(taskCheckbox, taskCheckbox.checked);
}

async function handleTaskCheckboxToggle(checkboxEl, explicitChecked) {
  const card = checkboxEl.closest('.card');
  if (!card) return;

  const id = card.dataset.id;
  const item = items.find(i => i.id === id);
  if (!item || currentView === VIEW_TRASH) return;

  const contentEl = card.querySelector('.note-content');
  if (!contentEl) return;

  const taskIndex = Number(checkboxEl.dataset.taskIndex);
  const resolvedTaskIndex = Number.isInteger(taskIndex) && taskIndex >= 0
    ? taskIndex
    : Array.from(contentEl.querySelectorAll('input[type="checkbox"]')).indexOf(checkboxEl);
  if (resolvedTaskIndex < 0) return;

  const nextChecked = typeof explicitChecked === 'boolean' ? explicitChecked : !checkboxEl.checked;
  const updatedRaw = toggleTaskInMarkdown(item.content, resolvedTaskIndex, nextChecked);
  if (!updatedRaw || updatedRaw === item.content) return;

  try {
    const filename = item.fileName || `${item.id}.md`;
    await saveFile(filename, updatedRaw, currentView);

    const itemIndex = items.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
      items[itemIndex] = {
        ...items[itemIndex],
        content: updatedRaw,
        createdAt: Date.now()
      };
    }

    const { content } = parseFrontMatter(updatedRaw);
    renderNoteMarkdown(contentEl, content);
  } catch (err) {
    showPopup('Task update failed: ' + err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
