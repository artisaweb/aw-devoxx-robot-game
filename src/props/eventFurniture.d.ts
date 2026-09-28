import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern. Static furniture only — no
// activate()/update(), just object + dispose().

export interface EventFurniturePiece {
  readonly object: THREE.Object3D;
  dispose(): void;
}

export function createFoldingTable(options?: {
  width?: number;
  depth?: number;
  height?: number;
  color?: number;
}): EventFurniturePiece;

export function createEventChair(options?: { fabric?: number; frame?: number }): EventFurniturePiece;

export function createBarStool(options?: { fabric?: number; frame?: number }): EventFurniturePiece;

export function createHighTable(options?: {
  color?: number;
  diameter?: number;
  height?: number;
}): EventFurniturePiece;
