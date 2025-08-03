import {
  Accessor,
  Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  ParentComponent,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import gsap from "gsap";

const rects = [...Array(225).keys()].map((i) => {
  const col = i % 15;
  const row = Math.floor(i / 15);
  const yOffset = col % 2 !== 0 ? 150 : 0;

  return {
    x: col * 400 + 50 - 3000,
    y: row * 400 + 50 - 3000 + yOffset,
    width: 300,
    height: 300,
    flower: Math.floor(Math.random() * 15) + 1,
  };
});

/**
 * A headless SolidJS hook to manage pan-and-zoom physics for a canvas-like element.
 */
const useCanvasMovement = (props: {
  container: Accessor<HTMLDivElement | undefined>;
  view: Accessor<HTMLDivElement | undefined>;
}) => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [isZooming, setIsZooming] = createSignal(false);
  const [transformVersion, setTransformVersion] = createSignal(0);

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
  let velocityX = 0,
    velocityY = 0;
  const lerpFactor = 0.15;
  const friction = 0.92;
  const snapBackStiffness = 0.05;
  const rubberBandStiffness = 0.85;
  const minVelocity = 0.01;

  // --- Add state for pinch gesture ---
  let lastPinchDist: number | null = null;

  // --- Bounding Box Definition ---
  const boundingBox = { width: 6000, height: 6000 };

  // --- Core Functions ---
  const updateTransform = () => {
    const viewEl = props.view();
    if (viewEl) {
      viewEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
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
    let isSettled = false;
    if (isDragging()) {
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
      isSettled =
        Math.abs(velocityX) < minVelocity &&
        Math.abs(velocityY) < minVelocity &&
        Math.abs(clampedX - translateX) < 0.5 &&
        Math.abs(clampedY - translateY) < 0.5;
      if (isSettled) {
        translateX = clampedX;
        translateY = clampedY;
      }
    }
    updateTransform();
    setTransformVersion((v) => v + 1);
    if (isSettled) {
      animationId = null;
    } else {
      animationId = requestAnimationFrame(animate);
    }
  };

  const startAnimation = () => {
    if (!animationId) animationId = requestAnimationFrame(animate);
  };

  const zoom = (factor: number, screenX: number, screenY: number) => {
    setIsDragging(false);
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    velocityX = 0;
    velocityY = 0;

    const oldScale = scale;
    let newScale = oldScale * factor;
    newScale = Math.max(0.25, Math.min(4, newScale));
    const scaleRatio = newScale / oldScale;
    const newTranslateX = screenX - (screenX - translateX) * scaleRatio;
    const newTranslateY = screenY - (screenY - translateY) * scaleRatio;

    const containerEl = props.container();
    if (!containerEl) return;
    const { clientWidth: viewportWidth, clientHeight: viewportHeight } =
      containerEl;
    const scaledContentWidth = boundingBox.width * newScale;
    const scaledContentHeight = boundingBox.height * newScale;
    const boxWorldX = -boundingBox.width / 2;
    const boxWorldY = -boundingBox.height / 2;
    let minX, maxX, minY, maxY;

    if (scaledContentWidth <= viewportWidth) {
      minX = maxX =
        (viewportWidth - scaledContentWidth) / 2 - boxWorldX * newScale;
    } else {
      maxX = -boxWorldX * newScale;
      minX = viewportWidth - (boxWorldX + boundingBox.width) * newScale;
    }
    if (scaledContentHeight <= viewportHeight) {
      minY = maxY =
        (viewportHeight - scaledContentHeight) / 2 - boxWorldY * newScale;
    } else {
      maxY = -boxWorldY * newScale;
      minY = viewportHeight - (boxWorldY + boundingBox.height) * newScale;
    }

    const finalTranslateX = Math.max(minX, Math.min(maxX, newTranslateX));
    const finalTranslateY = Math.max(minY, Math.min(maxY, newTranslateY));

    gsap.to(
      { s: scale, x: translateX, y: translateY },
      {
        s: newScale,
        x: finalTranslateX,
        y: finalTranslateY,
        duration: 0.6,
        ease: "power2.out",
        overwrite: true,
        onStart: () => setIsZooming(true),
        onUpdate: function () {
          const current = this.targets()[0];
          scale = current.s;
          translateX = current.x;
          translateY = current.y;
          targetX = translateX;
          targetY = translateY;
          updateTransform();
          setTransformVersion((v) => v + 1);
        },
        onComplete: () => setIsZooming(false),
      }
    );
  };

  const zoomIn = () => {
    const containerEl = props.container();
    if (containerEl)
      zoom(1.25, containerEl.clientWidth / 2, containerEl.clientHeight / 2);
  };

  const zoomOut = () => {
    const containerEl = props.container();
    if (containerEl)
      zoom(0.8, containerEl.clientWidth / 2, containerEl.clientHeight / 2);
  };

  const setup = () => {
    const containerEl = props.container();
    if (!containerEl) return;
    translateX = containerEl.clientWidth / 2;
    translateY = containerEl.clientHeight / 2;
    targetX = translateX;
    targetY = translateY;
    updateTransform();
  };

  // --- Abstracted Pan and Tap Logic ---
  const panStart = (x: number, y: number) => {
    if (isZooming()) return;
    setIsDragging(true);
    startX = x;
    startY = y;
    lastTranslateX = translateX;
    lastTranslateY = translateY;
    targetX = translateX;
    targetY = translateY;
    velocityX = 0;
    velocityY = 0;
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

  const panEnd = (x: number, y: number) => {
    if (isDragging()) {
      setIsDragging(false);
      const distance = Math.sqrt(
        Math.pow(targetX - lastTranslateX, 2) +
          Math.pow(targetY - lastTranslateY, 2)
      );
      if (distance < 10) {
        const worldX = (x - translateX) / scale;
        const worldY = (y - translateY) / scale;
        const clickedRect = rects.find(
          (rect) =>
            worldX >= rect.x &&
            worldX <= rect.x + rect.width &&
            worldY >= rect.y &&
            worldY <= rect.y + rect.height
        );
        if (clickedRect) {
          console.log("Tapped on rect:", rects.indexOf(clickedRect) + 1);
        }
      }
    }
  };

  // --- MOUSE & TOUCH EVENT HANDLERS ---
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    panStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: MouseEvent) => panMove(e.clientX, e.clientY);
  const onMouseUp = (e: MouseEvent) => panEnd(e.clientX, e.clientY);

  const onWheel = (e: WheelEvent) => {
    if (isZooming()) return;
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom(zoomFactor, e.clientX, e.clientY);
  };

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1) {
      panStart(touches[0].clientX, touches[0].clientY);
    } else if (touches.length === 2) {
      setIsDragging(false);
      const touch1 = touches[0];
      const touch2 = touches[1];
      lastPinchDist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
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
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;
      zoom(factor, midX, midY);
      lastPinchDist = newDist;
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (isDragging()) {
      panEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
    if (e.touches.length < 2) {
      lastPinchDist = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  onMount(() => {
    const containerEl = props.container();
    if (!containerEl) return;

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    containerEl.addEventListener("touchstart", onTouchStart, { passive: false });
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
      gsap.killTweensOf({});
    });
  });

  return {
    isDragging,
    isZooming,
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

const FadingWorldObject: ParentComponent<{
  x: number;
  y: number;
  width: number;
  height: number;
  movement: CanvasMovement;
}> = (props) => {
  const [scale, setScale] = createSignal(0);

  createEffect(() => {
    props.movement.transformVersion();
    const containerEl = props.movement.container();
    if (!containerEl) return;
    const { x: tx, y: ty, s } = props.movement.transform();
    const objectBox = {
      x: props.x,
      y: props.y,
      width: props.width,
      height: props.height,
    };
    const viewBox = {
      x: -tx / s,
      y: -ty / s,
      width: containerEl.clientWidth / s,
      height: containerEl.clientHeight / s,
    };
    const intersects =
      objectBox.x < viewBox.x + viewBox.width &&
      objectBox.x + objectBox.width > viewBox.x &&
      objectBox.y < viewBox.y + viewBox.height &&
      objectBox.y + objectBox.height > viewBox.y;
    setScale(intersects ? 1 : 0);
  });

  return (
    <div
      id={`world-object-${props.x}-${props.y}`}
      class="absolute pointer-events-none"
      style={{
        width: `${props.width}px`,
        height: `${props.height}px`,
        top: `${props.y}px`,
        left: `${props.x}px`,
        transform: `scale(${scale()})`,
        transition: "transform 0.5s ease-out",
        "transition-delay": "0.1s",
      }}
    >
      {props.children}
    </div>
  );
};

const Canvas: Component<{
  world: Component<{ movement: CanvasMovement }>;
  hud: Component<{ movement: CanvasMovement }>;
  background: Component;
}> = ({ world, hud, background }) => {
  let containerRef: HTMLDivElement | undefined;
  let viewRef: HTMLDivElement | undefined;

  const movement = useCanvasMovement({
    container: () => containerRef,
    view: () => viewRef,
  });

  return (
    <>
      <style>{`
        [data-dragging="true"] { cursor: grabbing; }
        [data-zooming="true"] { cursor: wait; }
      `}</style>
      <div
        ref={containerRef}
        class="h-dvh w-full fixed top-0 left-0 cursor-grab touch-none"
        data-dragging={movement.isDragging()}
        data-zooming={movement.isZooming()}
        onMouseDown={movement.onMouseDown}
        onWheel={movement.onWheel}
        onTouchStart={movement.onTouchStart}
        onTouchMove={movement.onTouchMove}
        onTouchEnd={movement.onTouchEnd}
      >
        <div ref={viewRef} class="absolute origin-top-left">
          <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: `${movement.boundingBox.width}px`,
              height: `${movement.boundingBox.height}px`,
            }}
          >
            <Dynamic component={background} />
          </div>
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
      <style>{`body { background: #f3f4f6; }`}</style>
      <Canvas
        world={({ movement }) => {
          return (
            <For each={rects}>
              {(rect) => (
                <FadingWorldObject
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  movement={movement}
                >
                  <img
                    class="w-full h-full select-none pointer-events-none object-contain scale-80"
                    src={`/flower-${rect.flower}.png`}
                    style={{
                      filter: `drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.3))`,
                    }}
                  />
                </FadingWorldObject>
              )}
            </For>
          );
        }}
        hud={({ movement }) => (
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
        )}
        background={() => (
          <div class="h-full w-full relative bg-white">
            <div
              class="h-full w-full absolute inset-0"
              style={{
                "background-image":
                  "radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)",
                "background-size": "25px 25px",
              }}
            />
          </div>
        )}
      />
    </>
  );
}

export default App;
