import { parseTXT } from './parser/txtParser.js';
import { parseDOCX } from './parser/docxParser.js';
import { parsePDF } from './parser/pdfParser.js';

const fileInput = document.getElementById("fileInput");
const parseBtn = document.getElementById("parseBtn");
const result = document.getElementById("result");

parseBtn.addEventListener("click", async () => {
  try {
    if (!fileInput.files.length) return alert("Upload a file first");
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop().toLowerCase();

    let text = "";
    if (ext === "txt") text = await parseTXT(file);
    else if (ext === "docx") text = await parseDOCX(file);
    else if (ext === "pdf") text = await parsePDF(file);
    else throw new Error("Unsupported file type: " + ext);

    result.textContent = text.slice(0, 10000); // limit preview

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: "parsed_resume.txt" });

  } catch (err) {
    console.error(err);
    alert("Error: " + (err.message || err));
  }
});
