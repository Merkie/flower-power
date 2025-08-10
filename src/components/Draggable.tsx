// src/components/Draggable.tsx

import { createSignal, Component } from "solid-js";
import { CanvasMovementAPI } from "../lib/config";

interface DraggableProps {
  movement: CanvasMovementAPI;
  initialPos?: { x: number; y: number };
}

// More descriptive handle types for 8-directional resizing
type HandleType =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export const Draggable: Component<DraggableProps> = (props) => {
  const [pos, setPos] = createSignal(props.initialPos ?? { x: 0, y: 0 });
  const [size, setSize] = createSignal({ width: 150, height: 150 });
  const minSize = 40; // Minimum width and height in world units

  // --- Drag Handler ---
  const onDragPointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const scale = props.movement.transform().s;
    const startMouse = { x: e.clientX, y: e.clientY };
    const startEl = pos();

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startMouse.x;
      const dy = moveEvent.clientY - startMouse.y;

      setPos({
        x: startEl.x + dx / scale,
        y: startEl.y + dy / scale,
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // --- Resize Handler (Rewritten) ---
  const onResizePointerDown = (e: PointerEvent, handle: HandleType) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const scale = props.movement.transform().s;
    const startMouse = { x: e.clientX, y: e.clientY };
    const startPos = pos();
    const startSize = size();
    const aspectRatio = startSize.width / startSize.height;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const worldDx = (moveEvent.clientX - startMouse.x) / scale;
      const worldDy = (moveEvent.clientY - startMouse.y) / scale;

      let newPos = { ...startPos };
      let newSize = { ...startSize };

      // Calculate new dimensions based on handle direction
      if (handle.includes("right")) newSize.width = startSize.width + worldDx;
      if (handle.includes("left")) newSize.width = startSize.width - worldDx;
      if (handle.includes("bottom"))
        newSize.height = startSize.height + worldDy;
      if (handle.includes("top")) newSize.height = startSize.height - worldDy;

      // Aspect Ratio Lock (with Shift key)
      if (moveEvent.shiftKey) {
        if (handle.includes("left") || handle.includes("right")) {
          newSize.height = newSize.width / aspectRatio;
        } else {
          newSize.width = newSize.height * aspectRatio;
        }
      }

      // Enforce minimum size
      newSize.width = Math.max(minSize, newSize.width);
      newSize.height = Math.max(minSize, newSize.height);

      // **THE CRITICAL FIX**: Recalculate position to keep the opposite edge anchored
      if (handle.includes("left")) {
        newPos.x = startPos.x + startSize.width - newSize.width;
      }
      if (handle.includes("top")) {
        newPos.y = startPos.y + startSize.height - newSize.height;
      }

      // Batch state updates to prevent conflicts
      setPos(newPos);
      setSize(newSize);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      data-interactive
      class="absolute bg-green-500 rounded-lg shadow-lg grid place-items-center font-bold text-white cursor-grab active:cursor-grabbing"
      style={{
        left: `${pos().x}px`,
        top: `${pos().y}px`,
        height: `${size().height}px`,
        width: `${size().width}px`,
      }}
      onPointerDown={onDragPointerDown}
    >
      Drag Me
      {/* Selection Box */}
      <div class="absolute pointer-events-none top-0 left-0 w-full h-full border-2 border-sky-500 rounded-lg"></div>
      {/* --- 8 Resize Handles --- */}
      {/* Corners */}
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "top-left")}
        class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-nwse-resize"
      ></div>
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "top-right")}
        class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-nesw-resize"
      ></div>
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "bottom-left")}
        class="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-nesw-resize"
      ></div>
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "bottom-right")}
        class="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-nwse-resize"
      ></div>
      {/* Sides */}
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "top")}
        class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-ns-resize"
      ></div>
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "bottom")}
        class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-ns-resize"
      ></div>
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "left")}
        class="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-ew-resize"
      ></div>
      <div
        data-interactive
        onPointerDown={(e) => onResizePointerDown(e, "right")}
        class="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-ew-resize"
      ></div>
    </div>
  );
};
