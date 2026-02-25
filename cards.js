// ===== 卡片渲染 =====
function renderItems() {
  filterAndRenderItems();
}

function renderOneItem(item, prepend) {
  const { data, content } = getItemParsed(item);
  let card;

  if (isLinkItemType(data.type)) {
    card = createLinkCard({ ...data, id: item.id });
  } else {
    // Use id (filename) as title, keep full markdown body
    const title = item.id;

    // Parse tags
    const tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];

    card = createNoteCard({
      id: item.id,
      title: title,
      content: content,
      tags: tags
    });
  }

  if (prepend) {
    elements.cardsGrid.prepend(card);
  } else {
    elements.cardsGrid.appendChild(card);
  }
}

function createLinkCard(data) {
  const template = elements.linkCardTemplate.content.cloneNode(true);
  const card = template.querySelector('.card');
  card.dataset.id = data.id;

  // Set open-link button href
  const openLinkBtn = card.querySelector('.open-link-button');
  if (openLinkBtn) {
    const safeUrl = withHttpProtocol(data.url);
    openLinkBtn.href = safeUrl || '#';
  }

  const imageWrap = card.querySelector('.card-image');
  const img = card.querySelector('.card-image img');
  const titleEl = card.querySelector('.card-title');
  const descriptionEl = card.querySelector('.card-description');
  const bodyEl = card.querySelector('.card-body');
  const urlTextEl = card.querySelector('.url-text');

  const xPostId = extractXPostId(data.url);
  if (xPostId) {
    card.classList.add('x-post-card');
    if (imageWrap) imageWrap.classList.add('hidden');
    if (titleEl) titleEl.classList.add('hidden');
    if (descriptionEl) descriptionEl.classList.add('hidden');

    const embedWrap = document.createElement('div');
    embedWrap.className = 'x-post-embed';
    const xPostUrl = `https://x.com/i/web/status/${xPostId}`;
    renderXPostEmbed(embedWrap, xPostId, xPostUrl);
    bodyEl.prepend(embedWrap);
  } else {
    const directImageUrl = extractDirectImageUrl(data.url);
    const displayImageUrl = directImageUrl || data.image;

    if (directImageUrl) {
      card.classList.add('image-link-card');
    }

    if (displayImageUrl) {
      img.src = displayImageUrl;
      img.alt = data.title;
      img.onerror = () => img.classList.add('error');
    } else {
      img.classList.add('error');
    }

    titleEl.textContent = data.title;
    if (descriptionEl) descriptionEl.textContent = data.description;
  }

  urlTextEl.textContent = extractDomain(data.url);

  // Render tags
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
  if (data.content) {
    renderNoteMarkdown(contentEl, data.content);
  }

  // Render tags
  const tags = data.tags || [];
  const tagsEl = card.querySelector('.card-tags');
  if (tagsEl) {
    renderTags(tagsEl, tags);
  }

  return card;
}

// Render tags into container
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
