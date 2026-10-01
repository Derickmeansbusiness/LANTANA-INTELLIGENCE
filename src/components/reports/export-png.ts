/**
 * Save an on-screen SVG chart as a PNG in the current theme. CSS variables
 * and classes don't survive serialisation, so each element's computed paint
 * and font are inlined first; the card background is painted underneath.
 */
export async function svgToPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = svg.querySelectorAll<SVGElement>("*");
  const to = clone.querySelectorAll<SVGElement>("*");
  from.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const d = to[i];
    for (const p of ["fill", "stroke", "stroke-width", "opacity", "font-family", "font-size", "font-weight"]) d.style.setProperty(p, cs.getPropertyValue(p));
  });
  const vb = svg.viewBox.baseVal;
  const pad = 16;
  const w = vb.width + pad * 2;
  const h = vb.height + pad * 2;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));

  let bg = "";
  for (let el: Element | null = svg; el && !bg; el = el.parentElement) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) bg = c;
  }

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Couldn't draw the chart"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = bg || "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, pad, pad, vb.width, vb.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
