document.getElementById("play").addEventListener("click", () => {
    const audio = new Audio(chrome.runtime.getURL("sound.mp3"));
    audio.play();
});
