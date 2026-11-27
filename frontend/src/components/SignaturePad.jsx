// frontend/src/components/SignaturePad.jsx — sign with a finger or mouse; gives a PNG data URL
import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';

export default function SignaturePad({ onChange, height = 180 }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const ink = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = height * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#101E37';
  }, [height]);

  const point = e => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = e => {
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = e => {
    if (!drawing.current) return;
    const p = point(e);
    const ctx = ref.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!ink.current) { ink.current = true; setEmpty(false); }
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (ink.current) onChange(ref.current.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    ink.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="sigpad">
      <canvas ref={ref} style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
      <div className="sigpad-foot">
        <span className="tiny faint">{empty ? t("Sign inside the box") : ''}</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>{t("Clear")}</button>
      </div>
    </div>
  );
}
