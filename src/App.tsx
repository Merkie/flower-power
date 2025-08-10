/**
 * @name SolidJS Interactive Canvas Template
 * @version 1.0.0
 *
 * @description
 * This project serves as a reusable, high-performance template for creating an interactive,
 * pannable, and zoomable canvas experience using SolidJS. It is completely "headless" and
 * relies on a core `useCanvasMovement` hook to handle all physics and user interactions.
 *
 * @features
 * - Physics-Based Interactions: Smooth, inertial panning and zooming with velocity.
 * - Mobile-First Design: Full support for touch gestures, including one-finger pan and two-finger pinch-to-zoom.
 * - Rubber-Banding: Native-style elastic feedback when panning or zooming past the defined boundaries.
 * - Headless Hook: The `useCanvasMovement` hook is completely decoupled from the DOM elements it controls,
 * making it highly reusable for various applications.
 * - Dynamic Background: The background is a separate DOM element that moves and scales with the canvas,
 * preventing common rendering glitches on browsers like Safari.
 *
 * @setup
 * To ensure proper functionality, especially on mobile devices, the following setup is crucial:
 *
 * 1. HTML Viewport Meta Tag:
 * Your main `index.html` file MUST include a viewport meta tag that disables the browser's
 * native scaling and zooming. This allows the canvas to handle all touch events.
 * <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
 *
 * 2. Global CSS:
 * It's recommended to apply `overflow: hidden` and `touch-action: none` to the `body` or a root
 * container in your global stylesheet to prevent scrollbars and unwanted browser gestures.
 */

import {
  Accessor,
  Component,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Dynamic } from "solid-js/web";

/**
 * A headless SolidJS hook to manage pan-and-zoom physics for a canvas-like element.
 */
const useCanvasMovement = (props: {
  container: Accessor<HTMLDivElement | undefined>;
  view: Accessor<HTMLDivElement | undefined>;
  background?: Accessor<HTMLDivElement | undefined>;
  options?: {
    backgroundImage?: { src: string; size: number };
  };
}) => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [isPinching, setIsPinching] = createSignal(false);
  const [transformVersion, setTransformVersion] = createSignal(0);

  // --- Initial Setup ---
  const initialBackgroundSize = props.options?.backgroundImage?.size || 500;

  // --- State & Physics Variables ---
  let scale = 1;
  let translateX = 0,
    translateY = 0;
  let targetX = 0,
    targetY = 0;
  let startX = 0,
    startY = 0;
  let lastTranslateX = 0,
    lastTranslateY = 0;
  let animationId: number | null = null;

  // Pan physics
  let velocityX = 0,
    velocityY = 0;
  const lerpFactor = 0.15;
  const friction = 0.92;
  const snapBackStiffness = 0.05;
  const rubberBandStiffness = 0.85;
  const minVelocity = 0.01;

  // --- Zoom Physics ---
  let targetScale = 1;
  let scaleVelocity = 0;
  const zoomFriction = 0.92;
  const zoomSnapBackStiffness = 0.05;
  const zoomLerpFactor = 0.15; // For smooth pinch-zooming
  const minScale = 0.5;
  const maxScale = 2.0;
  let lastZoomFocalPoint = { x: 0, y: 0 };

  // --- State for pinch gesture ---
  let lastPinchDist: number | null = null;
  const pinchRubberBandStiffness = 0.25;

  // --- Bounding Box Definition ---
  const boundingBox = { width: 6000, height: 6000 };

  // --- Core Functions ---
  const updateTransform = () => {
    const viewEl = props.view();
    const backgroundEl = props.background?.();
    if (viewEl) {
      viewEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
    if (backgroundEl) {
      const bgSize = Math.round(initialBackgroundSize * scale);
      const bgX = Math.round(translateX);
      const bgY = Math.round(translateY);

      backgroundEl.style.backgroundSize = `${bgSize}px ${bgSize}px`;
      backgroundEl.style.backgroundPosition = `${bgX}px ${bgY}px`;
    }
  };

  const getViewportBounds = () => {
    const containerEl = props.container();
    if (!containerEl) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const { clientWidth: viewportWidth, clientHeight: viewportHeight } =
      containerEl;
    const scaledContentWidth = boundingBox.width * scale;
    const scaledContentHeight = boundingBox.height * scale;
    const boxWorldX = -boundingBox.width / 2;
    const boxWorldY = -boundingBox.height / 2;

    let minX, maxX, minY, maxY;

    if (scaledContentWidth <= viewportWidth) {
      minX = maxX =
        (viewportWidth - scaledContentWidth) / 2 - boxWorldX * scale;
    } else {
      maxX = -boxWorldX * scale;
      minX = viewportWidth - (boxWorldX + boundingBox.width) * scale;
    }

    if (scaledContentHeight <= viewportHeight) {
      minY = maxY =
        (viewportHeight - scaledContentHeight) / 2 - boxWorldY * scale;
    } else {
      maxY = -boxWorldY * scale;
      minY = viewportHeight - (boxWorldY + boundingBox.height) * scale;
    }

    return { minX, maxX, minY, maxY };
  };

  const animate = () => {
    // --- Pan Physics ---
    let panIsSettled;
    if (isDragging()) {
      panIsSettled = false;
      const dx = (targetX - translateX) * lerpFactor;
      const dy = (targetY - translateY) * lerpFactor;
      translateX += dx;
      translateY += dy;
      velocityX = dx;
      velocityY = dy;
    } else {
      const bounds = getViewportBounds();
      const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, translateX));
      const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, translateY));
      const forceX = (clampedX - translateX) * snapBackStiffness;
      const forceY = (clampedY - translateY) * snapBackStiffness;
      velocityX += forceX;
      velocityY += forceY;
      velocityX *= friction;
      velocityY *= friction;
      translateX += velocityX;
      translateY += velocityY;
      panIsSettled =
        Math.abs(velocityX) < minVelocity &&
        Math.abs(velocityY) < minVelocity &&
        Math.abs(clampedX - translateX) < 0.5 &&
        Math.abs(clampedY - translateY) < 0.5;

      if (panIsSettled) {
        translateX = clampedX;
        translateY = clampedY;
      }
    }

    // --- Re-engineered Zoom Physics ---
    let zoomIsSettled;
    if (isPinching()) {
      zoomIsSettled = false;
      let rubberBandedTargetScale = targetScale;
      if (targetScale < minScale) {
        rubberBandedTargetScale =
          minScale - (minScale - targetScale) * pinchRubberBandStiffness;
      } else if (targetScale > maxScale) {
        rubberBandedTargetScale =
          maxScale + (targetScale - maxScale) * pinchRubberBandStiffness;
      }

      const ds = (rubberBandedTargetScale - scale) * zoomLerpFactor;
      scaleVelocity = ds;

      const oldScale = scale;
      scale += ds;

      const scaleRatio = scale / oldScale;
      translateX =
        lastZoomFocalPoint.x - (lastZoomFocalPoint.x - translateX) * scaleRatio;
      translateY =
        lastZoomFocalPoint.y - (lastZoomFocalPoint.y - translateY) * scaleRatio;
      targetX = translateX;
      targetY = translateY;
    } else {
      const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
      const scaleForce = (clampedScale - scale) * zoomSnapBackStiffness;
      scaleVelocity += scaleForce;
      scaleVelocity *= zoomFriction;

      if (Math.abs(scaleVelocity) > 0.00001) {
        const oldScale = scale;
        scale += scaleVelocity;

        const scaleRatio = scale / oldScale;
        translateX =
          lastZoomFocalPoint.x -
          (lastZoomFocalPoint.x - translateX) * scaleRatio;
        translateY =
          lastZoomFocalPoint.y -
          (lastZoomFocalPoint.y - translateY) * scaleRatio;
        targetX = translateX;
        targetY = translateY;
      }

      zoomIsSettled =
        Math.abs(scaleVelocity) < 0.0001 &&
        Math.abs(clampedScale - scale) < 0.001;
      if (zoomIsSettled) {
        scale = clampedScale;
        scaleVelocity = 0;
      }
    }

    updateTransform();
    setTransformVersion((v) => v + 1);

    const allSettled = panIsSettled && zoomIsSettled;
    if (allSettled) {
      animationId = null;
    } else {
      animationId = requestAnimationFrame(animate);
    }
  };

  const startAnimation = () => {
    if (!animationId) animationId = requestAnimationFrame(animate);
  };

  const applyZoom = (delta: number, focalX: number, focalY: number) => {
    setIsDragging(false);
    velocityX = 0;
    velocityY = 0;

    lastZoomFocalPoint = { x: focalX, y: focalY };
    scaleVelocity += delta;
    startAnimation();
  };

  const zoomIn = () => {
    const containerEl = props.container();
    if (containerEl)
      applyZoom(
        0.02,
        containerEl.clientWidth / 2,
        containerEl.clientHeight / 2
      );
  };

  const zoomOut = () => {
    const containerEl = props.container();
    if (containerEl)
      applyZoom(
        -0.02,
        containerEl.clientWidth / 2,
        containerEl.clientHeight / 2
      );
  };

  const setup = () => {
    const containerEl = props.container();
    if (!containerEl) return;
    translateX = containerEl.clientWidth / 2;
    translateY = containerEl.clientHeight / 2;
    targetX = translateX;
    targetY = translateY;
    updateTransform();
    setTransformVersion((v) => v + 1);
  };

  const panStart = (x: number, y: number) => {
    setIsDragging(true);
    setIsPinching(false);
    startX = x;
    startY = y;
    lastTranslateX = translateX;
    lastTranslateY = translateY;
    targetX = translateX;
    targetY = translateY;
    velocityX = 0;
    velocityY = 0;
    scaleVelocity = 0;
    startAnimation();
  };

  const panMove = (x: number, y: number) => {
    if (!isDragging()) return;
    const deltaX = x - startX;
    const deltaY = y - startY;
    const rawTargetX = lastTranslateX + deltaX;
    const rawTargetY = lastTranslateY + deltaY;
    const bounds = getViewportBounds();
    if (rawTargetX < bounds.minX) {
      targetX =
        bounds.minX + (rawTargetX - bounds.minX) * (1 - rubberBandStiffness);
    } else if (rawTargetX > bounds.maxX) {
      targetX =
        bounds.maxX + (rawTargetX - bounds.maxX) * (1 - rubberBandStiffness);
    } else {
      targetX = rawTargetX;
    }
    if (rawTargetY < bounds.minY) {
      targetY =
        bounds.minY + (rawTargetY - bounds.minY) * (1 - rubberBandStiffness);
    } else if (rawTargetY > bounds.maxY) {
      targetY =
        bounds.maxY + (rawTargetY - bounds.maxY) * (1 - rubberBandStiffness);
    } else {
      targetY = rawTargetY;
    }
  };

  const panEnd = (_x: number, _y: number) => {
    if (isDragging()) {
      setIsDragging(false);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    panStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: MouseEvent) => panMove(e.clientX, e.clientY);
  const onMouseUp = (e: MouseEvent) => panEnd(e.clientX, e.clientY);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.000045;
    applyZoom(delta, e.clientX, e.clientY);
  };

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1) {
      panStart(touches[0].clientX, touches[0].clientY);
    } else if (touches.length === 2) {
      setIsDragging(false);
      setIsPinching(true);
      const touch1 = touches[0];
      const touch2 = touches[1];
      lastPinchDist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      targetScale = scale;
      startAnimation();
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1 && isDragging()) {
      panMove(touches[0].clientX, touches[0].clientY);
    } else if (touches.length === 2 && lastPinchDist !== null) {
      const touch1 = touches[0];
      const touch2 = touches[1];
      const newDist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      const factor = newDist / lastPinchDist;
      targetScale *= factor;
      lastPinchDist = newDist;
      lastZoomFocalPoint = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (isDragging()) {
      panEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
    if (e.touches.length < 2) {
      setIsPinching(false);
      lastPinchDist = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  onMount(() => {
    const containerEl = props.container();
    const backgroundEl = props.background?.();
    if (!containerEl) return;

    if (backgroundEl) {
      backgroundEl.style.backgroundImage = `url(${props.options?.backgroundImage?.src})`;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    containerEl.addEventListener("touchstart", onTouchStart, {
      passive: false,
    });
    containerEl.addEventListener("touchmove", onTouchMove, { passive: false });
    containerEl.addEventListener("touchend", onTouchEnd);
    containerEl.addEventListener("touchcancel", onTouchEnd);

    const observer = new ResizeObserver(setup);
    observer.observe(containerEl);
    setup();

    onCleanup(() => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      containerEl.removeEventListener("touchstart", onTouchStart);
      containerEl.removeEventListener("touchmove", onTouchMove);
      containerEl.removeEventListener("touchend", onTouchEnd);
      containerEl.removeEventListener("touchcancel", onTouchEnd);
      observer.disconnect();
      if (animationId) cancelAnimationFrame(animationId);
    });
  });

  return {
    isDragging,
    isPinching,
    zoomIn,
    zoomOut,
    onMouseDown,
    onWheel,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    boundingBox,
    transformVersion,
    transform: () => ({ x: translateX, y: translateY, s: scale }),
    container: props.container,
  };
};

type CanvasMovement = ReturnType<typeof useCanvasMovement>;

const Canvas: Component<{
  world: Component<{ movement: CanvasMovement }>;
  hud: Component<{ movement: CanvasMovement }>;
  options?: {
    backgroundImage?: { src: string; size: number };
  };
}> = ({ options, world, hud }) => {
  let containerRef: HTMLDivElement | undefined;
  let viewRef: HTMLDivElement | undefined;
  let backgroundRef: HTMLDivElement | undefined;

  const movement = useCanvasMovement({
    container: () => containerRef,
    view: () => viewRef,
    background: () => backgroundRef,
    options: {
      backgroundImage: options?.backgroundImage,
    },
  });

  return (
    <>
      <style>{`
        body { background-color: #f3f4f6; }
        [data-dragging="true"] { cursor: grabbing; }
        [data-pinching="true"] { cursor: zoom-in; }
      `}</style>
      <div ref={backgroundRef} class="fixed top-0 left-0 w-full h-full" />
      <div
        ref={containerRef}
        class="h-dvh w-full fixed top-0 left-0 cursor-grab select-none"
        data-dragging={movement.isDragging()}
        data-pinching={movement.isPinching()}
        onMouseDown={movement.onMouseDown}
        onWheel={movement.onWheel}
        onTouchStart={movement.onTouchStart}
        onTouchMove={movement.onTouchMove}
        onTouchEnd={movement.onTouchEnd}
      >
        <div ref={viewRef} class="absolute origin-top-left">
          <Dynamic component={world} movement={movement} />
        </div>
      </div>
      <Dynamic component={hud} movement={movement} />
    </>
  );
};

function App() {
  return (
    <>
      <Canvas
        options={{
          backgroundImage: {
            src: "/background.png",
            size: 800, // Size in pixels for the background image
          },
        }}
        world={() => {
          // You can place any elements you want to move with the canvas inside this 'world' slot.
          // They should be positioned absolutely relative to the top-left of the canvas world.
          // The coordinates are based on the center of the boundingBox (0,0).
          return (
            <>
              <div
                class="absolute w-[300px] h-[300px] bg-blue-500 rounded-md shadow-lg"
                style={{
                  top: "-150px",
                  left: "-150px",
                }}
              />
              <div
                class="absolute w-[200px] h-[200px] bg-red-500 rounded-full shadow-lg"
                style={{
                  top: "200px",
                  left: "300px",
                }}
              />
            </>
          );
        }}
        hud={({ movement }) => {
          // The 'hud' slot is for UI elements that should remain static on the screen,
          // like zoom buttons, menus, or info displays.
          return (
            <div class="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  movement.zoomIn();
                }}
                class="w-10 h-10 bg-white grid place-items-center rounded border-2 font-bold text-lg shadow-md hover:bg-gray-50 active:scale-95 transition-transform"
              >
                +
              </button>
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  movement.zoomOut();
                }}
                class="w-10 h-10 bg-white grid place-items-center rounded border-2 font-bold text-lg shadow-md hover:bg-gray-50 active:scale-95 transition-transform"
              >
                -
              </button>
            </div>
          );
        }}
      />
    </>
  );
}

export default App;
