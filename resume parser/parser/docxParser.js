export async function parseDOCX(file) {
  const mammoth = window.mammoth;
  if (!mammoth) throw new Error("Mammoth not loaded");

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}
