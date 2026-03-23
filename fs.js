// ===== 文件系统操作 =====
function captureFolderState() {
  return {
    dirHandle,
    items: [...items],
    currentView,
    searchQuery,
    folderName: elements.folderName.textContent,
    searchInputValue: elements.searchInput.value,
    promptTitle: elements.promptTitle.textContent,
    promptDescHtml: elements.promptDesc.innerHTML,
    openFolderButtonText: elements.openFolderBtn.textContent,
    folderPromptHidden: elements.folderPrompt.classList.contains('hidden'),
    mainContentHidden: elements.mainContent.classList.contains('hidden')
  };
}

function restoreFolderState(snapshot) {
  if (!snapshot) return;

  dirHandle = snapshot.dirHandle;
  items = [...snapshot.items];
  currentView = snapshot.currentView;
  searchQuery = snapshot.searchQuery;
  elements.folderName.textContent = snapshot.folderName;
  elements.searchInput.value = snapshot.searchInputValue;
  elements.promptTitle.textContent = snapshot.promptTitle;
  elements.promptDesc.innerHTML = snapshot.promptDescHtml;
  elements.openFolderBtn.textContent = snapshot.openFolderButtonText;
  elements.folderPrompt.classList.toggle('hidden', snapshot.folderPromptHidden);
  elements.mainContent.classList.toggle('hidden', snapshot.mainContentHidden);

  syncCardsGridViewClass(currentView);
  updateViewControls();
  updateSidebarTags();
  filterAndRenderItems();
  updateEmptyState();
}

async function handleOpenFolder() {
  const previousState = captureFolderState();
  try {
    // If handle exists, try to verify permission
    if (dirHandle) {
      const permission = await verifyPermission(dirHandle, true);
      if (permission) {
        await finishSetupFolder();
        return;
      }
      // If verify fails (user denied), fall back to picker
    }

    // Open directory picker
    const handle = await window.showDirectoryPicker();
    dirHandle = handle;
    await finishSetupFolder();
    await db.set('dirHandle', handle);

  } catch (e) {
    restoreFolderState(previousState);
    if (e.name !== 'AbortError') {
      console.error('Failed to open folder:', e);
      showPopup('Failed to open folder. Please try again.', 'error');
    }
  }
}

async function handleChangeFolder() {
  const previousState = captureFolderState();

  try {
    const handle = await window.showDirectoryPicker();
    dirHandle = handle;
    await finishSetupFolder();
    await db.set('dirHandle', handle);
  } catch (e) {
    if (e.name === 'AbortError') return;

    console.error('Failed to change folder:', e);
    showPopup('Failed to change folder. Please try again.', 'error');

    restoreFolderState(previousState);
  }
}

async function finishSetupFolder() {
  await dirHandle.getDirectoryHandle(ARCHIVE_DIR_NAME, { create: true });
  elements.folderName.textContent = dirHandle.name;
  elements.folderPrompt.classList.add('hidden');
  elements.mainContent.classList.remove('hidden');
  currentView = VIEW_ACTIVE;
  syncCardsGridViewClass(currentView);
  updateViewControls();

  await loadItems(currentView);
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
async function getItemsDirectoryHandle(view) {
  if (!dirHandle) return null;
  if (view === VIEW_ACTIVE) return dirHandle;
  if (view === VIEW_ARCHIVE) {
    try {
      return await dirHandle.getDirectoryHandle(ARCHIVE_DIR_NAME);
    } catch (e) {
      if (e.name === 'NotFoundError') return null;
      throw e;
    }
  }

  try {
    return await dirHandle.getDirectoryHandle(TRASH_DIR_NAME);
  } catch (e) {
    if (e.name === 'NotFoundError') return null;
    throw e;
  }
}

function syncCardsGridViewClass(view) {
  elements.cardsGrid.classList.toggle('active-view', view === VIEW_ACTIVE);
  elements.cardsGrid.classList.toggle('archive-view', view === VIEW_ARCHIVE);
  elements.cardsGrid.classList.toggle('trash-view', view === VIEW_TRASH);
}

async function loadItems(view = currentView) {
  if (!dirHandle) return;

  items = [];
  elements.cardsGrid.innerHTML = ''; // Clear current

  try {
    const targetHandle = await getItemsDirectoryHandle(view);
    if (targetHandle) {
      for await (const entry of targetHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const file = await entry.getFile();
          let text = await file.text();

          const normalized = normalizeItemTypeInContent(text);
          if (normalized !== text) {
            const writable = await entry.createWritable();
            await writable.write(normalized);
            await writable.close();
            text = normalized;
          }

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
    }

    // Sort by created/modified time (desc)
    items.sort((a, b) => b.createdAt - a.createdAt);
    renderItems();
    updateSidebarTags();

  } catch (e) {
    console.error('Failed to load items:', e);
    showPopup('Failed to read files.', 'error');
  }
}

async function switchView(view) {
  if (!dirHandle || view === currentView) return;
  if (typeof closeCardTagPopover === 'function') {
    closeCardTagPopover();
  }
  currentView = view;
  selectedTags.clear();
  selectedType = null;
  collapseForm();
  syncCardsGridViewClass(view);
  updateViewControls();
  updateTypeCapsules();
  await loadItems(currentView);
}

// ===== 数据写入 (C/U) =====
async function getWritableDirectoryHandle(view = VIEW_ACTIVE) {
  if (view === VIEW_ACTIVE) return dirHandle;
  if (view === VIEW_ARCHIVE) {
    return dirHandle.getDirectoryHandle(ARCHIVE_DIR_NAME, { create: true });
  }
  if (view === VIEW_TRASH) {
    return dirHandle.getDirectoryHandle(TRASH_DIR_NAME, { create: true });
  }
  throw new Error(`Unsupported view: ${view}`);
}

async function fileExistsInDirectory(dirHandle, filename) {
  try {
    await dirHandle.getFileHandle(filename);
    return true;
  } catch (e) {
    if (e.name === 'NotFoundError') return false;
    throw e;
  }
}

async function ensureNoFileConflict(dirHandle, filename, excludeFilename = null, locationLabel = 'destination') {
  if (!dirHandle) return;
  if (excludeFilename && filename === excludeFilename) return;

  const exists = await fileExistsInDirectory(dirHandle, filename);
  if (!exists) return;

  throw new Error(`A file named "${filename}" already exists in ${locationLabel}.`);
}

async function deleteFileIfExists(dirHandle, filename) {
  if (!dirHandle || !filename) return;

  try {
    await dirHandle.removeEntry(filename);
  } catch (e) {
    if (e.name === 'NotFoundError') return;
    throw e;
  }
}

async function createUniqueTemporaryFilename(dirHandle, filename, label = 'tmp') {
  let counter = 0;

  while (true) {
    const suffix = counter === 0 ? label : `${label}-${counter}`;
    const candidate = `.${filename}.${suffix}`;
    const exists = await fileExistsInDirectory(dirHandle, candidate);
    if (!exists) return candidate;
    counter += 1;
  }
}

async function moveFileSafely(sourceHandle, targetHandle, filename, locationLabel) {
  await ensureNoFileConflict(targetHandle, filename, null, locationLabel);

  const fileHandle = await sourceHandle.getFileHandle(filename);

  if (fileHandle.move) {
    await fileHandle.move(targetHandle);
    return;
  }

  const file = await fileHandle.getFile();
  const content = await file.text();

  const newFileHandle = await targetHandle.getFileHandle(filename, { create: true });
  const writable = await newFileHandle.createWritable();
  await writable.write(content);
  await writable.close();

  await sourceHandle.removeEntry(filename);
}

async function replaceFileWithStagedWrite(oldFilename, newFilename, content, targetView = VIEW_ACTIVE) {
  const targetHandle = await getWritableDirectoryHandle(targetView);
  await ensureNoFileConflict(targetHandle, newFilename, oldFilename, 'the current folder');

  const stagedFilename = await createUniqueTemporaryFilename(targetHandle, newFilename, 'staged-save.tmp');
  const backupFilename = await createUniqueTemporaryFilename(targetHandle, oldFilename, 'backup.tmp');
  let backupCreated = false;
  let finalCreated = false;

  try {
    await saveFile(stagedFilename, content, targetView);
    await renameFile(oldFilename, backupFilename, targetView);
    backupCreated = true;

    await renameFile(stagedFilename, newFilename, targetView);
    finalCreated = true;

    await deleteFileIfExists(targetHandle, backupFilename);
  } catch (e) {
    if (finalCreated) {
      try {
        await deleteFileIfExists(targetHandle, newFilename);
      } catch (cleanupError) {
        console.warn('Failed to remove staged final file during rollback:', cleanupError);
      }
    }

    if (backupCreated) {
      try {
        await renameFile(backupFilename, oldFilename, targetView);
      } catch (rollbackError) {
        console.warn('Failed to restore original file during rollback:', rollbackError);
      }
    }

    try {
      await deleteFileIfExists(targetHandle, stagedFilename);
    } catch (cleanupError) {
      console.warn('Failed to remove staged temp file during rollback:', cleanupError);
    }

    throw e;
  }
}

async function saveFile(filename, content, targetView = VIEW_ACTIVE) {
  try {
    const targetHandle = await getWritableDirectoryHandle(targetView);
    const fileHandle = await targetHandle.getFileHandle(filename, { create: true });

    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    return fileHandle;
  } catch (e) {
    console.error('Save file failed:', e);
    throw e;
  }
}

async function deleteFile(filename, sourceView = VIEW_ACTIVE) {
  try {
    const trashHandle = await dirHandle.getDirectoryHandle(TRASH_DIR_NAME, { create: true });
    const sourceHandle = await getItemsDirectoryHandle(sourceView);
    if (!sourceHandle) {
      throw new Error(`Source directory for ${sourceView} not found`);
    }

    await ensureNoFileConflict(trashHandle, filename, null, 'Trash');
    await moveFileSafely(sourceHandle, trashHandle, filename, 'Trash');
  } catch (e) {
    console.error('Move to trash failed:', e);
    throw e;
  }
}

async function archiveFile(filename) {
  try {
    const archiveHandle = await dirHandle.getDirectoryHandle(ARCHIVE_DIR_NAME, { create: true });
    await ensureNoFileConflict(archiveHandle, filename, null, ARCHIVE_DIR_NAME);
    await moveFileSafely(dirHandle, archiveHandle, filename, ARCHIVE_DIR_NAME);
  } catch (e) {
    console.error('Move to archive failed:', e);
    throw e;
  }
}

async function restoreFile(filename) {
  try {
    const trashHandle = await dirHandle.getDirectoryHandle(TRASH_DIR_NAME);
    await ensureNoFileConflict(dirHandle, filename, null, 'Notes');
    await moveFileSafely(trashHandle, dirHandle, filename, 'Notes');
  } catch (e) {
    console.error('Restore file failed:', e);
    throw e;
  }
}

async function restoreArchiveFile(filename) {
  try {
    const archiveHandle = await dirHandle.getDirectoryHandle(ARCHIVE_DIR_NAME);
    await ensureNoFileConflict(dirHandle, filename, null, 'Notes');
    await moveFileSafely(archiveHandle, dirHandle, filename, 'Notes');
  } catch (e) {
    console.error('Restore archive file failed:', e);
    throw e;
  }
}

async function deleteAllTrashFiles() {
  const trashHandle = await dirHandle.getDirectoryHandle(TRASH_DIR_NAME);
  const entries = [];
  for await (const entry of trashHandle.values()) {
    if (entry.kind === 'file') entries.push(entry.name);
  }
  for (const name of entries) {
    await trashHandle.removeEntry(name);
  }
}

async function deleteTrashFile(filename) {
  try {
    const trashHandle = await dirHandle.getDirectoryHandle(TRASH_DIR_NAME);
    await trashHandle.removeEntry(filename);
  } catch (e) {
    console.error('Delete from trash failed:', e);
    throw e;
  }
}

/**
 * 重命名文件
 * @param {string} oldFilename - 旧文件名（如 "MyNote.md"）
 * @param {string} newFilename - 新文件名（如 "NewTitle.md"）
 */
async function renameFile(oldFilename, newFilename, targetView = VIEW_ACTIVE) {
  try {
    const targetHandle = await getWritableDirectoryHandle(targetView);
    await ensureNoFileConflict(targetHandle, newFilename, oldFilename, 'the current folder');
    const fileHandle = await targetHandle.getFileHandle(oldFilename);

    if (fileHandle.move) {
      await fileHandle.move(targetHandle, newFilename);
      return;
    }

    const file = await fileHandle.getFile();
    const content = await file.text();

    const newFileHandle = await targetHandle.getFileHandle(newFilename, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    await targetHandle.removeEntry(oldFilename);
  } catch (e) {
    console.error('Rename file failed:', e);
    throw e;
  }
}
