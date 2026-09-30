/**
 * Split extracted text into overlapping chunks for search. Paragraph
 * boundaries are preferred; very long paragraphs fall back to sentence and
 * then hard splits. ~1,200 characters keeps gte-small (512 tokens) happy.
 */
export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const pieces: string[] = [];
  for (const para of clean.split(/\n\n+/)) {
    if (para.length <= size) {
      pieces.push(para);
      continue;
    }
    let buf = "";
    for (const sentence of para.split(/(?<=[.!?;:])\s+/)) {
      if (sentence.length > size) {
        if (buf) pieces.push(buf), (buf = "");
        for (let i = 0; i < sentence.length; i += size - overlap) pieces.push(sentence.slice(i, i + size));
      } else if ((buf + " " + sentence).length > size) {
        pieces.push(buf);
        buf = sentence;
      } else buf = buf ? `${buf} ${sentence}` : sentence;
    }
    if (buf) pieces.push(buf);
  }
  // Pack small pieces together, carrying the tail of each chunk forward.
  const chunks: string[] = [];
  let cur = "";
  for (const p of pieces) {
    if (cur && (cur + "\n\n" + p).length > size) {
      chunks.push(cur);
      const tail = cur.slice(-overlap);
      cur = tail.length < overlap ? p : `${tail.slice(tail.indexOf(" ") + 1)}\n\n${p}`;
      if (cur.length > size) cur = p;
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
