// src/components/Canvas.tsx

import { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { useCanvasMovement } from "../hooks/useCanvasMovement";
import { CanvasOptions, CanvasMovementAPI } from "../lib/config";

interface CanvasProps {
  world: Component<{ movement: CanvasMovementAPI }>;
  hud?: Component<{ movement: CanvasMovementAPI }>;
  options?: CanvasOptions;
}

export const Canvas: Component<CanvasProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let viewRef: HTMLDivElement | undefined;
  let backgroundRef: HTMLDivElement | undefined;

  const movement = useCanvasMovement({
    container: () => containerRef,
    view: () => viewRef,
    background: () => backgroundRef,
    options: props.options,
  });

  return (
    <>
      <style>{`
        body { background-color: #f3f4f6; }
        [data-dragging="true"] { cursor: grabbing; }
        .canvas-view, .canvas-bg { will-change: transform; }
      `}</style>

      <div
        ref={backgroundRef}
        class="canvas-bg fixed top-0 left-0 w-full h-full -z-10"
      />

      <div
        ref={containerRef}
        class="h-dvh w-full fixed top-0 left-0 cursor-grab select-none"
        data-dragging={movement.isDragging()}
        onPointerDown={movement.onPointerDown}
        onPointerMove={movement.onPointerMove}
        onPointerUp={movement.onPointerUp}
        onPointerCancel={movement.onPointerUp}
        onWheel={movement.onWheel}
      >
        <div ref={viewRef} class="canvas-view absolute origin-top-left">
          <Dynamic component={props.world} movement={movement} />
        </div>
      </div>

      {props.hud && <Dynamic component={props.hud} movement={movement} />}
    </>
  );
};
