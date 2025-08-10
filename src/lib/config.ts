import { Accessor } from "solid-js";

/**
 * Defines the available physics presets for the canvas.
 * 'rigid': Feels snappy and direct, like a design tool.
 * 'default': A balanced, slightly floaty feel.
 * 'fluid': Very loose and bouncy with lots of inertia.
 */
export type BouncinessPreset = "rigid" | "default" | "fluid";

// --- TYPE DEFINITIONS ---

export interface CanvasOptions {
  bounciness?: BouncinessPreset;
  worldSize?: { width: number; height: number };
  minScale?: number;
  maxScale?: number;
  wheelSensitivity?: number; // Renamed for clarity
  backgroundImage?: { src: string; size: number };
}

export interface CanvasMovementAPI {
  isDragging: Accessor<boolean>;
  isPinching: Accessor<boolean>;
  zoomIn: () => void;
  zoomOut: () => void;
  onMouseDown: (e: MouseEvent) => void;
  onWheel: (e: WheelEvent) => void;
  transform: Accessor<{ x: number; y: number; s: number }>;
}

// --- PHYSICS PRESETS ---
const physicsProfiles = {
  rigid: {
    panFriction: 0.85,
    panLerpFactor: 0.25,
    snapBackStiffness: 0.1,
    rubberBandStiffness: 0.98,
    zoomFriction: 0.85,
    zoomLerpFactor: 0.2,
    zoomSnapBackStiffness: 0.1,
    pinchRubberBandStiffness: 0.9,
  },
  default: {
    panFriction: 0.92,
    panLerpFactor: 0.15,
    snapBackStiffness: 0.05,
    rubberBandStiffness: 0.85,
    zoomFriction: 0.92,
    zoomLerpFactor: 0.15,
    zoomSnapBackStiffness: 0.05,
    pinchRubberBandStiffness: 0.25,
  },
  fluid: {
    panFriction: 0.95,
    panLerpFactor: 0.1,
    snapBackStiffness: 0.03,
    rubberBandStiffness: 0.75,
    zoomFriction: 0.95,
    zoomLerpFactor: 0.1,
    zoomSnapBackStiffness: 0.03,
    pinchRubberBandStiffness: 0.15,
  },
};

/**
 * Merges user-provided options with defaults and returns a full configuration object.
 */
export const createMovementConfig = (options?: CanvasOptions) => {
  const bounciness = options?.bounciness ?? "default";
  const physics = physicsProfiles[bounciness];

  return {
    worldSize: options?.worldSize ?? { width: 6000, height: 6000 },
    minScale: options?.minScale ?? 0.5,
    maxScale: options?.maxScale ?? 2.0,
    wheelSensitivity: options?.wheelSensitivity ?? 0.0001,
    initialBgSize: options?.backgroundImage?.size ?? 500,
    physics,
  };
};
