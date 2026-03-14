declare module 'd3-bboxCollide' {
  import type { SimulationNodeDatum } from 'd3-force';

  type BBox = [[number, number], [number, number]];
  type BBoxAccessor<T> = (node: T, i: number, nodes: T[]) => BBox;

  interface BBoxCollideForce<T extends SimulationNodeDatum> {
    (alpha: number): void;
    initialize(nodes: T[]): void;
    iterations(): number;
    iterations(iterations: number): BBoxCollideForce<T>;
    strength(): number;
    strength(strength: number): BBoxCollideForce<T>;
    bbox(): BBoxAccessor<T>;
    bbox(bbox: BBox | BBoxAccessor<T>): BBoxCollideForce<T>;
  }

  export function bboxCollide<T extends SimulationNodeDatum>(
    bbox?: BBox | BBoxAccessor<T>,
  ): BBoxCollideForce<T>;
}
