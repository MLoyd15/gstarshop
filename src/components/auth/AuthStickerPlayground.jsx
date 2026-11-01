import { useRef, useState } from 'react';

const INITIAL_STICKERS = [
  { id: 'g4', w: 140, h: 140, kind: 'circle', fill: '#EC008C', text: 'G4', textColor: '#FFD500', fontSize: 54, textY: 89, left: 5, top: 14, rot: -8 },
  { id: 'new', w: 140, h: 140, kind: 'star', fill: '#FFD500', text: 'NEW', textColor: '#14121F', fontSize: 30, textY: 81, left: 80, top: 9, rot: 12 },
  { id: 'signage', w: 210, h: 100, kind: 'rect', fill: '#00AEEF', text: 'SIGNAGE', textColor: '#FFFFFF', fontSize: 30, textY: 61, left: 7, top: 68, rot: -5 },
  { id: 'tarpaulin', w: 180, h: 120, kind: 'rect', fill: '#FFD500', text: 'TARPAULIN', textColor: '#14121F', fontSize: 21, textY: 68, left: 77, top: 56, rot: 6 },
  { id: 'decals', w: 200, h: 96, kind: 'pill', fill: '#14121F', text: 'DECALS', textColor: '#FFFFFF', fontSize: 32, textY: 60, left: 66, top: 82, rot: -10 },
];

const starPoints = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 ? 46 : 60;
  const rad = (Math.PI * i) / 14;
  return `${(70 + r * Math.sin(rad)).toFixed(1)},${(70 - r * Math.cos(rad)).toFixed(1)}`;
}).join(' ');

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

  function resetStickers() {
    setPositions(
      INITIAL_STICKERS.reduce((acc, s) => {
        acc[s.id] = { left: s.left, top: s.top, rot: s.rot };
        return acc;
      }, {})
    );
  }

  return (
    <div className="auth-sticker-playground" aria-hidden="true">
      {INITIAL_STICKERS.map((s) => {
        const pos = positions[s.id] || { left: s.left, top: s.top, rot: s.rot };
        const isDragging = dragId === s.id;
        return (
          <div
            key={s.id}
            className={`auth-stk${isDragging ? ' drag' : ''}`}
            style={{
              '--w': `${s.w}px`,
              '--r': `${pos.rot}deg`,
              left: `${pos.left}%`,
              top: `${pos.top}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, s)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={() => handleDoubleClick(s.id)}
          >
            <svg viewBox={`0 0 ${s.w} ${s.h}`} aria-hidden="true">
              {s.kind === 'circle' && (
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  fill={s.fill}
                  stroke="#fff"
                  strokeWidth="14"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
              )}
              {s.kind === 'star' && (
                <polygon
                  points={starPoints}
                  fill={s.fill}
                  stroke="#fff"
                  strokeWidth="14"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
              )}
              {s.kind === 'rect' && (
                <rect
                  x="12"
                  y="12"
                  width={s.w - 24}
                  height={s.h - 24}
                  rx="14"
                  fill={s.fill}
                  stroke="#fff"
                  strokeWidth="14"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
              )}
              {s.kind === 'pill' && (
                <rect
                  x="12"
                  y="12"
                  width={s.w - 24}
                  height={s.h - 24}
                  rx={(s.h - 24) / 2}
                  fill={s.fill}
                  stroke="#fff"
                  strokeWidth="14"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
              )}
              <text
                x={s.w / 2}
                y={s.textY}
                textAnchor="middle"
                fontSize={s.fontSize}
                fill={s.textColor}
                fontFamily="Bowlby One, Impact, sans-serif"
              >
                {s.text}
              </text>
            </svg>
          </div>
        );
      })}
      <button
        className="auth-pill auth-reset-btn"
        type="button"
        tabIndex={-1}
        onClick={resetStickers}
      >
        Reset stickers
      </button>
    </div>
  );
}
