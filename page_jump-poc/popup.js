document.getElementById("jumpBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const searchText = document.getElementById("searchText").value;

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: jumpToText,
        args: [searchText]
    });
});

function jumpToText(searchText) {
    if (!searchText) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        if (node.nodeValue.includes(searchText)) {
            const el = node.parentElement;
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.style.backgroundColor = "yellow"; // temporary highlight
            break; // ✅ stops at first occurrence
        }
    }
}
