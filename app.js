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
  elements.closeSidebarBtn.addEventListener('click', closeSidebar);
  elements.viewNotesBtn.addEventListener('click', () => switchView(VIEW_ACTIVE));
  elements.viewTrashBtn.addEventListener('click', () => switchView(VIEW_TRASH));
  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.searchInput.addEventListener('keydown', handleSearchKeydown);
  elements.clearSearchBtn.addEventListener('click', clearSearchQuery);

  // Clear all filters
  elements.clearAllFiltersBtn.addEventListener('click', clearAllFilters);

  // Keyboard shortcuts
  document.addEventListener('keydown', async (e) => {
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

// ===== 卡片交互处理 =====
async function handleCardClick(e) {
  // 1. Handle open-link button — let the link open normally
  const openLinkBtn = e.target.closest('.open-link-button');
  if (openLinkBtn) {
    // Do not prevent default, let the link open
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

  // 3. Handle delete button click
  const deleteBtn = e.target.closest('.delete-button');
  if (deleteBtn) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
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
          await deleteFile(item.fileName || `${item.id}.md`);
        }

        // Animate card removal
        items = items.filter(i => i.id !== id);
        card.style.transition = 'all 0.2s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';

        setTimeout(() => {
          if (card.parentNode) card.remove();
          updateEmptyState();
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
    await saveFile(filename, updatedRaw);

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
