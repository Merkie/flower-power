// src/components/Connectable.tsx

import { Component, createSignal, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { CanvasMovementAPI } from "../lib/config";

// --- Module-level Shared State ---
// This signal is shared across all instances of Connectable to manage the currently dragged wire.
// We store coordinates in screen space for simplicity while drawing.
type DraggedWire = {
  fromId: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
};
const [draggedWire, setDraggedWire] = createSignal<DraggedWire | null>(null);

// --- Helper for drawing the curve ---
function createSCurvePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = Math.abs(x1 - x2);
  const handleOffset = Math.max(50, dx * 0.4);
  return `M ${x1} ${y1} C ${x1 + handleOffset} ${y1}, ${
    x2 - handleOffset
  } ${y2}, ${x2} ${y2}`;
}

// --- The Component ---
interface ConnectableProps {
  id: string;
  movement: CanvasMovementAPI;
  initialPos?: { x: number; y: number };
}

export const Connectable: Component<ConnectableProps> = (props) => {
  const [pos, setPos] = createSignal(props.initialPos ?? { x: 0, y: 0 });
  const [size, setSize] = createSignal({ width: 200, height: 100 });

  // --- Connection Logic ---
  const onConnectionPointerDown = (
    e: PointerEvent,
    type: "input" | "output"
  ) => {
    // For now, we only drag from outputs.
    if (type === "input") return;

    e.stopPropagation();
    const targetElement = e.currentTarget as HTMLElement;
    targetElement.setPointerCapture(e.pointerId);

    // Get the initial screen position of the connection point
    const rect = targetElement.getBoundingClientRect();
    const startPos = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    // Set the global signal to start drawing the wire
    setDraggedWire({ fromId: props.id, fromPos: startPos, toPos: startPos });

    const onPointerMove = (moveEvent: PointerEvent) => {
      // Update the 'to' position of the wire in screen coordinates
      setDraggedWire((d) =>
        d
          ? { ...d, toPos: { x: moveEvent.clientX, y: moveEvent.clientY } }
          : null
      );
    };

    const onPointerUp = () => {
      // For now, just stop drawing. Future logic to connect will go here.
      setDraggedWire(null);

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <>
      <div
        data-interactive
        data-connectable-id={props.id}
        class="absolute bg-slate-700 rounded-lg shadow-lg grid place-items-center font-bold text-white cursor-grab active:cursor-grabbing"
        style={{
          left: `${pos().x}px`,
          top: `${pos().y}px`,
          height: `${size().height}px`,
          width: `${size().width}px`,
        }}
      >
        {props.id}

        {/* Connection Points */}
        <div
          data-interactive
          data-connection-point="input"
          onPointerDown={(e) => onConnectionPointerDown(e, "input")}
          class="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-orange-500 border-2 border-slate-900 rounded-full cursor-crosshair"
        ></div>
        <div
          data-interactive
          data-connection-point="output"
          onPointerDown={(e) => onConnectionPointerDown(e, "output")}
          class="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-slate-900 rounded-full cursor-crosshair"
        ></div>
      </div>

      {/* --- RENDER THE DRAGGED WIRE USING A PORTAL --- */}
      <Show when={draggedWire()?.fromId === props.id}>
        <Portal mount={document.body}>
          <svg class="fixed top-0 left-0 w-full h-full pointer-events-none z-50">
            <path
              d={createSCurvePath(
                draggedWire()!.fromPos.x,
                draggedWire()!.fromPos.y,
                draggedWire()!.toPos.x,
                draggedWire()!.toPos.y
              )}
              stroke="#0ea5e9"
              stroke-width="2"
              fill="none"
            />
          </svg>
        </Portal>
      </Show>
    </>
  );
};
