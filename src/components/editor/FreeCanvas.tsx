"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAPTION_FONT_OPTIONS,
  DEFAULT_CAPTION_BG_COLOR,
  DEFAULT_CAPTION_FONT_FAMILY,
} from "@/lib/constants";
import type { FreePhotoTransform, Photo } from "@/types";

const CAPTION_COLOR_PRESETS = [
  "#ffffff",
  "#000000",
  "#6b7280",
  "#6366f1",
  "#ef4444",
  "#f59e0b",
] as const;

const CAPTION_BG_PRESETS = [
  DEFAULT_CAPTION_BG_COLOR,
  "rgba(0,0,0,0.6)",
  "rgba(99,102,241,0.7)",
  "transparent",
] as const;

const MIN_PHOTO_SIZE = 0.05;
const MIN_CAPTION_VISIBLE_PX = 24;
const ROTATION_SNAP_TARGETS = [0, 90, -90, 180] as const;
const ROTATION_SNAP_THRESHOLD = 5;
const TOOLBAR_MARGIN_PX = 12;
const TOOLBAR_WIDTH_PX = 260;
const TOOLBAR_HEIGHT_PX = 124;

type Selection =
  | { kind: "photo"; photoId: string }
  | { kind: "caption"; photoId: string }
  | null;

type ResizeHandle = "nw" | "ne" | "se" | "sw";

type GestureState =
  | {
      type: "drag-photo";
      photoId: string;
      startClientX: number;
      startClientY: number;
      startTransform: FreePhotoTransform;
    }
  | {
      type: "drag-caption";
      photoId: string;
      startClientX: number;
      startClientY: number;
      startOffsetX: number;
      startOffsetY: number;
    }
  | {
      type: "rotate-photo";
      photoId: string;
      centerX: number;
      centerY: number;
    }
  | {
      type: "resize-photo";
      photoId: string;
      handle: ResizeHandle;
      anchorX: number;
      anchorY: number;
      aspect: number;
      rotation: number;
    };

export interface FreeCanvasInitialGesture {
  target: "photo" | "caption";
  photoId: string;
  clientX: number;
  clientY: number;
}

interface FreeCanvasProps {
  photos: Photo[];
  transforms: FreePhotoTransform[];
  containerSize: { w: number; h: number };
  mapSnapshot: string | null;
  borderRadius: number;
  onTransformsChange: (transforms: FreePhotoTransform[]) => void;
  defaultCaptionFontFamily?: string;
  defaultCaptionFontSize?: number;
  initialGesture?: FreeCanvasInitialGesture | null;
  onInitialGestureHandled?: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRotation(rotation: number): number {
  let next = rotation % 360;
  if (next <= -180) next += 360;
  if (next > 180) next -= 360;
  return next;
}

function rotateVector(x: number, y: number, angleRadians: number) {
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function getHandleDirections(handle: ResizeHandle) {
  return {
    horizontal: handle === "nw" || handle === "sw" ? -1 : 1,
    vertical: handle === "nw" || handle === "ne" ? -1 : 1,
  };
}

function getRotationSnapTarget(rotation: number): number | undefined {
  return ROTATION_SNAP_TARGETS.find(
    (target) =>
      Math.abs(normalizeRotation(rotation - target)) <= ROTATION_SNAP_THRESHOLD,
  );
}

function getCaptionTransform(transform: FreePhotoTransform) {
  return {
    offsetX: transform.caption?.offsetX ?? 0,
    offsetY: transform.caption?.offsetY ?? transform.height / 2 + 0.04,
    fontFamily: transform.caption?.fontFamily,
    fontSize: transform.caption?.fontSize,
    color: transform.caption?.color,
    bgColor: transform.caption?.bgColor ?? DEFAULT_CAPTION_BG_COLOR,
    text: transform.caption?.text,
    rotation: transform.caption?.rotation ?? 0,
  };
}

function getHandleCursor(handle: ResizeHandle): string {
  switch (handle) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
  }
}

function getCaptionToolbarPosition(
  captionCenterX: number,
  captionCenterY: number,
  containerSize: { w: number; h: number },
) {
  const safeWidth = Math.max(containerSize.w - TOOLBAR_MARGIN_PX * 2, 180);
  const toolbarWidth = Math.min(TOOLBAR_WIDTH_PX, safeWidth);
  const halfToolbarWidth = toolbarWidth / 2;
  const minToolbarLeft = halfToolbarWidth + TOOLBAR_MARGIN_PX;
  const maxToolbarLeft = Math.max(
    minToolbarLeft,
    containerSize.w - halfToolbarWidth - TOOLBAR_MARGIN_PX,
  );
  const toolbarLeft = clamp(
    captionCenterX * containerSize.w,
    minToolbarLeft,
    maxToolbarLeft,
  );
  const requestedTop = captionCenterY < 0.5
    ? captionCenterY * containerSize.h + TOOLBAR_MARGIN_PX
    : captionCenterY * containerSize.h - TOOLBAR_HEIGHT_PX - TOOLBAR_MARGIN_PX;
  const toolbarTop = clamp(
    requestedTop,
    TOOLBAR_MARGIN_PX,
    Math.max(TOOLBAR_MARGIN_PX, containerSize.h - TOOLBAR_HEIGHT_PX - TOOLBAR_MARGIN_PX),
  );

  return {
    toolbarLeft,
    toolbarTop,
    toolbarWidth,
  };
}

export default function FreeCanvas({
  photos,
  transforms,
  containerSize,
  mapSnapshot,
  borderRadius,
  onTransformsChange,
  defaultCaptionFontFamily = DEFAULT_CAPTION_FONT_FAMILY,
  defaultCaptionFontSize = 14,
  initialGesture,
  onInitialGestureHandled,
}: FreeCanvasProps) {
  const [selection, setSelection] = useState<Selection>(null);
  const [activeGesture, setActiveGesture] = useState<GestureState | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [draftCaptionText, setDraftCaptionText] = useState("");
  const [customColorInput, setCustomColorInput] = useState("");
  const transformsRef = useRef(transforms);
  const captionElementRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    transformsRef.current = transforms;
  }, [transforms]);

  const photoMap = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );

  const orderedItems = useMemo(
    () =>
      [...transforms]
        .filter((transform) => photoMap.has(transform.photoId))
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((transform) => ({ transform, photo: photoMap.get(transform.photoId)! })),
    [photoMap, transforms],
  );

  const selectedTransform = selection
    ? transforms.find((transform) => transform.photoId === selection.photoId) ?? null
    : null;
  const selectedCaptionColor = selectedTransform?.caption?.color;

  useEffect(() => {
    if (!selection || selection.kind !== "caption") {
      return;
    }

    setCustomColorInput(
      selectedCaptionColor?.startsWith("#") ? selectedCaptionColor : "",
    );
  }, [selectedCaptionColor, selection]);

  useEffect(() => {
    if (!selection) {
      return;
    }

    const hasSelectedPhoto = photos.some((photo) => photo.id === selection.photoId);
    if (!hasSelectedPhoto) {
      setSelection(null);
      setEditingCaptionId(null);
    }
  }, [photos, selection]);

  const updateTransforms = useCallback(
    (
      updater: (
        current: FreePhotoTransform[],
      ) => FreePhotoTransform[],
    ) => {
      const next = updater(transformsRef.current);
      transformsRef.current = next;
      onTransformsChange(next);
    },
    [onTransformsChange],
  );

  const getCaptionBounds = useCallback((photoId: string) => {
    const element = captionElementRefs.current.get(photoId);
    if (!element) {
      return { width: 180, height: 40 };
    }

    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  }, []);

  const bringToFront = useCallback(
    (photoId: string) => {
      updateTransforms((current) => {
        const maxZ = current.reduce((highest, transform) => Math.max(highest, transform.zIndex), 0);
        return current.map((transform) =>
          transform.photoId === photoId
            ? { ...transform, zIndex: maxZ + 1 }
            : transform,
        );
      });
    },
    [updateTransforms],
  );

  const beginPhotoDrag = useCallback(
    (photoId: string, clientX: number, clientY: number) => {
      const transform = transformsRef.current.find((item) => item.photoId === photoId);
      if (!transform) return;

      setEditingCaptionId(null);
      setSelection({ kind: "photo", photoId });
      bringToFront(photoId);
      setActiveGesture({
        type: "drag-photo",
        photoId,
        startClientX: clientX,
        startClientY: clientY,
        startTransform: transform,
      });
    },
    [bringToFront],
  );

  const beginCaptionDrag = useCallback((photoId: string, clientX: number, clientY: number) => {
    const transform = transformsRef.current.find((item) => item.photoId === photoId);
    if (!transform) return;

    const caption = getCaptionTransform(transform);
    setEditingCaptionId(null);
    setSelection({ kind: "caption", photoId });
    bringToFront(photoId);
    setActiveGesture({
      type: "drag-caption",
      photoId,
      startClientX: clientX,
      startClientY: clientY,
      startOffsetX: caption.offsetX,
      startOffsetY: caption.offsetY,
    });
  }, [bringToFront]);

  const beginRotate = useCallback((photoId: string) => {
    const transform = transformsRef.current.find((item) => item.photoId === photoId);
    if (!transform || containerSize.w <= 0 || containerSize.h <= 0) return;

    setEditingCaptionId(null);
    setSelection({ kind: "photo", photoId });
    bringToFront(photoId);
    setActiveGesture({
      type: "rotate-photo",
      photoId,
      centerX: (transform.x + transform.width / 2) * containerSize.w,
      centerY: (transform.y + transform.height / 2) * containerSize.h,
    });
  }, [bringToFront, containerSize.h, containerSize.w]);

  const beginResize = useCallback((photoId: string, handle: ResizeHandle) => {
    const transform = transformsRef.current.find((item) => item.photoId === photoId);
    if (!transform || containerSize.w <= 0 || containerSize.h <= 0) return;

    const left = transform.x * containerSize.w;
    const top = transform.y * containerSize.h;
    const width = transform.width * containerSize.w;
    const height = transform.height * containerSize.h;
    const aspect = width / Math.max(height, 1);
    const { horizontal, vertical } = getHandleDirections(handle);
    const rotation = (transform.rotation * Math.PI) / 180;
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const anchorOffset = rotateVector(
      (-horizontal * width) / 2,
      (-vertical * height) / 2,
      rotation,
    );
    const anchorX = centerX + anchorOffset.x;
    const anchorY = centerY + anchorOffset.y;

    setEditingCaptionId(null);
    setSelection({ kind: "photo", photoId });
    bringToFront(photoId);
    setActiveGesture({
      type: "resize-photo",
      photoId,
      handle,
      anchorX,
      anchorY,
      aspect,
      rotation,
    });
  }, [bringToFront, containerSize.h, containerSize.w]);

  useEffect(() => {
    if (!initialGesture || containerSize.w <= 0 || containerSize.h <= 0) {
      return;
    }

    if (initialGesture.target === "caption") {
      beginCaptionDrag(initialGesture.photoId, initialGesture.clientX, initialGesture.clientY);
    } else {
      beginPhotoDrag(initialGesture.photoId, initialGesture.clientX, initialGesture.clientY);
    }
    onInitialGestureHandled?.();
  }, [
    beginCaptionDrag,
    beginPhotoDrag,
    containerSize.h,
    containerSize.w,
    initialGesture,
    onInitialGestureHandled,
  ]);

  useEffect(() => {
    if (!activeGesture || containerSize.w <= 0 || containerSize.h <= 0) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();

      if (activeGesture.type === "drag-photo") {
        const dx = (event.clientX - activeGesture.startClientX) / containerSize.w;
        const dy = (event.clientY - activeGesture.startClientY) / containerSize.h;

        updateTransforms((current) =>
          current.map((transform) => {
            if (transform.photoId !== activeGesture.photoId) {
              return transform;
            }

            const nextX = clamp(
              activeGesture.startTransform.x + dx,
              -activeGesture.startTransform.width / 2,
              1 - activeGesture.startTransform.width / 2,
            );
            const nextY = clamp(
              activeGesture.startTransform.y + dy,
              -activeGesture.startTransform.height / 2,
              1 - activeGesture.startTransform.height / 2,
            );

            return {
              ...transform,
              x: nextX,
              y: nextY,
            };
          }),
        );
        return;
      }

      if (activeGesture.type === "drag-caption") {
        const dx = (event.clientX - activeGesture.startClientX) / containerSize.w;
        const dy = (event.clientY - activeGesture.startClientY) / containerSize.h;

        updateTransforms((current) =>
          current.map((transform) => {
            if (transform.photoId !== activeGesture.photoId) {
              return transform;
            }

            const caption = getCaptionTransform(transform);
            const { width, height } = getCaptionBounds(transform.photoId);
            const visibleWidth = Math.min(MIN_CAPTION_VISIBLE_PX, width / 2);
            const visibleHeight = Math.min(MIN_CAPTION_VISIBLE_PX, height / 2);
            const photoCenterX = transform.x + transform.width / 2;
            const photoCenterY = transform.y + transform.height / 2;
            const nextCenterX = clamp(
              photoCenterX + activeGesture.startOffsetX + dx,
              (visibleWidth - width / 2) / containerSize.w,
              (containerSize.w + width / 2 - visibleWidth) / containerSize.w,
            );
            const nextCenterY = clamp(
              photoCenterY + activeGesture.startOffsetY + dy,
              (visibleHeight - height / 2) / containerSize.h,
              (containerSize.h + height / 2 - visibleHeight) / containerSize.h,
            );

            return {
              ...transform,
              caption: {
                ...caption,
                offsetX: nextCenterX - photoCenterX,
                offsetY: nextCenterY - photoCenterY,
              },
            };
          }),
        );
        return;
      }

      if (activeGesture.type === "rotate-photo") {
        const rawAngle =
          (Math.atan2(event.clientY - activeGesture.centerY, event.clientX - activeGesture.centerX) * 180) /
            Math.PI +
          90;
        let nextAngle = normalizeRotation(rawAngle);
        if (!event.shiftKey) {
          const snapTarget = getRotationSnapTarget(nextAngle);
          if (snapTarget !== undefined) {
            nextAngle = normalizeRotation(snapTarget);
          }
        }

        updateTransforms((current) =>
          current.map((transform) =>
            transform.photoId === activeGesture.photoId
              ? { ...transform, rotation: nextAngle }
              : transform,
          ),
        );
        return;
      }

      const { horizontal: horizontalDirection, vertical: verticalDirection } =
        getHandleDirections(activeGesture.handle);
      const minWidth = containerSize.w * MIN_PHOTO_SIZE;
      const minHeight = containerSize.h * MIN_PHOTO_SIZE;
      const localPointerDelta = rotateVector(
        event.clientX - activeGesture.anchorX,
        event.clientY - activeGesture.anchorY,
        -activeGesture.rotation,
      );
      const desiredWidth = Math.max(
        minWidth,
        localPointerDelta.x * horizontalDirection,
      );
      const desiredHeight = Math.max(
        minHeight,
        localPointerDelta.y * verticalDirection,
      );

      let nextWidth = desiredWidth;
      let nextHeight = nextWidth / Math.max(activeGesture.aspect, 0.01);

      if (nextHeight < desiredHeight) {
        nextHeight = desiredHeight;
        nextWidth = nextHeight * activeGesture.aspect;
      }

      const draggedCornerOffset = rotateVector(
        horizontalDirection * nextWidth,
        verticalDirection * nextHeight,
        activeGesture.rotation,
      );
      const nextCenterX = clamp(
        activeGesture.anchorX + draggedCornerOffset.x / 2,
        0,
        containerSize.w,
      );
      const nextCenterY = clamp(
        activeGesture.anchorY + draggedCornerOffset.y / 2,
        0,
        containerSize.h,
      );
      const nextX = nextCenterX / containerSize.w - nextWidth / (2 * containerSize.w);
      const nextY = nextCenterY / containerSize.h - nextHeight / (2 * containerSize.h);

      updateTransforms((current) =>
        current.map((transform) =>
          transform.photoId === activeGesture.photoId
            ? {
                ...transform,
                x: nextX,
                y: nextY,
                width: nextWidth / containerSize.w,
                height: nextHeight / containerSize.h,
              }
            : transform,
        ),
      );
    };

    const handlePointerUp = () => {
      setActiveGesture(null);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor =
      activeGesture.type === "drag-photo" || activeGesture.type === "drag-caption"
        ? "grabbing"
        : activeGesture.type === "rotate-photo"
          ? "crosshair"
          : getHandleCursor(activeGesture.handle);
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [activeGesture, containerSize.h, containerSize.w, getCaptionBounds, updateTransforms]);

  useEffect(() => {
    if (!editingCaptionId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setEditingCaptionId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingCaptionId]);

  const commitCaptionText = useCallback((photoId: string, text: string) => {
    updateTransforms((current) =>
      current.map((transform) => {
        if (transform.photoId !== photoId) {
          return transform;
        }

        const caption = getCaptionTransform(transform);
        return {
          ...transform,
          caption: {
            ...caption,
            text,
          },
        };
      }),
    );
  }, [updateTransforms]);

  const applyCaptionStyle = useCallback(
    (
      photoId: string,
      updates: Partial<NonNullable<FreePhotoTransform["caption"]>>,
    ) => {
      updateTransforms((current) =>
        current.map((transform) => {
          if (transform.photoId !== photoId) {
            return transform;
          }

          const caption = getCaptionTransform(transform);
          return {
            ...transform,
            caption: {
              ...caption,
              ...updates,
            },
          };
        }),
      );
    },
    [updateTransforms],
  );

  // Scale caption font proportionally to container width (reference: 1000px) to match PhotoOverlay
  const captionScale = containerSize.w > 0 ? containerSize.w / 1000 : 1;

  return (
    <div
      className="absolute inset-0 z-20"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          setSelection(null);
          setEditingCaptionId(null);
        }
      }}
      style={mapSnapshot ? { backgroundImage: `url(${mapSnapshot})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {orderedItems.map(({ transform, photo }) => {
        const caption = getCaptionTransform(transform);
        const scaledCaptionFontSize = (caption.fontSize ?? defaultCaptionFontSize) * captionScale;
        const captionText = caption.text ?? photo.caption ?? "";
        const captionShouldRender =
          Boolean(captionText) ||
          selection?.photoId === photo.id ||
          editingCaptionId === photo.id;
        const photoSelected = selection?.kind === "photo" && selection.photoId === photo.id;
        const captionSelected = selection?.kind === "caption" && selection.photoId === photo.id;
        const captionCenterX = transform.x + transform.width / 2 + caption.offsetX;
        const captionCenterY = transform.y + transform.height / 2 + caption.offsetY;
        const toolbarPosition = getCaptionToolbarPosition(
          captionCenterX,
          captionCenterY,
          containerSize,
        );

        return (
          <Fragment key={photo.id}>
            <div
              className="absolute cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={(event) => {
                event.stopPropagation();
                beginPhotoDrag(photo.id, event.clientX, event.clientY);
              }}
              style={{
                left: `${transform.x * 100}%`,
                top: `${transform.y * 100}%`,
                width: `${transform.width * 100}%`,
                height: `${transform.height * 100}%`,
                transform: `rotate(${transform.rotation}deg)`,
                transformOrigin: "center",
                zIndex: transform.zIndex,
              }}
            >
              <img
                src={photo.url}
                alt={photo.caption || "Photo"}
                className="h-full w-full select-none object-cover shadow-xl"
                draggable={false}
                style={{
                  borderRadius: `${borderRadius}px`,
                  objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%`,
                }}
              />
              {photoSelected ? (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[inherit] border border-dashed border-indigo-500"
                    style={{ borderRadius: `${borderRadius}px` }}
                  />
                  <div className="pointer-events-none absolute left-1/2 top-0 h-7 -translate-x-1/2 -translate-y-full border-l border-indigo-500" />
                  <button
                    type="button"
                    className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-[150%] rounded-full border-2 border-white bg-indigo-500 shadow-sm"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      beginRotate(photo.id);
                    }}
                    aria-label="Rotate photo"
                  />
                  {([
                    ["nw", "left-0 top-0 -translate-x-1/2 -translate-y-1/2"],
                    ["ne", "right-0 top-0 translate-x-1/2 -translate-y-1/2"],
                    ["se", "right-0 bottom-0 translate-x-1/2 translate-y-1/2"],
                    ["sw", "left-0 bottom-0 -translate-x-1/2 translate-y-1/2"],
                  ] as Array<[ResizeHandle, string]>).map(([handle, className]) => (
                    <button
                      key={`${photo.id}-${handle}`}
                      type="button"
                      className={`absolute h-4 w-4 rounded-full border-2 border-white bg-indigo-500 shadow-sm ${className}`}
                      style={{ cursor: getHandleCursor(handle) }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        beginResize(photo.id, handle);
                      }}
                      aria-label={`Resize photo from ${handle} corner`}
                    />
                  ))}
                </>
              ) : null}
            </div>

            {captionShouldRender ? (
              <>
                <div
                  className={`absolute max-w-[40%] touch-none ${editingCaptionId === photo.id ? "" : "cursor-grab active:cursor-grabbing"}`}
                  onPointerDown={(event) => {
                    if (editingCaptionId === photo.id) {
                      return;
                    }

                    event.stopPropagation();
                    beginCaptionDrag(photo.id, event.clientX, event.clientY);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setSelection({ kind: "caption", photoId: photo.id });
                    setEditingCaptionId(photo.id);
                    setDraftCaptionText(captionText);
                  }}
                  style={{
                    left: `${captionCenterX * 100}%`,
                    top: `${captionCenterY * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${caption.rotation}deg)`,
                    zIndex: transform.zIndex + 1,
                  }}
                >
                  {editingCaptionId === photo.id ? (
                    <input
                      ref={(node) => {
                        if (node) {
                          captionElementRefs.current.set(photo.id, node);
                        } else {
                          captionElementRefs.current.delete(photo.id);
                        }
                      }}
                      autoFocus
                      value={draftCaptionText}
                      onChange={(event) => setDraftCaptionText(event.target.value)}
                      onBlur={() => {
                        commitCaptionText(photo.id, draftCaptionText);
                        setEditingCaptionId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitCaptionText(photo.id, draftCaptionText);
                          setEditingCaptionId(null);
                        } else if (event.key === "Escape") {
                          setEditingCaptionId(null);
                        }
                      }}
                      className="w-[180px] rounded-md border border-indigo-300 bg-white/95 px-2 py-1 text-center text-sm text-gray-900 shadow-lg outline-none focus:border-indigo-500"
                      style={{
                        fontFamily: caption.fontFamily ?? defaultCaptionFontFamily,
                        fontSize: `${scaledCaptionFontSize}px`,
                      }}
                    />
                  ) : (
                    <div
                      ref={(node) => {
                        if (node) {
                          captionElementRefs.current.set(photo.id, node);
                        } else {
                          captionElementRefs.current.delete(photo.id);
                        }
                      }}
                      className={`rounded-md px-2 py-1 text-center shadow-sm ${
                        captionSelected ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white/20" : ""
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelection({ kind: "caption", photoId: photo.id });
                      }}
                      style={{
                        backgroundColor: caption.bgColor,
                        color: caption.color ?? "#ffffff",
                        fontFamily: caption.fontFamily ?? defaultCaptionFontFamily,
                        fontSize: `${scaledCaptionFontSize}px`,
                        textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                      }}
                    >
                      {captionText || "Add caption"}
                    </div>
                  )}
                </div>

                {captionSelected && editingCaptionId !== photo.id ? (
                  <div
                    className="absolute z-10 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-white/95 px-3 py-2 shadow-xl"
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{
                      left: `${toolbarPosition.toolbarLeft}px`,
                      top: `${toolbarPosition.toolbarTop}px`,
                      width: `${toolbarPosition.toolbarWidth}px`,
                      transform: "translateX(-50%)",
                      zIndex: transform.zIndex + 2,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-indigo-500"
                        style={{ fontFamily: caption.fontFamily ?? defaultCaptionFontFamily }}
                        value={caption.fontFamily ?? defaultCaptionFontFamily}
                        onChange={(event) => applyCaptionStyle(photo.id, { fontFamily: event.target.value })}
                      >
                        {CAPTION_FONT_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            style={{ fontFamily: option.value }}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="range"
                        min={10}
                        max={64}
                        step={1}
                        value={caption.fontSize ?? defaultCaptionFontSize}
                        onChange={(event) => applyCaptionStyle(photo.id, { fontSize: Number(event.target.value) })}
                        className="h-1 w-24 accent-indigo-500"
                      />
                      <span className="w-10 text-right text-[10px] text-gray-500">
                        {caption.fontSize ?? defaultCaptionFontSize}px
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-9 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
                        Text
                      </span>
                      <div className="flex items-center gap-1">
                        {CAPTION_COLOR_PRESETS.map((color) => (
                          <button
                            key={`${photo.id}-${color}`}
                            type="button"
                            className={`h-5 w-5 rounded-full border ${
                              (caption.color ?? "#ffffff") === color ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => applyCaptionStyle(photo.id, { color })}
                            aria-label={`Set caption color ${color}`}
                          />
                        ))}
                      </div>
                      <input
                        type="text"
                        value={customColorInput}
                        onChange={(event) => setCustomColorInput(event.target.value)}
                        onBlur={() => {
                          if (customColorInput.trim()) {
                            applyCaptionStyle(photo.id, { color: customColorInput.trim() });
                          }
                        }}
                        placeholder="#6366f1"
                        className="h-8 w-20 rounded-md border border-gray-200 px-2 text-xs text-gray-700 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-9 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
                        Fill
                      </span>
                      <div className="flex items-center gap-1">
                        {CAPTION_BG_PRESETS.map((color) => (
                          <button
                            key={`${photo.id}-bg-${color}`}
                            type="button"
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold ${
                              caption.bgColor === color ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200"
                            }`}
                            style={{
                              backgroundColor: color === "transparent" ? "#ffffff" : color,
                              color: color === "transparent" ? "#6b7280" : "transparent",
                              backgroundImage: color === "transparent"
                                ? "linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)"
                                : undefined,
                            }}
                            onClick={() => applyCaptionStyle(photo.id, { bgColor: color })}
                            aria-label={`Set caption background ${color}`}
                          >
                            {color === "transparent" ? "T" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
