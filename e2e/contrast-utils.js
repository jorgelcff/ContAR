// Resolves a WCAG contrast ratio between an element's text color and its
// nearest ancestor with a solid (non-transparent) background — evaluated
// in-browser so it works for any CSS color function (oklch, rgb, named).
// Only reliable for elements sitting on a solid background-color; elements
// painted via background-image gradients need a different approach.
async function contrastRatioOf(locator) {
  return locator.evaluate((el) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    function normalize(colorStr) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    }
    function blend(fg, bg) {
      const a = fg.a;
      return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
    }
    function srgbToLin(c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function luminance(c) {
      return 0.2126 * srgbToLin(c.r) + 0.7152 * srgbToLin(c.g) + 0.0722 * srgbToLin(c.b);
    }

    const style = getComputedStyle(el);
    const fgRaw = normalize(style.color);

    let bg = { r: 255, g: 255, b: 255 };
    let cur = el;
    const chain = [];
    while (cur) {
      chain.push(getComputedStyle(cur).backgroundColor);
      cur = cur.parentElement;
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      const c = normalize(chain[i]);
      if (c.a > 0) bg = blend(c, bg);
    }
    const fg = fgRaw.a < 1 ? blend(fgRaw, bg) : fgRaw;

    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (lighter + 0.05) / (darker + 0.05);
  });
}

module.exports = { contrastRatioOf };
