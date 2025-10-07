document.getElementById("rewriteBtn").addEventListener("click", async () => {
    const inputText = document.getElementById("inputText").value.trim();
    const instructions = document.getElementById("instructions").value.trim();
    const outputDiv = document.getElementById("output");

    outputDiv.textContent = "";

    if (!inputText) {
        outputDiv.textContent = "Please enter some text.";
        return;
    }

    if (!("Rewriter" in window)) {
        outputDiv.textContent = "Rewriter API is not available in this browser.";
        return;
    }

    if (typeof LanguageModel === undefined) {
        outputDiv.textContent = "Prompt (language model) API not available in this browser.";
        return;
    }

    try {
        outputDiv.textContent = "Checking model availability...";

        const modelAvailability = await LanguageModel.availability();
        if (modelAvailability === "unavailable") {
            outputDiv.textContent = "Language model unavailable. Enable #prompt-api-for-gemini-nano in chrome://flags.";
            return;
        }

        const session = await LanguageModel.create({
            outputLanguage: 'en',
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    console.log(`Downloaded ${e.loaded * 100}%`);
                });
            },
        });

        const tonePrompt = `
        You are a tone analyzer. Based on the following user instruction, determine whether it suggests a tone change.
        Respond with exactly one label from the following list:
        "more-formal", "more-casual", or "as-is".
        If no tone suggestion is found, respond strictly with "as-is".
        
        Instruction: "${instructions}"
      `;

        outputDiv.textContent = "Analyzing instruction tone...";
        const toneResponse = await session.prompt(tonePrompt, {
            outputLanguage: 'en'
        });
        const toneText = toneResponse.trim().toLowerCase();
        session.destroy();

        let tone = "as-is";
        if (["more-formal", "more-casual", "as-is"].includes(toneText)) {
            tone = toneText;
        } else {
            console.log("Unexpected tone response:", toneText);
            tone = "as-is";
        }

        outputDiv.textContent = `Detected tone: ${tone}\n\nPreparing Rewriter...`;

        const availability = await Rewriter.availability();
        if (availability === "unavailable") {
            outputDiv.textContent = "Rewriter API unavailable.";
            return;
        }

        const rewriter = await Rewriter.create({
            tone: tone,
            format: "plain-text",
            length: "as-is",
            monitor(monitor) {
                monitor.addEventListener("downloadprogress", e => {
                    outputDiv.textContent = `Downloading model... ${Math.floor((e.loaded / e.total) * 100)}%`;
                });
            }
        });

        outputDiv.textContent = "Rewriting in progress...";
        const result = await rewriter.rewrite(inputText, {
            outputLanguage: 'en',
            context: instructions || "Rewrite the text clearly."
        });

        outputDiv.textContent = `✅ Rewritten Text (Tone: ${tone}):\n\n${result}`;
        console.log("Rewritten output:", result);

        rewriter.destroy();

    } catch (err) {
        console.error(err);
        outputDiv.textContent = "Error: " + err.message;
    }
});
