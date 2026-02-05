// UI components: confirm panel with interactive HTML tree
window.CopyVisibleHTML = window.CopyVisibleHTML || {};

(function() {
  'use strict';

  let panel = null;
  let currentElement = null;
  let currentMode = 'html'; // 'html' or 'text'
  let onCopy = null;
  let onCancel = null;
  let onParent = null;
  let onSelectElement = null;
  let highlightCallback = null;

  // Element registry for click handling
  const elementRegistry = new Map();

  /**
   * Create the confirmation panel
   */
  function createPanel() {
    panel = document.createElement('div');
    panel.id = 'cvh-panel';
    panel.innerHTML = `
      <div class="cvh-panel-header">
        <button class="cvh-btn cvh-btn-parent" title="Select parent element">↑ Parent</button>
        <div class="cvh-btn-group">
          <button class="cvh-btn cvh-btn-mode cvh-btn-active" data-mode="html">HTML</button>
          <button class="cvh-btn cvh-btn-mode" data-mode="text">Text</button>
        </div>
        <button class="cvh-btn cvh-btn-copy">Copy</button>
        <button class="cvh-btn cvh-btn-cancel">Cancel</button>
      </div>
      <div class="cvh-panel-info"></div>
      <div class="cvh-panel-preview"></div>
    `;

    // Attach event listeners
    panel.querySelector('.cvh-btn-parent').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onParent) onParent();
    });

    panel.querySelector('.cvh-btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onCopy) onCopy(currentMode);
    });

    panel.querySelector('.cvh-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onCancel) onCancel();
    });

    // Mode toggle buttons (HTML/Text)
    panel.querySelectorAll('.cvh-btn-mode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        setMode(mode);
      });
    });

    // Prevent clicks inside panel from bubbling to picker
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('mousemove', (e) => e.stopPropagation());
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());

    document.body.appendChild(panel);
    return panel;
  }

  /**
   * Set the current mode (html/text) and update UI
   */
  function setMode(mode) {
    currentMode = mode;
    panel.querySelectorAll('.cvh-btn-mode').forEach(btn => {
      btn.classList.toggle('cvh-btn-active', btn.dataset.mode === mode);
    });
    updatePreview();
  }

  /**
   * Check if element is visible
   */
  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    return true;
  }

  /**
   * Escape HTML for safe display
   */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Get visible children
   */
  function getVisibleChildren(el) {
    return Array.from(el.children).filter(child => isVisible(child));
  }

  /**
   * Register element for lookup
   */
  function registerElement(el) {
    if (!el._cvhId) {
      el._cvhId = Math.random().toString(36).slice(2);
    }
    elementRegistry.set(el._cvhId, el);
    return el._cvhId;
  }

  /**
   * Get attributes worth keeping (semantic ones)
   */
  function getSemanticAttributes(el) {
    const dominated = new Set([
      'href', 'src', 'alt', 'title', 'type', 'name', 'value', 'placeholder',
      'for', 'action', 'method', 'target', 'rel', 'colspan', 'rowspan'
    ]);
    const attrs = [];
    for (const attr of el.attributes) {
      if (dominated.has(attr.name.toLowerCase())) {
        let val = attr.value;
        if (val.length > 40) val = val.substring(0, 40) + '…';
        attrs.push({ name: attr.name, value: val });
      }
    }
    return attrs;
  }

  /**
   * Build interactive HTML tree
   */
  function buildInteractiveHTML(el, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return '';
    
    const id = registerElement(el);
    const tag = el.tagName.toLowerCase();
    const indent = '  '.repeat(depth);
    const children = getVisibleChildren(el);
    const attrs = getSemanticAttributes(el);
    
    // Build attribute string
    let attrStr = '';
    for (const attr of attrs) {
      attrStr += ` <span class="cvh-attr-name">${escapeHtml(attr.name)}</span>=<span class="cvh-attr-value">"${escapeHtml(attr.value)}"</span>`;
    }
    
    // Get direct text content
    let textContent = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          textContent += text + ' ';
        }
      }
    }
    textContent = textContent.trim();
    if (textContent.length > 50) {
      textContent = textContent.substring(0, 50) + '…';
    }
    
    let html = '';
    
    // Self-closing tags
    const selfClosing = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
    
    if (selfClosing.has(tag)) {
      html += `${indent}<span class="cvh-tag cvh-tag-clickable" data-el-id="${id}">&lt;${tag}${attrStr} /&gt;</span>\n`;
    } else if (children.length === 0) {
      // Leaf element with just text
      html += `${indent}<span class="cvh-tag cvh-tag-clickable" data-el-id="${id}">&lt;${tag}${attrStr}&gt;</span>`;
      if (textContent) {
        html += `<span class="cvh-text">${escapeHtml(textContent)}</span>`;
      }
      html += `<span class="cvh-tag">&lt;/${tag}&gt;</span>\n`;
    } else {
      // Element with children - collapsible
      html += `${indent}<span class="cvh-collapse" data-el-id="${id}">▼</span><span class="cvh-tag cvh-tag-clickable" data-el-id="${id}">&lt;${tag}${attrStr}&gt;</span>\n`;
      html += `<span class="cvh-children" data-parent-id="${id}">`;
      
      // Add text before first child if any
      if (textContent) {
        html += `${indent}  <span class="cvh-text">${escapeHtml(textContent)}</span>\n`;
      }
      
      // Recurse into children
      for (const child of children) {
        html += buildInteractiveHTML(child, depth + 1, maxDepth);
      }
      
      html += `</span>${indent}<span class="cvh-tag">&lt;/${tag}&gt;</span>\n`;
    }
    
    return html;
  }

  /**
   * Attach tree event listeners
   */
  function attachTreeListeners(container) {
    // Collapse toggles
    container.querySelectorAll('.cvh-collapse').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const elId = toggle.dataset.elId;
        const children = container.querySelector(`.cvh-children[data-parent-id="${elId}"]`);
        if (children) {
          const isCollapsed = children.style.display === 'none';
          children.style.display = isCollapsed ? 'inline' : 'none';
          toggle.textContent = isCollapsed ? '▼' : '▶';
        }
      });
    });
    
    // Clickable tags
    container.querySelectorAll('.cvh-tag-clickable').forEach(tag => {
      // Click to select
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const elId = tag.dataset.elId;
        const el = elementRegistry.get(elId);
        if (el && onSelectElement) {
          onSelectElement(el);
        }
      });
      
      // Hover to highlight
      tag.addEventListener('mouseenter', (e) => {
        const elId = tag.dataset.elId;
        const el = elementRegistry.get(elId);
        if (el && highlightCallback) {
          highlightCallback(el);
        }
        tag.classList.add('cvh-tag-hover');
      });
      
      tag.addEventListener('mouseleave', (e) => {
        tag.classList.remove('cvh-tag-hover');
        if (highlightCallback && currentElement) {
          highlightCallback(currentElement);
        }
      });
    });
  }

  /**
   * Update the preview content
   */
  function updatePreview() {
    if (!panel || !currentElement) return;

    const previewEl = panel.querySelector('.cvh-panel-preview');
    const infoDiv = panel.querySelector('.cvh-panel-info');

    elementRegistry.clear();

    if (currentMode === 'html') {
      // Build interactive HTML tree
      const interactiveHTML = buildInteractiveHTML(currentElement, 0, 15);
      const pre = document.createElement('pre');
      pre.className = 'cvh-code';
      // interactiveHTML is built with escapeHtml() for all user content
      pre.innerHTML = interactiveHTML;
      previewEl.textContent = '';
      previewEl.appendChild(pre);
      attachTreeListeners(previewEl);
      previewEl.classList.add('cvh-interactive');
    } else {
      // Plain text mode - use textContent for safety
      const content = window.CopyVisibleHTML.extractVisibleText(currentElement);
      const pre = document.createElement('pre');
      pre.className = 'cvh-code';
      const code = document.createElement('code');
      code.textContent = content;
      pre.appendChild(code);
      previewEl.textContent = '';
      previewEl.appendChild(pre);
      previewEl.classList.remove('cvh-interactive');
    }

    // Show element info
    const tagName = currentElement.tagName.toLowerCase();
    let content;
    if (currentMode === 'html') {
      content = window.CopyVisibleHTML.extractVisibleHTML(currentElement);
    } else {
      content = window.CopyVisibleHTML.extractVisibleText(currentElement);
    }
    const charCount = content.length;
    infoDiv.textContent = `<${tagName}> · ${charCount.toLocaleString()} chars`;
  }

  /**
   * Show the panel for a selected element
   */
  function showPanel(element, callbacks) {
    currentElement = element;
    onCopy = callbacks.onCopy;
    onCancel = callbacks.onCancel;
    onParent = callbacks.onParent;
    onSelectElement = callbacks.onSelectElement || null;
    highlightCallback = callbacks.onHighlight || null;

    if (!panel) {
      createPanel();
    }

    currentMode = 'html';
    
    panel.querySelector('.cvh-btn-mode[data-mode="html"]').classList.add('cvh-btn-active');
    panel.querySelector('.cvh-btn-mode[data-mode="text"]').classList.remove('cvh-btn-active');

    updatePreview();
    panel.classList.add('cvh-panel-visible');
  }

  /**
   * Update panel for a new element
   */
  function updatePanel(element) {
    currentElement = element;
    updatePreview();
  }

  /**
   * Hide and remove the panel
   */
  function hidePanel() {
    if (panel) {
      panel.classList.remove('cvh-panel-visible');
      panel.remove();
      panel = null;
    }
    currentElement = null;
    onCopy = null;
    onCancel = null;
    onParent = null;
    onSelectElement = null;
    highlightCallback = null;
    elementRegistry.clear();
  }

  /**
   * Show a temporary "Copied!" notification
   */
  function showCopiedNotification() {
    const notification = document.createElement('div');
    notification.className = 'cvh-notification';
    notification.textContent = 'Copied!';
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('cvh-notification-fade');
      setTimeout(() => notification.remove(), 300);
    }, 1000);
  }

  // Export functions
  window.CopyVisibleHTML.showPanel = showPanel;
  window.CopyVisibleHTML.updatePanel = updatePanel;
  window.CopyVisibleHTML.hidePanel = hidePanel;
  window.CopyVisibleHTML.showCopiedNotification = showCopiedNotification;
})();
