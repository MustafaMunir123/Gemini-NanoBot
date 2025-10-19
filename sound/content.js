chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "playSound") {
        const audio = new Audio(chrome.runtime.getURL("sound.mp3"));
        audio.play();
    }
});
