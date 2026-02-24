// ===== 编辑功能 =====
// Open edit modal
function openEditModal(item) {
  currentEditingItem = item;

  // Parse existing content
  const { data, content } = getItemParsed(item);

  if (isLinkItemType(data.type)) {
    // Open link edit modal
    openLinkEditModal(item, data);
  } else {
    // Open note edit modal
    openNoteEditModal(item, data, content);
  }
}

function getEditContent() {
  if (noteEditorView) {
    return noteEditorView.state.doc.toString();
  }
  return editModal.textarea.value;
}

function setEditContent(content) {
  const next = content || '';

  if (noteEditorView) {
    noteEditorView.dispatch({
      changes: { from: 0, to: noteEditorView.state.doc.length, insert: next }
    });
  }

  // Keep textarea in sync as fallback
  editModal.textarea.value = next;
}

function focusEditContent() {
  if (noteEditorView) {
    noteEditorView.focus();
    return;
  }
  editModal.textarea.focus();
}

function createHeadingExtension(StateField, Decoration, EditorView) {
  function buildDecorations(state) {
    const decorations = [];

    for (let i = 1; i <= state.doc.lines; i += 1) {
      const line = state.doc.line(i);
      const match = line.text.match(/^(#{1,6})\s/);
      if (!match) continue;

      const level = match[1].length;
      if (level === 1) {
        decorations.push(Decoration.line({ attributes: { class: 'cm-heading-1' } }).range(line.from));
      } else if (level === 2) {
        decorations.push(Decoration.line({ attributes: { class: 'cm-heading-2' } }).range(line.from));
      }
    }

    return Decoration.set(decorations);
  }

  return StateField.define({
    create(state) {
      return buildDecorations(state);
    },
    update(value, tr) {
      if (!tr.docChanged) return value;
      return buildDecorations(tr.state);
    },
    provide: (field) => EditorView.decorations.from(field)
  });
}

async function ensureNoteEditor() {
  if (noteEditorView) return true;
  if (noteEditorLoader) return noteEditorLoader;

  noteEditorLoader = (async () => {
    try {
      const [
        { EditorState, StateField },
        { EditorView, Decoration },
        { markdown, markdownLanguage },
        { HighlightStyle, syntaxHighlighting },
        { tags }
      ] = await Promise.all([
        import('https://esm.sh/@codemirror/state@6.5.4'),
        import('https://esm.sh/@codemirror/view@6.39.14'),
        import('https://esm.sh/@codemirror/lang-markdown@6.3.3'),
        import('https://esm.sh/@codemirror/language@6.12.1'),
        import('https://esm.sh/@lezer/highlight@1.2.3')
      ]);

      const headingExtension = createHeadingExtension(StateField, Decoration, EditorView);
      const syntaxHighlighter = HighlightStyle.define([
        { tag: tags.heading, fontWeight: '700' },
        { tag: tags.strong, fontWeight: '700' },
        { tag: tags.emphasis, fontStyle: 'italic' },
        { tag: tags.strikethrough, textDecoration: 'line-through' },
        { tag: tags.link, color: '#1a73e8' },
        { tag: tags.monospace, fontFamily: 'Roboto Mono, Consolas, monospace' }
      ]);

      noteEditorView = new EditorView({
        state: EditorState.create({
          doc: editModal.textarea.value || '',
          extensions: [
            markdown({ base: markdownLanguage }),
            syntaxHighlighting(syntaxHighlighter),
            headingExtension,
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                updateCharCount(update.state.doc.toString());
                editModal.textarea.value = update.state.doc.toString();
              }
            }),
            EditorView.theme({
              '&': {
                height: '100%'
              },
              '.cm-scroller': {
                overflow: 'auto'
              },
              '.cm-gutters': {
                display: 'none'
              },
              '&.cm-focused': {
                outline: 'none'
              }
            })
          ]
        }),
        parent: editModal.editorContainer
      });

      editModal.editorContainer.classList.remove('hidden');
      editModal.textarea.classList.add('hidden');
      return true;
    } catch (error) {
      console.warn('CodeMirror load failed, fallback to textarea:', error);
      editModal.editorContainer.classList.add('hidden');
      editModal.textarea.classList.remove('hidden');
      return false;
    } finally {
      noteEditorLoader = null;
    }
  })();

  return noteEditorLoader;
}

// Open note edit modal
async function openNoteEditModal(item, data, content) {
  // Populate title (item.id = filename without extension)
  editModal.titleInput.value = item.id;

  // Populate content (without front matter)
  setEditContent(content);
  updateCharCount(content);

  // Populate tags
  const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
  editTagsInput.setTags(tags);

  // Reset save button and error state
  editModal.saveBtn.disabled = false;
  editModal.saveBtn.textContent = 'Save';
  clearEditTitleError();

  editModal.modal.classList.remove('hidden');
  await ensureNoteEditor();
  setEditContent(content);
  focusEditContent();
}

// Open link edit modal
function openLinkEditModal(item, data) {
  // Populate form fields
  linkEditModal.form.title.value = data.title || '';
  linkEditModal.form.url.value = data.url || '';
  linkEditModal.form.description.value = data.description || '';
  linkEditModal.form.image.value = data.image || '';
  updateLinkCoverPreview(linkEditModal.form.image.value);

  // Populate tags
  const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
  linkEditTagsInput.setTags(tags);

  linkEditModal.modal.classList.remove('hidden');
}

function updateLinkCoverPreview(imageUrl) {
  const trimmedUrl = (imageUrl || '').trim();
  if (!trimmedUrl) {
    linkEditModal.coverPreview.classList.add('hidden');
    linkEditModal.coverPreviewImage.removeAttribute('src');
    linkEditModal.coverPreviewHint.textContent = 'Cover preview unavailable';
    linkEditModal.coverPreviewHint.classList.add('hidden');
    return;
  }

  linkEditModal.coverPreview.classList.remove('hidden');
  linkEditModal.coverPreviewHint.textContent = 'Loading preview...';
  linkEditModal.coverPreviewHint.classList.remove('hidden');
  linkEditModal.coverPreviewImage.src = trimmedUrl;
}

// Close note edit modal (auto-save)
async function closeEditModal() {
  if (!currentEditingItem) {
    editModal.modal.classList.add('hidden');
    return;
  }

  // Auto-save
  const saved = await saveEditedNote();
  if (saved) {
    editModal.modal.classList.add('hidden');
  } else {
    // Save failed, keep modal open
  }
}

// Save edit
async function saveEditedNote() {
  if (!currentEditingItem) return false;

  const newContent = getEditContent().trim();
  if (!newContent) {
    showPopup('Content cannot be empty.', 'error');
    return false;
  }

  // Get new title, fall back to original if empty
  const newTitle = editModal.titleInput.value.trim();
  const finalTitle = newTitle || currentEditingItem.id;
  const sanitizedTitle = sanitizeFilename(finalTitle);

  // Duplicate detection (if title changed)
  if (sanitizedTitle !== currentEditingItem.id) {
    if (isTitleExists(sanitizedTitle, currentEditingItem.id)) {
      showEditTitleError('This title already exists. Please use a different title.');
      editModal.titleInput.focus();
      return false;
    }
  }

  // Get tags
  const tags = editTagsInput.getTags();

  const oldFilename = currentEditingItem.fileName;
  const newFilename = `${sanitizedTitle}.md`;
  const { data: originalData } = getItemParsed(currentEditingItem);
  const frontMatterData = { ...originalData, type: 'note' };
  delete frontMatterData.url;
  delete frontMatterData.image;
  delete frontMatterData.description;
  if (tags.length > 0) {
    frontMatterData.tags = tags.join(',');
  } else {
    delete frontMatterData.tags;
  }

  const finalContent = createMarkdownWithFrontMatter(frontMatterData, newContent);
  const hasFilenameChange = newFilename !== oldFilename;
  const hasContentChange = finalContent !== currentEditingItem.content;

  // No changes detected, skip file write
  if (!hasFilenameChange && !hasContentChange) {
    currentEditingItem = null;
    setEditContent('');
    editModal.titleInput.value = '';
    editTagsInput.clear();
    clearEditTitleError();
    return true;
  }

  editModal.saveBtn.disabled = true;
  editModal.saveBtn.textContent = 'Saving...';

  try {
    // Rename file if title changed
    if (hasFilenameChange) {
      await renameFile(oldFilename, newFilename);
    }

    // Save content to file (using new filename)
    await saveFile(newFilename, finalContent);

    // Update in-memory state
    const index = items.findIndex(i => i.id === currentEditingItem.id);
    if (index !== -1) {
      items[index] = {
        ...items[index],
        id: sanitizedTitle,
        content: finalContent,
        createdAt: Date.now(),
        fileName: newFilename
      };
    }

    // Update UI
    const oldId = currentEditingItem.id;
    const card = document.querySelector(`.card[data-id="${oldId}"]`);

    if (card) {
      // Update data-id attribute
      card.dataset.id = sanitizedTitle;

      // Update title
      const titleEl = card.querySelector('.note-title');
      if (titleEl) titleEl.textContent = sanitizedTitle;

      // Update content (render full markdown body)
      const contentEl = card.querySelector('.note-content');
      if (contentEl) {
        renderNoteMarkdown(contentEl, newContent);
      }

      // Update tags
      const tagsEl = card.querySelector('.card-tags');
      if (tagsEl) renderTags(tagsEl, tags);
    }

    // Reset state
    currentEditingItem = null;
    setEditContent('');
    editModal.titleInput.value = '';
    editTagsInput.clear();
    clearEditTitleError();
    updateSidebarTags();

    return true;

  } catch (e) {
    console.error('Save failed:', e);
    showPopup('Save failed: ' + e.message, 'error');
    editModal.saveBtn.disabled = false;
    editModal.saveBtn.textContent = 'Save';
    return false;
  }
}

// Input listener
function handleEditInput() {
  updateCharCount(getEditContent());
}

// Update character count
function updateCharCount(content) {
  editModal.charCount.textContent = `${content.length} chars`;
}

// Bind edit modal events
function bindEditModalEvents() {
  editModal.saveBtn.addEventListener('click', async () => {
    const saved = await saveEditedNote();
    if (saved) {
      editModal.modal.classList.add('hidden');
    }
  });
  editModal.backdrop.addEventListener('click', () => closeEditModal());
  editModal.textarea.addEventListener('input', handleEditInput);

  // Title input validation
  editModal.titleInput.addEventListener('input', handleEditTitleInput);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.modal.classList.contains('hidden')) {
      closeEditModal();
    }
  });

  editModal.modal.querySelector('.edit-modal-container')
    .addEventListener('click', (e) => e.stopPropagation());
}

// Bind link edit modal events
function bindLinkEditModalEvents() {
  linkEditModal.form.image.addEventListener('input', (e) => {
    updateLinkCoverPreview(e.target.value);
  });

  linkEditModal.coverPreviewImage.addEventListener('load', () => {
    linkEditModal.coverPreviewHint.textContent = '';
    linkEditModal.coverPreviewHint.classList.add('hidden');
  });

  linkEditModal.coverPreviewImage.addEventListener('error', () => {
    linkEditModal.coverPreviewHint.textContent = 'Cover preview unavailable';
    linkEditModal.coverPreviewHint.classList.remove('hidden');
  });

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

// Close link edit modal (auto-save)
async function closeLinkEditModal() {
  if (!currentEditingItem) {
    linkEditModal.modal.classList.add('hidden');
    return;
  }

  // Auto-save
  const saved = await saveLinkEdit();
  if (saved) {
    linkEditModal.modal.classList.add('hidden');
  }
}

// Save link edit
async function saveLinkEdit() {
  if (!currentEditingItem) return false;

  const rawUrl = linkEditModal.form.url.value.trim();
  if (!rawUrl) {
    showPopup('Link cannot be empty.', 'error');
    return false;
  }
  if (!isValidUrl(rawUrl)) {
    showPopup('Invalid URL. Only http/https links are allowed.', 'error');
    return false;
  }

  // Get form data
  const formData = {
    type: getLinkTypeFromUrl(rawUrl),
    title: linkEditModal.form.title.value.trim(),
    url: rawUrl,
    description: linkEditModal.form.description.value.trim(),
    image: linkEditModal.form.image.value.trim(),
  };

  if (!formData.url) {
    showPopup('Link cannot be empty.', 'error');
    return false;
  }

  const tags = linkEditTagsInput.getTags();
  if (tags.length > 0) {
    formData.tags = tags.join(',');
  }

  // Generate front matter content
  const content = createMarkdownWithFrontMatter(formData);

  // No changes detected, skip file write
  if (content === currentEditingItem.content) {
    currentEditingItem = null;
    linkEditModal.form.reset();
    linkEditTagsInput.clear();
    return true;
  }

  linkEditModal.saveBtn.disabled = true;
  linkEditModal.saveBtn.textContent = 'Saving...';

  try {
    // 1. Save to filesystem
    await saveFile(currentEditingItem.fileName, content);

    // 2. Update in-memory state
    const index = items.findIndex(i => i.id === currentEditingItem.id);
    if (index !== -1) {
      items[index].content = content;
      items[index].createdAt = Date.now();
    }

    // 3. Update UI (full card replacement for correct styling on type change)
    const card = document.querySelector(`.card[data-id="${currentEditingItem.id}"]`);
    if (card) {
      const nextCard = createLinkCard({ ...formData, id: currentEditingItem.id });
      card.replaceWith(nextCard);
      const tagsEl = nextCard.querySelector('.card-tags');
      if (tagsEl) renderTags(tagsEl, tags);
    }

    // Reset state
    currentEditingItem = null;
    linkEditModal.form.reset();
    linkEditTagsInput.clear();

    // Reset button state
    linkEditModal.saveBtn.disabled = false;
    linkEditModal.saveBtn.textContent = 'Save';
    updateSidebarTags();

    return true;

  } catch (e) {
    console.error('Save failed:', e);
    showPopup('Save failed: ' + e.message, 'error');
    linkEditModal.saveBtn.disabled = false;
    linkEditModal.saveBtn.textContent = 'Save';
    return false;
  }
}
