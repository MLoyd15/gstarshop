import { useRef, useState } from 'react';

const INITIAL_STICKERS = [
  { id: 'new', w: 110, h: 110, kind: 'star', fill: '#2FD0FF', text: 'NEW', textColor: '#060B1F', left: 82, top: 14, rot: 12 },
  { id: 'tarpaulin', w: 150, h: 70, kind: 'rect', fill: '#0A9CF4', text: 'TARPAULIN', textColor: '#060B1F', left: 78, top: 62, rot: 5 },
  { id: 'signage', w: 150, h: 70, kind: 'rect', fill: '#043CD4', text: 'SIGNAGE', textColor: '#FFFFFF', left: 8, top: 20, rot: -6 },
  { id: 'vinyl', w: 140, h: 66, kind: 'trapezoid', fill: '#042CAC', text: 'VINYL', textColor: '#2FD0FF', left: 9, top: 66, rot: 4 },
  { id: 'decals', w: 140, h: 64, kind: 'pill', fill: '#060B1F', text: 'DECALS', textColor: '#FFFFFF', left: 38, top: 84, rot: -8 },
  { id: 'custom', w: 132, h: 64, kind: 'pill', fill: '#0A9CF4', text: 'CUSTOM', textColor: '#060B1F', left: 2, top: 43, rot: 7 },
  { id: 'gloss', w: 112, h: 62, kind: 'rect', fill: '#E4E6EC', text: 'GLOSS', textColor: '#043CD4', left: 83, top: 39, rot: -7 },
  { id: 'fast', w: 102, h: 58, kind: 'trapezoid', fill: '#043CD4', text: 'FAST', textColor: '#FFFFFF', left: 13, top: 7, rot: -10 },
];

export default function AuthStickerPlayground() {
  const [positions, setPositions] = useState(() =>
    INITIAL_STICKERS.reduce((acc, s) => {
      acc[s.id] = { left: s.left, top: s.top, rot: s.rot };
      return acc;
    }, {})
  );
  const [dragId, setDragId] = useState(null);
  const dragRef = useRef(null);

  function handlePointerDown(event, sticker) {
    if (event.button !== 0) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      id: sticker.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    target.setPointerCapture(event.pointerId);
    setDragId(sticker.id);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const stickerEl = event.currentTarget;
    const container = stickerEl.closest('.auth-page') || stickerEl.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const w = stickerEl.offsetWidth;
    const h = stickerEl.offsetHeight;

    const x = Math.min(Math.max(event.clientX - bounds.left - drag.offsetX, -w * 0.3), bounds.width - w * 0.7);
    const y = Math.min(Math.max(event.clientY - bounds.top - drag.offsetY, -h * 0.3), bounds.height - h * 0.7);

    const leftPct = (x / bounds.width) * 100;
    const topPct = (y / bounds.height) * 100;

    setPositions((prev) => ({
      ...prev,
      [drag.id]: {
        ...prev[drag.id],
        left: leftPct,
        top: topPct,
      },
    }));
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragId(null);
    }
  }

  function handleDoubleClick(id) {
    setPositions((prev) => {
      const current = prev[id] || {};
      return {
        ...prev,
        [id]: {
          ...current,
          rot: ((current.rot || 0) + 25) % 360,
        },
      };
    });
  }

  return (
    <div className="auth-sticker-playground" aria-hidden="true">
      {INITIAL_STICKERS.map((s) => {
        const pos = positions[s.id] || { left: s.left, top: s.top, rot: s.rot };
        const isDragging = dragId === s.id;
        return (
          <div
            key={s.id}
            className={`auth-stk${isDragging ? ' is-dragging' : ''}`}
            style={{
              width: `${s.w}px`,
              transform: `rotate(${pos.rot}deg)`,
              left: `${pos.left}%`,
              top: `${pos.top}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, s)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={() => handleDoubleClick(s.id)}
          >
            {s.kind === 'star' && (
              <svg width={s.w} height={s.h} viewBox="0 0 100 100">
                <polygon
                  points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35"
                  fill={s.fill}
                  stroke="#FFFFFF"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <text
                  x="50"
                  y="58"
                  textAnchor="middle"
                  fontFamily="'Bowlby One', Impact, sans-serif"
                  fontSize="18"
                  fill={s.textColor}
                >
                  {s.text}
                </text>
              </svg>
            )}

            {s.kind === 'rect' && (
              <svg width={s.w} height={s.h} viewBox="0 0 150 70">
                <rect x="6" y="6" width="138" height="58" rx="14" fill={s.fill} stroke="#FFFFFF" strokeWidth="6" />
                <text
                  x="75"
                  y="43"
                  textAnchor="middle"
                  fontFamily="'Bowlby One', Impact, sans-serif"
                  fontSize={s.id === 'tarpaulin' ? '16' : '18'}
                  fill={s.textColor}
                >
                  {s.text}
                </text>
              </svg>
            )}

            {s.kind === 'trapezoid' && (
              <svg width={s.w} height={s.h} viewBox="0 0 140 66">
                <polygon points="12,6 128,6 134,60 6,60" fill={s.fill} stroke="#FFFFFF" strokeWidth="6" strokeLinejoin="round" />
                <text
                  x="70"
                  y="42"
                  textAnchor="middle"
                  fontFamily="'Bowlby One', Impact, sans-serif"
                  fontSize="19"
                  fill={s.textColor}
                >
                  {s.text}
                </text>
              </svg>
            )}

            {s.kind === 'pill' && (
              <svg width={s.w} height={s.h} viewBox="0 0 140 64">
                <rect x="6" y="6" width="128" height="52" rx="26" fill={s.fill} stroke="#FFFFFF" strokeWidth="5" />
                <text
                  x="70"
                  y="40"
                  textAnchor="middle"
                  fontFamily="'Bowlby One', Impact, sans-serif"
                  fontSize="18"
                  fill={s.textColor}
                >
                  {s.text}
                </text>
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
