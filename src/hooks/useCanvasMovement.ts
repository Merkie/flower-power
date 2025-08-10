// src/hooks/useCanvasMovement.ts

import { createSignal, onCleanup, onMount, Accessor } from "solid-js";
import { CanvasOptions, createMovementConfig } from "../lib/config";

// Props for the hook, defining the DOM elements it will control
interface HookProps {
  container: Accessor<HTMLDivElement | undefined>;
  view: Accessor<HTMLDivElement | undefined>;
  background?: Accessor<HTMLDivElement | undefined>;
  options?: CanvasOptions;
}

export const useCanvasMovement = (props: HookProps) => {
  // --- Setup ---
  const config = createMovementConfig(props.options);
  const { physics } = config;

  // --- Reactive State (Signals) ---
  const [isDragging, setIsDragging] = createSignal(false);
  const [isPinching, setIsPinching] = createSignal(false);

  // --- Internal Physics State (Non-reactive for performance) ---
  let scale = 1,
    targetScale = 1,
    scaleVelocity = 0;
  let translateX = 0,
    translateY = 0,
    targetX = 0,
    targetY = 0;
  let velocityX = 0,
    velocityY = 0;
  let startX = 0,
    startY = 0;
  let lastTranslateX = 0,
    lastTranslateY = 0;
  let lastPinchDist: number | null = null;
  let lastZoomFocalPoint = { x: 0, y: 0 };
  let animationId: number | null = null;

  // --- Core Functions ---

  const updateTransform = () => {
    const viewEl = props.view();
    if (viewEl) {
      viewEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
    const backgroundEl = props.background?.();
    if (backgroundEl && props.options?.backgroundImage) {
      const bgSize = Math.round(config.initialBgSize * scale);
      backgroundEl.style.backgroundSize = `${bgSize}px ${bgSize}px`;
      backgroundEl.style.backgroundPosition = `${translateX}px ${translateY}px`;
    }
  };

  const getViewportBounds = () => {
    const containerEl = props.container();
    if (!containerEl) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const { clientWidth: viewportW, clientHeight: viewportH } = containerEl;
    const scaledContentW = config.worldSize.width * scale;
    const scaledContentH = config.worldSize.height * scale;
    const worldOriginX = -config.worldSize.width / 2;
    const worldOriginY = -config.worldSize.height / 2;

    let minX = (viewportW - scaledContentW) / 2 - worldOriginX * scale;
    let maxX = minX;
    if (scaledContentW > viewportW) {
      maxX = -worldOriginX * scale;
      minX = viewportW - (worldOriginX + config.worldSize.width) * scale;
    }

    let minY = (viewportH - scaledContentH) / 2 - worldOriginY * scale;
    let maxY = minY;
    if (scaledContentH > viewportH) {
      maxY = -worldOriginY * scale;
      minY = viewportH - (worldOriginY + config.worldSize.height) * scale;
    }

    return { minX, maxX, minY, maxY };
  };

  const updatePanPhysics = () => {
    if (isDragging()) {
      const dx = (targetX - translateX) * physics.panLerpFactor;
      const dy = (targetY - translateY) * physics.panLerpFactor;
      translateX += dx;
      translateY += dy;
      velocityX = dx;
      velocityY = dy;
      return false;
    }

    const bounds = getViewportBounds();
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, translateX));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, translateY));

    const forceX = (clampedX - translateX) * physics.snapBackStiffness;
    const forceY = (clampedY - translateY) * physics.snapBackStiffness;
    velocityX += forceX;
    velocityY += forceY;
    velocityX *= physics.panFriction;
    velocityY *= physics.panFriction;
    translateX += velocityX;
    translateY += velocityY;

    const isSettled =
      Math.abs(velocityX) < 0.01 &&
      Math.abs(velocityY) < 0.01 &&
      Math.abs(clampedX - translateX) < 0.5 &&
      Math.abs(clampedY - translateY) < 0.5;

    if (isSettled) {
      translateX = clampedX;
      translateY = clampedY;
    }
    return isSettled;
  };

  const updateZoomPhysics = () => {
    let currentTargetScale = targetScale;
    let isSettled = false;

    if (isPinching()) {
      if (targetScale < config.minScale) {
        currentTargetScale =
          config.minScale -
          (config.minScale - targetScale) * physics.pinchRubberBandStiffness;
      } else if (targetScale > config.maxScale) {
        currentTargetScale =
          config.maxScale +
          (targetScale - config.maxScale) * physics.pinchRubberBandStiffness;
      }
      const ds = (currentTargetScale - scale) * physics.zoomLerpFactor;
      scaleVelocity = ds;
    } else {
      const clampedScale = Math.max(
        config.minScale,
        Math.min(config.maxScale, scale)
      );
      const scaleForce = (clampedScale - scale) * physics.zoomSnapBackStiffness;
      scaleVelocity += scaleForce;
      scaleVelocity *= physics.zoomFriction;

      isSettled =
        Math.abs(scaleVelocity) < 0.0001 &&
        Math.abs(clampedScale - scale) < 0.001;
    }

    if (Math.abs(scaleVelocity) > 0.00001 || isPinching()) {
      const oldScale = scale;
      scale += scaleVelocity;
      const scaleRatio = scale / oldScale;

      translateX =
        lastZoomFocalPoint.x - (lastZoomFocalPoint.x - translateX) * scaleRatio;
      translateY =
        lastZoomFocalPoint.y - (lastZoomFocalPoint.y - translateY) * scaleRatio;
      targetX = translateX; // Prevent pan from fighting zoom
      targetY = translateY;
    }

    if (isSettled) {
      scale = Math.max(config.minScale, Math.min(config.maxScale, scale));
      scaleVelocity = 0;
    }
    return isSettled;
  };

  const animate = () => {
    const panSettled = updatePanPhysics();
    const zoomSettled = updateZoomPhysics();

    updateTransform();

    if (panSettled && zoomSettled) {
      animationId = null;
    } else {
      animationId = requestAnimationFrame(animate);
    }
  };

  const startAnimation = () => {
    if (!animationId) animationId = requestAnimationFrame(animate);
  };

  // --- Event Handlers ---

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    // Allow interactions with form elements, buttons, etc.
    const target = e.target as HTMLElement;
    if (target.closest("[data-interactive]")) return;

    setIsDragging(true);
    setIsPinching(false);
    startX = e.clientX;
    startY = e.clientY;
    lastTranslateX = translateX;
    lastTranslateY = translateY;
    velocityX = velocityY = scaleVelocity = 0;
    startAnimation();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const rawTargetX = lastTranslateX + deltaX;
    const rawTargetY = lastTranslateY + deltaY;

    const bounds = getViewportBounds();
    const applyRubberBand = (raw: number, min: number, max: number) => {
      if (raw < min)
        return min + (raw - min) * (1 - physics.rubberBandStiffness);
      if (raw > max)
        return max + (raw - max) * (1 - physics.rubberBandStiffness);
      return raw;
    };

    targetX = applyRubberBand(rawTargetX, bounds.minX, bounds.maxX);
    targetY = applyRubberBand(rawTargetY, bounds.minY, bounds.maxY);
  };

  const onMouseUp = () => setIsDragging(false);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.closest("[data-interactive]")) return;

    const delta = e.deltaY * -config.wheelSensitivity;
    lastZoomFocalPoint = { x: e.clientX, y: e.clientY };
    scaleVelocity += delta;
    startAnimation();
  };

  const onTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-interactive]")) return;

    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1) {
      setIsDragging(true);
      setIsPinching(false);
      startX = touches[0].clientX;
      startY = touches[0].clientY;
      lastTranslateX = translateX;
      lastTranslateY = translateY;
      velocityX = velocityY = scaleVelocity = 0;
    } else if (touches.length === 2) {
      setIsDragging(false);
      setIsPinching(true);
      const t1 = touches[0],
        t2 = touches[1];
      lastPinchDist = Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY
      );
      targetScale = scale;
    }
    startAnimation();
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1 && isDragging()) {
      onMouseMove(touches[0] as unknown as MouseEvent);
    } else if (touches.length === 2 && lastPinchDist !== null) {
      const t1 = touches[0],
        t2 = touches[1];
      const newDist = Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY
      );
      targetScale *= newDist / lastPinchDist;
      lastPinchDist = newDist;
      lastZoomFocalPoint = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (isDragging()) setIsDragging(false);
    if (e.touches.length < 2) setIsPinching(false);
    if (e.touches.length === 0) setIsDragging(false);
  };

  const setup = () => {
    const containerEl = props.container();
    if (!containerEl) return;
    translateX = targetX = containerEl.clientWidth / 2;
    translateY = targetY = containerEl.clientHeight / 2;
    updateTransform();
  };

  onMount(() => {
    const containerEl = props.container();
    if (!containerEl) return;

    const backgroundEl = props.background?.();
    if (backgroundEl && props.options?.backgroundImage) {
      backgroundEl.style.backgroundImage = `url(${props.options.backgroundImage.src})`;
    }

    // Bind global listeners for dragging outside the container
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Use passive: false to be able to call e.preventDefault()
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
      // Container listeners are removed automatically by SolidJS
      observer.disconnect();
      if (animationId) cancelAnimationFrame(animationId);
    });
  });

  return {
    isDragging,
    isPinching,
    zoomIn: () => {
      const containerEl = props.container();
      if (containerEl) {
        lastZoomFocalPoint = {
          x: containerEl.clientWidth / 2,
          y: containerEl.clientHeight / 2,
        };
        scaleVelocity += 0.005;
        startAnimation();
      }
    },
    zoomOut: () => {
      const containerEl = props.container();
      if (containerEl) {
        lastZoomFocalPoint = {
          x: containerEl.clientWidth / 2,
          y: containerEl.clientHeight / 2,
        };
        scaleVelocity -= 0.005;
        startAnimation();
      }
    },
    onMouseDown,
    onWheel,
    transform: () => ({ x: translateX, y: translateY, s: scale }),
  };
};
