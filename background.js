// Create context menu item on install
browser.contextMenus.create({
  id: "copy-visible-html",
  title: "Copy Visible HTML",
  contexts: ["page", "selection", "image", "link"]
});

// Handle context menu click
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "copy-visible-html") {
    // Inject CSS first, then scripts
    await browser.tabs.insertCSS(tab.id, {
      file: "content/picker.css"
    });
    
    // Inject scripts in order
    await browser.tabs.executeScript(tab.id, {
      file: "content/extractor.js"
    });
    await browser.tabs.executeScript(tab.id, {
      file: "content/ui.js"
    });
    await browser.tabs.executeScript(tab.id, {
      file: "content/picker.js"
    });
  }
});
