// Element picker logic - inspired by uBlock Origin's approach
(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.CopyVisibleHTML && window.CopyVisibleHTML.pickerActive) {
    return;
  }
  window.CopyVisibleHTML = window.CopyVisibleHTML || {};
  window.CopyVisibleHTML.pickerActive = true;

  const pickerUniqueId = 'cvh-' + Math.random().toString(36).slice(2, 8);

  let highlightOverlay = null;
  let breadcrumbBar = null;
  let hoveredElement = null;
  let selectedElement = null;
  let isSelectionLocked = false;

  /**
   * Create the highlight overlay element
   */
  function createOverlay() {
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'cvh-highlight';
    highlightOverlay.setAttribute(pickerUniqueId, '');
    document.documentElement.appendChild(highlightOverlay);
  }

  /**
   * Create the breadcrumb bar showing element hierarchy
   */
  function createBreadcrumbBar() {
    breadcrumbBar = document.createElement('div');
    breadcrumbBar.id = 'cvh-breadcrumb';
    breadcrumbBar.setAttribute(pickerUniqueId, '');
    document.documentElement.appendChild(breadcrumbBar);
  }

  /**
   * Generate a short label for an element
   */
  function getElementLabel(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string' 
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') 
      : '';
    
    let label = tag + id;
    if (!id && classes && classes !== '.') {
      label += classes.substring(0, 20);
    }
    return label;
  }

  /**
   * Update breadcrumb bar with element hierarchy
   */
  function updateBreadcrumb(element) {
    if (!breadcrumbBar || !element) return;

    // Build ancestor chain (up to 5 levels)
    const chain = [];
    let el = element;
    while (el && el !== document.body && chain.length < 5) {
      chain.unshift(el);
      el = el.parentElement;
    }

    // Create breadcrumb using DOM methods (safe)
    breadcrumbBar.textContent = '';
    chain.forEach((el, i) => {
      const isLast = i === chain.length - 1;
      const label = getElementLabel(el);
      
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'cvh-crumb-sep';
        sep.textContent = '›';
        breadcrumbBar.appendChild(sep);
      }
      
      const crumb = document.createElement('span');
      crumb.className = isLast ? 'cvh-crumb cvh-crumb-active' : 'cvh-crumb';
      crumb.textContent = label;
      breadcrumbBar.appendChild(crumb);
    });

    breadcrumbBar.style.display = 'block';
  }

  /**
   * Position the overlay over an element
   */
  function positionOverlay(element) {
    if (!element || !highlightOverlay) return;

    const rect = element.getBoundingClientRect();
    highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.display = 'block';

    // Update breadcrumb
    updateBreadcrumb(element);
  }

  /**
   * Get element at point, excluding our UI elements
   * Uses the "clickblind" technique from uBlock Origin
   */
  function elementFromPoint(x, y) {
    // Temporarily make our elements invisible to hit testing
    const clickblindAttr = `${pickerUniqueId}-clickblind`;
    
    if (highlightOverlay) highlightOverlay.setAttribute(clickblindAttr, '');
    if (breadcrumbBar) breadcrumbBar.setAttribute(clickblindAttr, '');
    
    const panel = document.getElementById('cvh-panel');
    if (panel) panel.setAttribute(clickblindAttr, '');

    // Get all elements at this point
    const elements = document.elementsFromPoint(x, y);
    
    // Remove clickblind
    if (highlightOverlay) highlightOverlay.removeAttribute(clickblindAttr);
    if (breadcrumbBar) breadcrumbBar.removeAttribute(clickblindAttr);
    if (panel) panel.removeAttribute(clickblindAttr);

    // Find first valid element (not our UI, not html/body)
    for (const elem of elements) {
      if (elem.hasAttribute(pickerUniqueId)) continue;
      if (elem.id === 'cvh-panel' || elem.closest('#cvh-panel')) continue;
      if (elem === document.body || elem === document.documentElement) continue;
      return elem;
    }

    return null;
  }

  /**
   * Handle mouse movement - highlight element under cursor
   */
  function handleMouseMove(e) {
    if (isSelectionLocked) return;

    const element = elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    hoveredElement = element;
    positionOverlay(element);
  }

  /**
   * Handle element selection from tree view
   */
  function handleSelectElement(el) {
    selectedElement = el;
    positionOverlay(el);
    window.CopyVisibleHTML.updatePanel(el);
  }

  /**
   * Handle hover highlight from tree view
   */
  function handleHighlight(el) {
    positionOverlay(el);
  }

  /**
   * Lock/unlock the current selection
   */
  function lockSelection() {
    if (!hoveredElement) return;

    selectedElement = hoveredElement;
    isSelectionLocked = true;
    highlightOverlay.classList.add('cvh-highlight-locked');

    // Show the panel with all callbacks including tree interactions
    window.CopyVisibleHTML.showPanel(selectedElement, {
      onCopy: handleCopy,
      onCancel: cleanup,
      onParent: handleParent,
      onSelectElement: handleSelectElement,
      onHighlight: handleHighlight
    });
  }

  /**
   * Universal event killer - captures events at window level
   * This is more aggressive than document-level capture
   */
  function eventKiller(e) {
    // Allow events on our UI
    if (e.target.closest && (
      e.target.closest('#cvh-panel') ||
      e.target.hasAttribute && e.target.hasAttribute(pickerUniqueId)
    )) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Handle specific events
    if (e.type === 'mousedown' || e.type === 'pointerdown') {
      if (e.button === 0 && !isSelectionLocked) {
        lockSelection();
      }
    }

    return false;
  }

  /**
   * Handle keyboard events
   */
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    }
  }

  /**
   * Handle parent button - select parent element
   */
  function handleParent() {
    if (!selectedElement || !selectedElement.parentElement) return;
    
    // Don't go above body
    if (selectedElement.parentElement === document.documentElement) return;

    selectedElement = selectedElement.parentElement;
    positionOverlay(selectedElement);
    window.CopyVisibleHTML.updatePanel(selectedElement);
  }

  /**
   * Handle copy - copy content to clipboard
   */
  async function handleCopy(mode) {
    if (!selectedElement) return;

    let content;
    if (mode === 'html') {
      content = window.CopyVisibleHTML.extractVisibleHTML(selectedElement);
    } else {
      content = window.CopyVisibleHTML.extractVisibleText(selectedElement);
    }

    try {
      await navigator.clipboard.writeText(content);
      window.CopyVisibleHTML.showCopiedNotification();
      cleanup();
    } catch (err) {
      console.error('Copy failed:', err);
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      window.CopyVisibleHTML.showCopiedNotification();
      cleanup();
    }
  }

  /**
   * Clean up and remove picker
   */
  function cleanup() {
    // Remove all event listeners
    const events = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
    events.forEach(evt => {
      window.removeEventListener(evt, eventKiller, true);
    });
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('keydown', handleKeyDown, true);

    // Remove overlay
    if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }

    // Remove breadcrumb bar
    if (breadcrumbBar) {
      breadcrumbBar.remove();
      breadcrumbBar = null;
    }

    // Hide panel
    window.CopyVisibleHTML.hidePanel();

    // Remove clickblind style
    const style = document.getElementById('cvh-clickblind-style');
    if (style) style.remove();

    // Reset state
    hoveredElement = null;
    selectedElement = null;
    isSelectionLocked = false;
    window.CopyVisibleHTML.pickerActive = false;
  }

  /**
   * Find the common ancestor element that contains the current text selection
   */
  function getSelectionContainer() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;

    // If it's a text node, get its parent element
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    // Make sure it's a valid element (not body/html)
    if (!container || container === document.body || container === document.documentElement) {
      return null;
    }

    return container;
  }

  /**
   * Initialize the picker
   */
  function init() {
    // Check if there's a text selection - if so, auto-select that container
    const selectionContainer = getSelectionContainer();
    if (selectionContainer) {
      // Clear the selection so it doesn't interfere
      window.getSelection().removeAllRanges();
      
      // Auto-select the container
      hoveredElement = selectionContainer;
      selectedElement = selectionContainer;
      isSelectionLocked = true;
    }

    // Inject clickblind CSS rule (like uBO does)
    const style = document.createElement('style');
    style.id = 'cvh-clickblind-style';
    style.textContent = `[${pickerUniqueId}-clickblind] { pointer-events: none !important; }`;
    document.head.appendChild(style);

    createOverlay();
    createBreadcrumbBar();

    // If we auto-selected from text selection, show panel immediately
    if (isSelectionLocked && selectedElement) {
      highlightOverlay.classList.add('cvh-highlight-locked');
      positionOverlay(selectedElement);
      window.CopyVisibleHTML.showPanel(selectedElement, {
        onCopy: handleCopy,
        onCancel: cleanup,
        onParent: handleParent,
        onSelectElement: handleSelectElement,
        onHighlight: handleHighlight
      });
    }

    // Capture ALL click-like events at window level (most aggressive)
    const events = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
    events.forEach(evt => {
      window.addEventListener(evt, eventKiller, true);
    });

    // Mouse move for highlighting
    document.addEventListener('mousemove', handleMouseMove, true);
    
    // Keyboard
    document.addEventListener('keydown', handleKeyDown, true);
  }

  // Start the picker
  init();
})();
