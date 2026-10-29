import { useRef, useState } from 'react';

const stickers = [
  { id: 'print', style: 'cyan', label: 'PRINT BOLD', lines: ['PRINT', 'BOLD'] },
  { id: 'studio', style: 'blue', label: 'G4 STUDIO', lines: ['G4', 'STUDIO'] },
  { id: 'standout', style: 'outline', label: 'MADE TO STAND OUT', lines: ['MADE TO', 'STAND OUT'] },
];

export default function AuthStickerPlayground() {
  const [positions, setPositions] = useState({});
  const drag = useRef(null);

  function startDrag(event, id) {
    if (event.button !== 0) return;
    const sticker = event.currentTarget;
    const stack = sticker.parentElement;
    const current = positions[id] || { x: sticker.offsetLeft, y: sticker.offsetTop };
    drag.current = {
      id,
      pointerId: event.pointerId,
      offsetX: event.clientX - stack.getBoundingClientRect().left - current.x,
      offsetY: event.clientY - stack.getBoundingClientRect().top - current.y,
    };
    sticker.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const sticker = event.currentTarget;
    const stack = sticker.parentElement;
    const bounds = stack.getBoundingClientRect();
    const x = Math.min(stack.clientWidth - sticker.offsetWidth, Math.max(0, event.clientX - bounds.left - active.offsetX));
    const y = Math.min(stack.clientHeight - sticker.offsetHeight, Math.max(0, event.clientY - bounds.top - active.offsetY));
    setPositions((current) => ({ ...current, [active.id]: { x, y } }));
  }

  function stopDrag(event) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  function moveByKeyboard(event, sticker) {
    const deltas = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const stack = event.currentTarget.parentElement;
    const current = positions[sticker.id] || { x: event.currentTarget.offsetLeft, y: event.currentTarget.offsetTop };
    const step = event.shiftKey ? 20 : 8;
    setPositions((value) => ({ ...value, [sticker.id]: {
      x: Math.min(stack.clientWidth - event.currentTarget.offsetWidth, Math.max(0, current.x + delta[0] * step)),
      y: Math.min(stack.clientHeight - event.currentTarget.offsetHeight, Math.max(0, current.y + delta[1] * step)),
    } }));
  }

  return <div className="auth-sticker-stack" aria-label="Decorative stickers. Drag to move, or focus one and use the arrow keys.">
    {stickers.map((sticker) => <span key={sticker.id} className={`auth-sticker auth-sticker-${sticker.style}`} style={positions[sticker.id] ? { left: positions[sticker.id].x, top: positions[sticker.id].y } : undefined} role="button" tabIndex={0} aria-label={`Move ${sticker.label} sticker`} onPointerDown={(event) => startDrag(event, sticker.id)} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onKeyDown={(event) => moveByKeyboard(event, sticker)}><span>{sticker.lines[0]}<br/>{sticker.lines[1]}</span></span>)}
  </div>;
}
