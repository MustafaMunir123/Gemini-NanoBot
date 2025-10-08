(() => {
    // Only inject if not already injected
    if (window.__floatingWidgetInjected) return;

    // Read switch state from chrome.storage
    chrome.storage.local.get(["widgetEnabled"], (result) => {
        if (!result.widgetEnabled) return;

        window.__floatingWidgetInjected = true;

        // Create the floating widget
        const widget = document.createElement("div");
        widget.id = "floating-widget";
        widget.innerHTML = `
    <div id="widget-header">
      <span>Floating Widget</span>
      <button id="close-widget">×</button>
    </div>
    <div id="widget-buttons">
      <button id="btn-switch">Switch</button>
      <button id="btn-action">Action</button>
    </div>
  `;
        document.body.appendChild(widget);

        // Styles
        const style = document.createElement("style");
        style.textContent = `
    #floating-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 200px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: sans-serif;
      user-select: none;
    }
    #widget-header {
      background: #007bff;
      color: white;
      padding: 8px;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
    }
    #widget-header button {
      background: transparent;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
    }
    #widget-buttons {
      padding: 10px;
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    #widget-buttons button {
      padding: 6px 10px;
      border-radius: 8px;
      border: none;
      background: #007bff;
      color: white;
      cursor: pointer;
      font-size: 13px;
      transition: 0.2s;
    }
    #widget-buttons button:hover {
      background: #0056b3;
    }
  `;
        document.head.appendChild(style);

        // Close button
        document.getElementById("close-widget").addEventListener("click", () => {
            widget.remove();
            window.__floatingWidgetInjected = false;
        });

        // Example button actions
        document.getElementById("btn-switch").addEventListener("click", () => {
            alert("Switch button clicked!");
        });
        document.getElementById("btn-action").addEventListener("click", () => {
            alert("Action button clicked!");
        });

        // Draggable functionality
        let isDragging = false, offsetX, offsetY;
        const header = document.getElementById("widget-header");

        header.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - widget.getBoundingClientRect().left;
            offsetY = e.clientY - widget.getBoundingClientRect().top;
            document.body.style.userSelect = "none";
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging) {
                widget.style.left = e.clientX - offsetX + "px";
                widget.style.top = e.clientY - offsetY + "px";
                widget.style.bottom = "auto";
                widget.style.right = "auto";
            }
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            document.body.style.userSelect = "auto";
        });
    });
})();
