// ===== 文件系统操作 =====
async function handleOpenFolder() {
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
    await db.set('dirHandle', handle);

    await finishSetupFolder();

  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Failed to open folder:', e);
      showPopup('Failed to open folder. Please try again.', 'error');
    }
  }
}

async function handleChangeFolder() {
  const previousDirHandle = dirHandle;
  const previousItems = [...items];
  const previousView = currentView;
  const previousFolderName = elements.folderName.textContent;
  const previousSearchQuery = searchQuery;

  try {
    const handle = await window.showDirectoryPicker();
    await db.set('dirHandle', handle);

    dirHandle = handle;
    await finishSetupFolder();
  } catch (e) {
    if (e.name === 'AbortError') return;

    console.error('Failed to change folder:', e);
    showPopup('Failed to change folder. Please try again.', 'error');

    dirHandle = previousDirHandle;
    items = previousItems;
    currentView = previousView;
    searchQuery = previousSearchQuery;
    elements.folderName.textContent = previousFolderName;
    elements.searchInput.value = previousSearchQuery;

    updateViewControls();
    updateSidebarTags();
    filterAndRenderItems();
    updateEmptyState();
  }
}

async function finishSetupFolder() {
  elements.folderName.textContent = dirHandle.name;
  elements.folderPrompt.classList.add('hidden');
  elements.mainContent.classList.remove('hidden');
  currentView = VIEW_ACTIVE;
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

  try {
    return await dirHandle.getDirectoryHandle('.trash');
  } catch (e) {
    if (e.name === 'NotFoundError') return null;
    throw e;
  }
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

          if (view === VIEW_ACTIVE) {
            const normalized = normalizeItemTypeInContent(text);
            if (normalized !== text) {
              const writable = await entry.createWritable();
              await writable.write(normalized);
              await writable.close();
              text = normalized;
            }
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
  currentView = view;
  selectedTags.clear();
  collapseForm();
  updateViewControls();
  await loadItems(currentView);
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
    // 1. Get or create .trash directory
    const trashHandle = await dirHandle.getDirectoryHandle('.trash', { create: true });

    // 2. Get source file handle
    const fileHandle = await dirHandle.getFileHandle(filename);

    // 3. Try move API (Chrome 109+ and modern browsers)
    if (fileHandle.move) {
      await fileHandle.move(trashHandle);
    } else {
      // Fallback: copy then delete
      const file = await fileHandle.getFile();
      const content = await file.text();

      // Create in trash
      const newFileHandle = await trashHandle.getFileHandle(filename, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Delete original file
      await dirHandle.removeEntry(filename);
    }
  } catch (e) {
    console.error('Move to trash failed:', e);
    throw e;
  }
}

async function deleteTrashFile(filename) {
  try {
    const trashHandle = await dirHandle.getDirectoryHandle('.trash');
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
async function renameFile(oldFilename, newFilename) {
  try {
    const fileHandle = await dirHandle.getFileHandle(oldFilename);

    // Prefer move API (Chrome 109+)
    if (fileHandle.move) {
      await fileHandle.move(dirHandle, newFilename);
      return;
    }

    // Fallback: copy new file then delete old
    const file = await fileHandle.getFile();
    const content = await file.text();

    const newFileHandle = await dirHandle.getFileHandle(newFilename, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    await dirHandle.removeEntry(oldFilename);
  } catch (e) {
    console.error('Rename file failed:', e);
    throw e;
  }
}
