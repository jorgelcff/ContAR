import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';

// Modal that shows a printable/downloadable QR code for a published story.
// Scanning the QR opens the story's public /story/:id page in a phone browser,
// so the author can print it and stick it somewhere for end users to scan.
export default function StoryQrModal({ url, title, onClose }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);

  const storyTitle = title?.trim() || t('qrModalTitle');

  const getDataUrl = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : '';
  };

  const handleDownload = () => {
    const dataUrl = getDataUrl();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${storyTitle.replace(/[^\w-]+/g, '_').slice(0, 40) || 'historia'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Print in an isolated window so the printed page is just the QR card — no app
  // chrome, no global print-CSS juggling. The QR is embedded as a PNG data URL.
  const handlePrint = () => {
    const dataUrl = getDataUrl();
    if (!dataUrl) return;
    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) return;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(storyTitle)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { text-align: center; padding: 40px; max-width: 520px; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .scan { font-size: 16px; color: #333; margin: 0 0 20px; }
  img { width: 320px; height: 320px; image-rendering: pixelated; }
  .url { margin-top: 18px; font-family: ui-monospace, monospace; font-size: 12px;
         color: #555; word-break: break-all; }
  @media print { @page { margin: 16mm; } }
</style></head>
<body>
  <div class="card">
    <h1>${esc(storyTitle)}</h1>
    <p class="scan">${esc(t('qrScanToView'))}</p>
    <img src="${dataUrl}" alt="QR Code" onload="window.focus();window.print();" />
    <p class="url">${esc(url)}</p>
  </div>
</body></html>`);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">{storyTitle}</h2>
          <p className="mt-1 text-xs text-gray-400">{t('qrInstructions')}</p>
        </div>

        {/* QR preview (also the source canvas for print/download) */}
        <div ref={canvasRef} className="rounded-2xl bg-white p-4">
          <QRCodeCanvas
            value={url}
            size={1024}
            level="M"
            marginSize={2}
            style={{ width: 220, height: 220 }}
          />
        </div>

        <p className="text-[10px] font-mono text-gray-500 break-all text-center">{url}</p>

        <div className="grid w-full grid-cols-2 gap-2">
          <button
            onClick={handlePrint}
            className="col-span-2 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors"
          >
            🖨 {t('qrPrint')}
          </button>
          <button
            onClick={handleDownload}
            className="py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
          >
            ⬇ {t('qrDownload')}
          </button>
          <button
            onClick={onClose}
            className="py-2 rounded-xl border border-gray-700 hover:bg-gray-800 text-gray-300 text-sm transition-colors"
          >
            {t('qrClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
