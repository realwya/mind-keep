// ===== TagsInput 组件 =====
class TagsInput {
  constructor(container, options = {}) {
    this.tags = [];
    this.container = container;
    this.placeholder = options.placeholder || 'Add tag (press Enter)';
    this.maxTags = options.maxTags || Infinity;
    this.onChange = options.onChange || (() => {});
    this.enableSuggestions = options.enableSuggestions || false;
    this.suggestionsProvider = options.suggestionsProvider || (() => []);
    this.matchMode = options.matchMode || 'includes';
    this.suggestions = [];
    this.isFocused = false;
    this.blurTimeout = null;
    this.activeSuggestionIndex = -1;

    this.init();
  }

  init() {
    this.container.classList.add('tags-input-container');

    // Create input field
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'tags-input-field';
    this.input.placeholder = this.placeholder;
    this.container.appendChild(this.input);

    if (this.enableSuggestions) {
      this.suggestionsContainer = document.createElement('div');
      this.suggestionsContainer.className = 'tags-suggestions hidden';
      this.container.appendChild(this.suggestionsContainer);
    }

    // Bind events
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('focus', () => this.handleFocus());
    this.input.addEventListener('blur', () => this.handleBlur());
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.enableSuggestions && this.activeSuggestionIndex >= 0 && this.suggestions[this.activeSuggestionIndex]) {
        this.handleSuggestionClick(this.suggestions[this.activeSuggestionIndex]);
        return;
      }
      this.addTag(this.input.value.trim());
    } else if (e.key === 'Tab' && this.enableSuggestions && this.suggestions.length > 0) {
      e.preventDefault();
      const direction = e.shiftKey ? -1 : 1;
      if (this.activeSuggestionIndex < 0) {
        this.activeSuggestionIndex = direction === 1 ? 0 : this.suggestions.length - 1;
      } else {
        this.activeSuggestionIndex = (this.activeSuggestionIndex + direction + this.suggestions.length) % this.suggestions.length;
      }
      this.renderSuggestions();
    } else if (e.key === 'Backspace' && this.input.value === '' && this.tags.length > 0) {
      this.removeTag(this.tags.length - 1);
    } else if (e.key === ',' && this.input.value.trim()) {
      e.preventDefault();
      this.addTag(this.input.value.trim());
    }
  }

  handleInput() {
    if (!this.enableSuggestions) return;
    this.activeSuggestionIndex = -1;
    this.renderSuggestions();
  }

  handleFocus() {
    this.isFocused = true;
    this.showSuggestions();
  }

  handleBlur() {
    this.isFocused = false;
    clearTimeout(this.blurTimeout);
    this.blurTimeout = setTimeout(() => {
      // On blur, try to add remaining input as a tag
      const value = this.input.value.trim();
      if (value) {
        this.addTag(value);
      }
      this.activeSuggestionIndex = -1;
      this.hideSuggestions();
    }, 120);
  }

  addTag(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.tags.includes(trimmed)) {
      this.input.value = '';
      return;
    }
    if (this.tags.length >= this.maxTags) {
      showPopup('You can add up to ' + this.maxTags + ' tags', 'error');
      return;
    }

    this.tags.push(trimmed);
    this.render();
    this.input.value = '';
    this.onChange(this.tags);
    this.refreshSuggestions();
  }

  removeTag(index) {
    this.tags.splice(index, 1);
    this.render();
    this.onChange(this.tags);
    this.refreshSuggestions();
  }

  getTags() {
    return [...this.tags];
  }

  setTags(tags) {
    this.tags = Array.isArray(tags) ? [...tags] : [];
    this.render();
    this.onChange(this.tags);
    this.refreshSuggestions();
  }

  clear() {
    this.tags = [];
    this.render();
    this.onChange(this.tags);
    this.refreshSuggestions();
  }

  render() {
    // Remove old tag elements (keep input field)
    const oldTags = this.container.querySelectorAll('.tag');
    oldTags.forEach(t => t.remove());

    // Insert tags before input field
    this.tags.forEach((tag, index) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.textContent = tag;

      const removeBtn = document.createElement('span');
      removeBtn.className = 'tag-remove';
      removeBtn.dataset.index = index;
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTag(index);
      });

      tagEl.appendChild(removeBtn);
      this.container.insertBefore(tagEl, this.input);
    });

    this.refreshSuggestions();
  }

  getFilteredSuggestions(query) {
    if (!this.enableSuggestions) return [];

    const normalizedQuery = (query || '').toLowerCase();
    const usedTags = new Set(this.tags);
    const seen = new Set();
    const sourceTags = this.suggestionsProvider();

    const candidates = sourceTags
      .map(tag => typeof tag === 'string' ? tag.trim() : '')
      .filter(tag => {
        if (!tag) return false;
        if (usedTags.has(tag)) return false;
        if (seen.has(tag)) return false;
        seen.add(tag);
        return true;
      });

    return candidates.filter(tag => {
      const normalizedTag = tag.toLowerCase();
      if (!normalizedQuery) return true;
      if (this.matchMode === 'prefix') return normalizedTag.startsWith(normalizedQuery);
      if (this.matchMode === 'exact') return normalizedTag === normalizedQuery;
      return normalizedTag.includes(normalizedQuery);
    });
  }

  renderSuggestions() {
    if (!this.enableSuggestions || !this.suggestionsContainer) return;

    const query = this.input.value.trim();
    this.suggestions = this.getFilteredSuggestions(query);
    if (this.activeSuggestionIndex >= this.suggestions.length) {
      this.activeSuggestionIndex = -1;
    }
    this.suggestionsContainer.innerHTML = '';

    if (!this.isFocused || this.suggestions.length === 0) {
      this.suggestionsContainer.classList.add('hidden');
      return;
    }

    this.suggestions.forEach(tag => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tag-suggestion-item';
      if (this.suggestions[this.activeSuggestionIndex] === tag) {
        item.classList.add('selected');
      }
      item.textContent = tag;
      item.addEventListener('mousedown', (e) => e.preventDefault());
      item.addEventListener('click', () => this.handleSuggestionClick(tag));
      this.suggestionsContainer.appendChild(item);
    });

    this.suggestionsContainer.classList.remove('hidden');
  }

  showSuggestions() {
    if (!this.enableSuggestions) return;
    this.renderSuggestions();
  }

  hideSuggestions() {
    if (!this.enableSuggestions || !this.suggestionsContainer) return;
    this.suggestionsContainer.classList.add('hidden');
  }

  handleSuggestionClick(tag) {
    this.activeSuggestionIndex = -1;
    this.addTag(tag);
    this.input.value = '';
    this.showSuggestions();
    this.focus();
  }

  refreshSuggestions() {
    if (!this.enableSuggestions) return;
    this.renderSuggestions();
  }

  focus() {
    this.input.focus();
  }
}
