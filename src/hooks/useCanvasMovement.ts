import {
  createSignal,
  onCleanup,
  onMount,
  Accessor,
  createMemo,
} from "solid-js";
import { CanvasOptions, createMovementConfig } from "../lib/config";

interface HookProps {
  container: Accessor<HTMLDivElement | undefined>;
  view: Accessor<HTMLDivElement | undefined>;
  background?: Accessor<HTMLDivElement | undefined>;
  options?: CanvasOptions;
}

export const useCanvasMovement = (props: HookProps) => {
  const config = createMovementConfig(props.options);
  const { physics } = config;

  const [isDragging, setIsDragging] = createSignal(false);
  const [isPinching, setIsPinching] = createSignal(false);
  const [transformTick, setTransformTick] = createSignal(0);

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

  let lastZoomFocalPoint = { x: 0, y: 0 };
  let animationId: number | null = null;
  let lastFrameTime = 0;

  // --- Pointer State ---
  const pointers = new Map<number, { x: number; y: number }>();
  let panStartPointers = new Map<number, { x: number; y: number }>();
  let panStartTranslate = { x: 0, y: 0 };
  let lastPinchDist = 0;

  const updateTransform = () => {
    const viewEl = props.view();
    if (viewEl) {
      viewEl.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
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

  const updatePanPhysics = (dt: number) => {
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

    velocityX += forceX * dt;
    velocityY += forceY * dt;

    const frictionFactor = Math.pow(physics.panFriction, dt);
    velocityX *= frictionFactor;
    velocityY *= frictionFactor;

    translateX += velocityX * dt;
    translateY += velocityY * dt;

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

  const updateZoomPhysics = (dt: number) => {
    let currentTargetScale = targetScale;
    let isSettled = false;
    const frictionFactor = Math.pow(physics.zoomFriction, dt);

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
      scaleVelocity += scaleForce * dt;
      scaleVelocity *= frictionFactor;

      isSettled =
        Math.abs(scaleVelocity) < 0.0001 &&
        Math.abs(clampedScale - scale) < 0.001;
    }

    if (Math.abs(scaleVelocity) > 0.00001 || isPinching()) {
      const oldScale = scale;
      scale += scaleVelocity * dt;
      const scaleRatio = scale / oldScale;

      translateX =
        lastZoomFocalPoint.x - (lastZoomFocalPoint.x - translateX) * scaleRatio;
      translateY =
        lastZoomFocalPoint.y - (lastZoomFocalPoint.y - translateY) * scaleRatio;
      targetX = translateX;
      targetY = translateY;
    }

    if (isSettled) {
      scale = Math.max(config.minScale, Math.min(config.maxScale, scale));
      scaleVelocity = 0;
    }
    return isSettled;
  };

  const animate = (time: number) => {
    const dt = lastFrameTime > 0 ? (time - lastFrameTime) / 16.667 : 1;
    lastFrameTime = time;

    const panSettled = updatePanPhysics(dt);
    const zoomSettled = updateZoomPhysics(dt);

    updateTransform();
    setTransformTick((t) => t + 1);

    if (panSettled && zoomSettled) {
      animationId = null;
    } else {
      animationId = requestAnimationFrame(animate);
    }
  };

  const startAnimation = () => {
    if (!animationId) {
      lastFrameTime = 0;
      animationId = requestAnimationFrame(animate);
    }
  };

  const panStart = () => {
    setIsDragging(true);
    velocityX = velocityY = scaleVelocity = 0; // Stop all motion

    // **THE FIX**: Synchronize the target with the current position to prevent jumps
    targetX = translateX;
    targetY = translateY;

    panStartTranslate = { x: translateX, y: translateY };
    panStartPointers = new Map(pointers);
    startAnimation();
  };

  const panMove = (
    currentPointer: { x: number; y: number },
    initialPointer: { x: number; y: number }
  ) => {
    const dx = currentPointer.x - initialPointer.x;
    const dy = currentPointer.y - initialPointer.y;

    const rawTargetX = panStartTranslate.x + dx;
    const rawTargetY = panStartTranslate.y + dy;

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

  const pinchStart = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    setIsDragging(false);
    setIsPinching(true);
    lastPinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    targetScale = scale;
    startAnimation();
  };

  const pinchMove = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const newDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (lastPinchDist > 0) {
      targetScale *= newDist / lastPinchDist;
    }
    lastPinchDist = newDist;
    lastZoomFocalPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  };

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-interactive]")) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) panStart();
    if (pointers.size === 2) {
      const [p1, p2] = Array.from(pointers.values());
      pinchStart(p1, p2);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;

    const currentPointer = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, currentPointer);

    if (pointers.size === 1) {
      const initialPointer = Array.from(panStartPointers.values())[0];
      if (initialPointer) {
        panMove(currentPointer, initialPointer);
      }
    }
    if (pointers.size === 2) {
      const [p1, p2] = Array.from(pointers.values());
      pinchMove(p1, p2);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    pointers.delete(e.pointerId);

    if (pointers.size < 2) setIsPinching(false);
    if (pointers.size < 1) setIsDragging(false);

    if (pointers.size === 1) {
      panStart();
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.closest("[data-interactive]")) return;

    const delta = e.deltaY * -config.wheelSensitivity;
    lastZoomFocalPoint = { x: e.clientX, y: e.clientY };
    scaleVelocity += delta;
    startAnimation();
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

    const observer = new ResizeObserver(() => {
      startAnimation();
    });
    observer.observe(containerEl);
    setup();

    onCleanup(() => {
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
        scaleVelocity += 0.02;
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
        scaleVelocity -= 0.02;
        startAnimation();
      }
    },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    transform: createMemo(
      () => (transformTick(), { x: translateX, y: translateY, s: scale })
    ),
  };
};
