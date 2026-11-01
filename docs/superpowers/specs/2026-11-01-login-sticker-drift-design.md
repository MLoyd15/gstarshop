# Login Sticker Drift Design

## Intent

Add subtle ambient motion to the login page stickers so the page feels lively while the login card remains the visual focus and the stickers remain draggable.

## Goals

- Give one or two focal stickers a slow, staggered vertical float with only a slight rotation; keep the others still.
- Pause the sticker being dragged so pointer movement remains precise.
- Respect `prefers-reduced-motion` by disabling ambient animation.

## Non-goals

- Animate or tilt the login card.
- Add new controls, libraries, or more stickers.
- Make the stickers travel across the screen on their own.

## Approaches

- **Limited gentle drift (chosen):** CSS keyframes give one or two focal stickers a small, staggered bob; each pauses during drag. This adds ongoing motion without animating every sticker, shifting the layout, or interfering with the form.
- **Entrance-only animation:** stickers animate in once and then stop. This is calmer, but does not deliver the requested moving-sticker feel after the page loads.
- **Automatic screen travel:** stickers roam independently. This is more eye-catching but risks obscuring the form and fighting the existing drag behavior.

## Constraints and implementation calls

- Keep the existing React pointer-drag behavior and CSS animation approach; no dependency is needed.
- Use a low-amplitude, long-duration motion on at most two focal stickers and preserve each sticker's current rotation.
- Pause animation on `.is-dragging` and disable it under `prefers-reduced-motion: reduce`.
