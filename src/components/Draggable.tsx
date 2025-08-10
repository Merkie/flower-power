// src/components/Draggable.tsx

import { createSignal, Component } from "solid-js";
import { CanvasMovementAPI } from "../lib/config";

interface DraggableProps {
  movement: CanvasMovementAPI;
  initialPos?: { x: number; y: number };
}

export const Draggable: Component<DraggableProps> = (props) => {
  const [pos, setPos] = createSignal(props.initialPos ?? { x: 0, y: 0 });

  const onPointerDown = (e: PointerEvent) => {
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

  return (
    <div
      data-interactive
      class="absolute w-36 h-36 bg-green-500 rounded-lg shadow-lg grid place-items-center font-bold text-white cursor-grab active:cursor-grabbing"
      style={{
        transform: `translate(-50%, -50%)`,
        left: `${pos().x}px`,
        top: `${pos().y}px`,
      }}
      onPointerDown={onPointerDown}
    >
      Drag Me
    </div>
  );
};
