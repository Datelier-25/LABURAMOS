import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Recorte cuadrado para la foto de perfil. La imagen se puede arrastrar y
// acercar/alejar; el círculo muestra cómo va a quedar dentro del avatar.
export default function AvatarCropper({ file, onCancel, onDone }) {
  const SIZE = 300;
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drag = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setError('No pudimos abrir la imagen. Probá con otro archivo.');
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const metrics = (() => {
    if (!img) return null;
    const base = Math.max(SIZE / img.width, SIZE / img.height);
    const scale = base * zoom;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    return { drawW, drawH, maxX: Math.max(0, (drawW - SIZE) / 2), maxY: Math.max(0, (drawH - SIZE) / 2) };
  })();

  const draw = (ctx, size, factor = 1) => {
    if (!img || !metrics) return;
    const w = metrics.drawW * factor;
    const h = metrics.drawH * factor;
    const x = ((size - w) / 2) + offset.x * factor;
    const y = ((size - h) / 2) + offset.y * factor;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#eef1f8';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, x, y, w, h);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    draw(canvas.getContext('2d'), SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, zoom, offset]);

  const clampOffset = (next, m = metrics) => {
    if (!m) return next;
    return {
      x: Math.max(-m.maxX, Math.min(m.maxX, next.x)),
      y: Math.max(-m.maxY, Math.min(m.maxY, next.y)),
    };
  };

  const onPointerDown = (e) => {
    if (!img) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: offset };
  };

  const onPointerMove = (e) => {
    if (!drag.current || !metrics) return;
    const next = {
      x: drag.current.start.x + (e.clientX - drag.current.x),
      y: drag.current.start.y + (e.clientY - drag.current.y),
    };
    setOffset(clampOffset(next));
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const changeZoom = (value) => {
    const next = Number(value);
    setZoom(next);
    // Al alejar, volvemos a meter la imagen dentro del recuadro.
    if (!img) return;
    const base = Math.max(SIZE / img.width, SIZE / img.height) * next;
    const drawW = img.width * base;
    const drawH = img.height * base;
    setOffset((o) => clampOffset(o, { maxX: Math.max(0, (drawW - SIZE) / 2), maxY: Math.max(0, (drawH - SIZE) / 2) }));
  };

  const confirm = () => {
    if (!img || !metrics) return;
    setBusy(true);
    setError('');
    const out = document.createElement('canvas');
    const size = 512;
    out.width = size;
    out.height = size;
    const factor = size / SIZE;
    draw(out.getContext('2d'), size, factor);
    out.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onDone(blob);
        else setError('No pudimos recortar la imagen. Probá de nuevo.');
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="place-dlg avatar-crop" role="dialog" aria-modal="true" aria-label="Ajustar foto de perfil">
        <div className="place-head">
          <h2>Ajustá tu foto</h2>
          <button type="button" className="x-sm" onClick={onCancel} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="note">Arrastrá la imagen para encuadrarla y usá el control para acercarla o alejarla.</p>
        {error && <p className="note err">{error}</p>}
        <div className="avatar-crop-stage">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="avatar-crop-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <span className="avatar-crop-ring" aria-hidden="true" />
        </div>
        <label className="field">
          <span>Zoom</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => changeZoom(e.target.value)} />
        </label>
        <div className="two">
          <button type="button" className="btn btn-line" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-ink" onClick={confirm} disabled={busy || !img}>
            {busy ? 'Guardando…' : 'Usar esta foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
