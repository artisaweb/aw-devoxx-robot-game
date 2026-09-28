import * as THREE from 'three';

// Pure rendering — the actual copy (what a bubble says, and when) lives in
// src/text/ (attendeeDialogue.ts and friends) so it's all in one reviewable
// place, separate from this canvas/sprite plumbing.

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}

function createBubbleTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 176;
  const ctx = canvas.getContext('2d')!;

  const w = canvas.width;
  const bodyH = canvas.height - 32;
  const r = 24;

  // Rounded speech-bubble body with a small downward-pointing tail.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, bodyH - r);
  ctx.quadraticCurveTo(w, bodyH, w - r, bodyH);
  ctx.lineTo(w / 2 + 18, bodyH);
  ctx.lineTo(w / 2, canvas.height);
  ctx.lineTo(w / 2 - 18, bodyH);
  ctx.lineTo(r, bodyH);
  ctx.quadraticCurveTo(0, bodyH, 0, bodyH - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  wrapText(ctx, text, w / 2, bodyH / 2, w - 50, 38);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface SpeechBubble {
  readonly sprite: THREE.Sprite;
  /** Shows `text` for `duration` seconds, replacing whatever was already showing. */
  show(text: string, duration: number): void;
  update(dt: number): void;
  /** True while a message is still active (hasn't timed out) — independent of whether `.sprite` is actually visible. */
  hasMessage(): boolean;
}

/**
 * A camera-facing speech bubble, hidden until `show()` is called. Attach
 * `.sprite` above a character's head. Deliberately doesn't drive
 * `sprite.visible` itself beyond "is there a message" — a bubble a couple of
 * rooms away is unreadable anyway, so callers should gate actual visibility
 * on distance-to-player too: `sprite.visible = hasMessage() && inRange`, not
 * just `hasMessage()` alone. Keeping "do I have something to say" and
 * "should it currently render" as two separate questions (rather than one
 * boolean the internal timer flips) is what makes that combination safe: if
 * this set `sprite.visible = false` itself on timeout, and a caller also
 * ANDed in a distance check, walking back into range after the message had
 * already expired would stay stuck invisible.
 */
export function createSpeechBubble(): SpeechBubble {
  const material = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.9, 0.65, 1);
  sprite.visible = false;
  sprite.renderOrder = 10;
  // See createGlowSprite's own comment (swagAccessories.ts) — opts out of
  // FollowCamera's occlusion raycast, which a bare Sprite can confuse.
  sprite.raycast = () => {};

  let hideTimer = 0;

  return {
    sprite,
    show(text: string, duration: number) {
      material.map?.dispose();
      material.map = createBubbleTexture(text);
      material.needsUpdate = true;
      hideTimer = duration;
    },
    update(dt: number) {
      if (hideTimer > 0) hideTimer = Math.max(0, hideTimer - dt);
    },
    hasMessage() {
      return hideTimer > 0;
    },
  };
}
