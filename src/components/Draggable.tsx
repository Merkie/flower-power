// src/components/Draggable.tsx

import { createSignal, Component } from "solid-js";
import { CanvasMovementAPI } from "../lib/config";

interface DraggableProps {
  movement: CanvasMovementAPI;
  initialPos?: { x: number; y: number };
}

export const Draggable: Component<DraggableProps> = (props) => {
  const [pos, setPos] = createSignal(props.initialPos ?? { x: 0, y: 0 });

  const onDragStart = (e: MouseEvent) => {
    const scale = props.movement.transform().s;
    const startMouse = { x: e.clientX, y: e.clientY };
    const startEl = pos();

    const onDragMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startMouse.x;
      const dy = moveEvent.clientY - startMouse.y;
      setPos({
        x: startEl.x + dx / scale,
        y: startEl.y + dy / scale,
      });
    };

    const onDragEnd = () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };

  return (
    <div
      // data-interactive is still crucial here
      data-interactive
      class="absolute w-36 h-36 bg-green-500 rounded-lg shadow-lg grid place-items-center font-bold text-white cursor-grab active:cursor-grabbing"
      style={{
        transform: `translate(-50%, -50%)`,
        left: `${pos().x}px`,
        top: `${pos().y}px`,
      }}
      onMouseDown={onDragStart}
    >
      Drag Me
    </div>
  );
};
