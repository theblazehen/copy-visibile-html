// Visibility detection and HTML extraction/stripping
window.CopyVisibleHTML = window.CopyVisibleHTML || {};

(function() {
  'use strict';

  // Attributes to preserve (semantic/content-relevant)
  const KEEP_ATTRIBUTES = new Set([
    'href', 'src', 'alt', 'title', 'type', 'name', 'value', 'placeholder',
    'for', 'action', 'method', 'target', 'rel', 'colspan', 'rowspan',
    'headers', 'scope', 'datetime', 'cite', 'lang', 'dir'
  ]);

  // Elements to strip entirely
  const STRIP_ELEMENTS = new Set([
    'script', 'style', 'noscript', 'svg', 'canvas', 'template',
    'iframe', 'object', 'embed', 'applet'
  ]);

  /**
   * Check if an element is visible
   * Excludes: display:none, visibility:hidden, opacity:0, zero dimensions
   * Includes: scrolled out of view, z-index occluded
   */
  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return true; // text nodes, comments, etc.
    
    const style = getComputedStyle(el);
    
    // Check CSS visibility properties
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    
    // Check dimensions
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    
    return true;
  }

  /**
   * Strip attributes from an element, keeping only semantic ones
   */
  function stripAttributes(el) {
    if (!(el instanceof HTMLElement)) return;
    
    const toRemove = [];
    for (const attr of el.attributes) {
      if (!KEEP_ATTRIBUTES.has(attr.name.toLowerCase())) {
        toRemove.push(attr.name);
      }
    }
    for (const name of toRemove) {
      el.removeAttribute(name);
    }
  }

  /**
   * Recursively process a cloned node, removing hidden elements and stripping attributes
   * @param {Node} cloneNode - The cloned node to process
   * @param {Node} originalNode - The corresponding original node (for visibility checks)
   * @returns {boolean} - Whether this node should be kept
   */
  function processNode(cloneNode, originalNode) {
    // Handle text nodes - keep if not empty
    if (cloneNode.nodeType === Node.TEXT_NODE) {
      return cloneNode.textContent.trim().length > 0;
    }

    // Handle comments - remove
    if (cloneNode.nodeType === Node.COMMENT_NODE) {
      return false;
    }

    // Handle elements
    if (cloneNode.nodeType === Node.ELEMENT_NODE) {
      const tagName = cloneNode.tagName.toLowerCase();

      // Strip blacklisted elements entirely
      if (STRIP_ELEMENTS.has(tagName)) {
        return false;
      }

      // Check visibility on original element
      if (!isVisible(originalNode)) {
        return false;
      }

      // Strip attributes
      stripAttributes(cloneNode);

      // Process children
      const cloneChildren = Array.from(cloneNode.childNodes);
      const originalChildren = Array.from(originalNode.childNodes);

      for (let i = cloneChildren.length - 1; i >= 0; i--) {
        const cloneChild = cloneChildren[i];
        const originalChild = originalChildren[i];

        if (originalChild && !processNode(cloneChild, originalChild)) {
          cloneNode.removeChild(cloneChild);
        } else if (!originalChild) {
          // Safety: remove if no corresponding original
          cloneNode.removeChild(cloneChild);
        }
      }

      return true;
    }

    // Remove other node types
    return false;
  }

  /**
   * Extract visible, stripped HTML from an element
   * @param {HTMLElement} element - The element to extract from
   * @returns {string} - Cleaned HTML string
   */
  function extractVisibleHTML(element) {
    const clone = element.cloneNode(true);
    processNode(clone, element);
    return clone.outerHTML;
  }

  // Block-level elements that should have spacing
  const BLOCK_ELEMENTS = new Set([
    'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre',
    'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'
  ]);

  /**
   * Extract visible text content from an element with proper spacing
   * @param {HTMLElement} element - The element to extract from
   * @returns {string} - Text content with spacing between block elements
   */
  function extractVisibleText(element) {
    const clone = element.cloneNode(true);
    processNode(clone, element);
    
    const parts = [];
    
    function walkNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          parts.push(text);
        }
        return;
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const isBlock = BLOCK_ELEMENTS.has(tag);
        
        // Add spacing before block elements
        if (isBlock && parts.length > 0) {
          parts.push('\n');
        }
        
        // Process children
        for (const child of node.childNodes) {
          walkNode(child);
        }
        
        // Add spacing after block elements
        if (isBlock && parts.length > 0 && parts[parts.length - 1] !== '\n') {
          parts.push('\n');
        }
      }
    }
    
    walkNode(clone);
    
    // Join and clean up
    return parts.join(' ')
      .replace(/ *\n */g, '\n')      // Clean spaces around newlines
      .replace(/\n{3,}/g, '\n\n')    // Max 2 newlines
      .replace(/ {2,}/g, ' ')        // Collapse multiple spaces
      .trim();
  }

  // Export functions
  window.CopyVisibleHTML.isVisible = isVisible;
  window.CopyVisibleHTML.extractVisibleHTML = extractVisibleHTML;
  window.CopyVisibleHTML.extractVisibleText = extractVisibleText;
})();
