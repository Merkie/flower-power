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
      {/* These styles are minimal and could be moved to a global CSS file */}
      <style>{`
        body { background-color: #f3f4f6; }
        [data-dragging="true"] { cursor: grabbing; }
        [data-pinching="true"] { cursor: zoom-in; }
      `}</style>

      {/* Background Element (for seamless background) */}
      <div ref={backgroundRef} class="fixed top-0 left-0 w-full h-full -z-10" />

      {/* Main Container for events */}
      <div
        ref={containerRef}
        class="h-dvh w-full fixed top-0 left-0 cursor-grab select-none"
        data-dragging={movement.isDragging()}
        data-pinching={movement.isPinching()}
        onMouseDown={movement.onMouseDown}
        onWheel={movement.onWheel}
      >
        {/* The Viewport that moves and scales */}
        <div ref={viewRef} class="absolute origin-top-left">
          <Dynamic component={props.world} movement={movement} />
        </div>
      </div>

      {/* Optional HUD layer */}
      {props.hud && <Dynamic component={props.hud} movement={movement} />}
    </>
  );
};
