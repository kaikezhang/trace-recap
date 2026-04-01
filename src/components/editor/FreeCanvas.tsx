"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAPTION_FONT_OPTIONS,
  DEFAULT_CAPTION_BG_COLOR,
  DEFAULT_CAPTION_FONT_FAMILY,
} from "@/lib/constants";
import { useHistoryStore } from "@/stores/historyStore";
import { useUIStore } from "@/stores/uiStore";
import PhotoFrame from "./PhotoFrame";
import type { FreePhotoTransform, Photo } from "@/types";

const CAPTION_COLOR_PRESETS = [
  "#ffffff",
  "#000000",
  "#6b7280",
  "#6366f1",
  "#ef4444",
  "#f59e0b",
] as const;

const CAPTION_BG_PRIMARY = [
  "rgba(0,0,0,0.5)",
  "rgba(255,255,255,0.8)",
  "rgba(99,102,241,0.7)",
  "rgba(239,68,68,0.6)",
  "rgba(245,158,11,0.6)",
  "transparent",
] as const;

const CAPTION_BG_EXTENDED = [
  "rgba(16,185,129,0.6)",
  "rgba(59,130,246,0.6)",
  "rgba(168,85,247,0.6)",
  "rgba(236,72,153,0.6)",
  "rgba(20,184,166,0.6)",
  "rgba(251,146,60,0.6)",
  "rgba(34,197,94,0.6)",
  "rgba(100,116,139,0.6)",
  "rgba(30,41,59,0.7)",
  "rgba(120,53,15,0.6)",
  "rgba(157,23,77,0.6)",
  "rgba(21,94,117,0.6)",
  "rgba(63,63,70,0.7)",
  "rgba(185,28,28,0.6)",
] as const;

/** Convert rgba(...) or hex to a short display label */
function bgColorDisplayHex(color: string): string {
  if (color === "transparent") return "";
  if (color.startsWith("#")) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color;
  const hex = `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
  return hex;
}

const MIN_PHOTO_SIZE = 0.05;
const MIN_CAPTION_VISIBLE_PX = 24;
const ROTATION_SNAP_TARGETS = [0, 90, -90, 180] as const;
const ROTATION_SNAP_THRESHOLD = 3;
const TOOLBAR_MARGIN_PX = 12;
const TOOLBAR_WIDTH_PX = 320;
const TOOLBAR_HEIGHT_PX = 132;
const MARQUEE_DRAG_THRESHOLD_PX = 4;

type Selection = {
  photoIds: string[];
  captionIds: string[];
} | null;

type SelectionKind = "photo" | "caption";

interface SelectionTarget {
  kind: SelectionKind;
  photoId: string;
}

type ResizeHandle = "nw" | "ne" | "se" | "sw";

type GestureState =
  | {
      type: "drag-selection";
      startClientX: number;
      startClientY: number;
      pointerTarget: SelectionTarget;
      shouldNarrowSelectionOnClick: boolean;
      photoStarts: Array<{
        photoId: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      captionStarts: Array<{
        photoId: string;
        offsetX: number;
        offsetY: number;
      }>;
    }
  | {
      type: "marquee-select";
      startClientX: number;
      startClientY: number;
      containerRect: DOMRect;
    }
  | {
      type: "rotate-photo";
      photoId: string;
      centerClientX: number;
      centerClientY: number;
      startAngle: number;
      startRotation: number;
    }
  | {
      type: "resize-photo";
      photoId: string;
      handle: ResizeHandle;
      anchorX: number;
      anchorY: number;
      aspect: number;
      rotation: number;
      containerOffsetX: number;
      containerOffsetY: number;
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

interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
  const maxToolbarLeft = Math.max(
    TOOLBAR_MARGIN_PX,
    containerSize.w - toolbarWidth - TOOLBAR_MARGIN_PX,
  );
  const requestedLeft = captionCenterX * containerSize.w - toolbarWidth / 2;
  const toolbarLeft = clamp(requestedLeft, TOOLBAR_MARGIN_PX, maxToolbarLeft);
  const belowTop = captionCenterY * containerSize.h + TOOLBAR_MARGIN_PX;
  const aboveTop = captionCenterY * containerSize.h - TOOLBAR_HEIGHT_PX - TOOLBAR_MARGIN_PX;
  const fitsBelow = belowTop + TOOLBAR_HEIGHT_PX <= containerSize.h - TOOLBAR_MARGIN_PX;
  const requestedTop = fitsBelow ? belowTop : aboveTop;
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

function normalizeSelection(selection: { photoIds: string[]; captionIds: string[] }): Selection {
  const photoIds = [...new Set(selection.photoIds)];
  const captionIds = [...new Set(selection.captionIds)];
  return photoIds.length > 0 || captionIds.length > 0 ? { photoIds, captionIds } : null;
}

function arraysEqualAsSets(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  if (leftSet.size !== right.length) {
    return false;
  }

  return right.every((item) => leftSet.has(item));
}

function selectionsEqual(left: Selection, right: Selection): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return left === right;
  }

  return (
    arraysEqualAsSets(left.photoIds, right.photoIds) &&
    arraysEqualAsSets(left.captionIds, right.captionIds)
  );
}

function createSingleSelection(target: SelectionTarget): Selection {
  return target.kind === "photo"
    ? { photoIds: [target.photoId], captionIds: [] }
    : { photoIds: [], captionIds: [target.photoId] };
}

function isSelectionTargetSelected(selection: Selection, target: SelectionTarget): boolean {
  if (!selection) {
    return false;
  }
  return target.kind === "photo"
    ? selection.photoIds.includes(target.photoId)
    : selection.captionIds.includes(target.photoId);
}

function toggleSelectionTarget(selection: Selection, target: SelectionTarget): Selection {
  if (!selection) {
    return createSingleSelection(target);
  }

  const ids = target.kind === "photo" ? selection.photoIds : selection.captionIds;
  const nextIds = ids.includes(target.photoId)
    ? ids.filter((photoId) => photoId !== target.photoId)
    : [...ids, target.photoId];

  return normalizeSelection(
    target.kind === "photo"
      ? { photoIds: nextIds, captionIds: selection.captionIds }
      : { photoIds: selection.photoIds, captionIds: nextIds },
  );
}

function getSelectionTransformIds(selection: Selection): string[] {
  if (!selection) {
    return [];
  }

  return [...new Set([...selection.photoIds, ...selection.captionIds])];
}

function getSelectionItemCount(selection: Selection): number {
  if (!selection) {
    return 0;
  }

  return selection.photoIds.length + selection.captionIds.length;
}

function createMarqueeRect(
  startClientX: number,
  startClientY: number,
  currentClientX: number,
  currentClientY: number,
  containerRect: DOMRect,
): MarqueeRect {
  const startX = clamp(startClientX - containerRect.left, 0, containerRect.width);
  const startY = clamp(startClientY - containerRect.top, 0, containerRect.height);
  const currentX = clamp(currentClientX - containerRect.left, 0, containerRect.width);
  const currentY = clamp(currentClientY - containerRect.top, 0, containerRect.height);
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

function rectContains(outer: MarqueeRect, inner: MarqueeRect): boolean {
  return inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width &&
    inner.top + inner.height <= outer.top + outer.height;
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
  const [bgExpanded, setBgExpanded] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const photoFrameStyle = useUIStore((s) => s.photoFrameStyle);
  // Local gesture state: during drag/rotate/resize we update this instead of
  // calling onTransformsChange every frame. Committed on pointerup.
  const [liveTransforms, setLiveTransforms] = useState<FreePhotoTransform[] | null>(null);
  const transformsRef = useRef(transforms);
  const captionElementRefs = useRef(new Map<string, HTMLElement>());
  const marqueeRectRef = useRef<MarqueeRect | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    transformsRef.current = liveTransforms ?? transforms;
  }, [liveTransforms, transforms]);

  const photoMap = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );

  // Use liveTransforms during gestures, fall back to prop transforms
  const effectiveTransforms = liveTransforms ?? transforms;
  const orderedItems = useMemo(
    () =>
      [...effectiveTransforms]
        .filter((transform) => photoMap.has(transform.photoId))
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((transform) => ({ transform, photo: photoMap.get(transform.photoId)! })),
    [photoMap, effectiveTransforms],
  );
  const transformMap = useMemo(
    () => new Map(effectiveTransforms.map((transform) => [transform.photoId, transform])),
    [effectiveTransforms],
  );
  const emptyIds = useMemo<string[]>(() => [], []);
  const selectedPhotoIds = selection?.photoIds ?? emptyIds;
  const selectedCaptionIds = selection?.captionIds ?? emptyIds;
  const selectedPhotoIdSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const selectedCaptionIdSet = useMemo(() => new Set(selectedCaptionIds), [selectedCaptionIds]);
  const singleSelectedPhotoId =
    selectedPhotoIds.length === 1 && selectedCaptionIds.length === 0
      ? selectedPhotoIds[0]
      : null;
  const selectedCaptionToolbarState = useMemo(() => {
    if (selectedCaptionIds.length === 0) {
      return null;
    }

    const selectedCaptionEntries = selectedCaptionIds
      .map((photoId) => transformMap.get(photoId))
      .filter((transform): transform is FreePhotoTransform => Boolean(transform))
      .map((transform) => {
        const caption = getCaptionTransform(transform);
        return {
          photoId: transform.photoId,
          caption,
          centerX: transform.x + transform.width / 2 + caption.offsetX,
          centerY: transform.y + transform.height / 2 + caption.offsetY,
          fontFamily: caption.fontFamily ?? defaultCaptionFontFamily,
          fontSize: caption.fontSize ?? defaultCaptionFontSize,
          color: caption.color ?? "#ffffff",
          bgColor: caption.bgColor ?? DEFAULT_CAPTION_BG_COLOR,
        };
      });

    if (selectedCaptionEntries.length === 0) {
      return null;
    }

    const [firstCaption] = selectedCaptionEntries;
    return {
      photoIds: selectedCaptionEntries.map((entry) => entry.photoId),
      fontFamily: firstCaption.fontFamily,
      fontFamilyMixed: selectedCaptionEntries.some((entry) => entry.fontFamily !== firstCaption.fontFamily),
      fontSize: firstCaption.fontSize,
      fontSizeMixed: selectedCaptionEntries.some((entry) => entry.fontSize !== firstCaption.fontSize),
      color: firstCaption.color,
      colorMixed: selectedCaptionEntries.some((entry) => entry.color !== firstCaption.color),
      bgColor: firstCaption.bgColor,
      bgColorMixed: selectedCaptionEntries.some((entry) => entry.bgColor !== firstCaption.bgColor),
      toolbarPosition: getCaptionToolbarPosition(firstCaption.centerX, firstCaption.centerY, containerSize),
    };
  }, [
    containerSize,
    defaultCaptionFontFamily,
    defaultCaptionFontSize,
    selectedCaptionIds,
    transformMap,
  ]);

  /** Update transforms locally during a gesture — no store write, only local re-render */
  const updateTransformsLocal = useCallback(
    (
      updater: (
        current: FreePhotoTransform[],
      ) => FreePhotoTransform[],
    ) => {
      const next = updater(transformsRef.current);
      transformsRef.current = next;
      setLiveTransforms(next);
    },
    [],
  );

  /** Commit current transforms to the store (call on gesture end) */
  const commitTransforms = useCallback(() => {
    onTransformsChange(transformsRef.current);
    setLiveTransforms(null);
  }, [onTransformsChange]);

  /** Update transforms and immediately write to store (for non-gesture changes) */
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

  useEffect(() => {
    const validPhotoIds = new Set(photos.map((photo) => photo.id));
    const nextSelection = selection
      ? normalizeSelection({
          photoIds: selection.photoIds.filter((photoId) => validPhotoIds.has(photoId)),
          captionIds: selection.captionIds.filter((photoId) => validPhotoIds.has(photoId)),
        })
      : null;

    if (!selectionsEqual(selection, nextSelection)) {
      setSelection(nextSelection);
    }

    if (editingCaptionId && !validPhotoIds.has(editingCaptionId)) {
      setEditingCaptionId(null);
    }
  }, [editingCaptionId, photos, selection]);

  useEffect(() => {
    if (!selectedCaptionToolbarState) {
      setCustomColorInput("");
      return;
    }

    setCustomColorInput(
      !selectedCaptionToolbarState.colorMixed && selectedCaptionToolbarState.color.startsWith("#")
        ? selectedCaptionToolbarState.color
        : "",
    );
  }, [selectedCaptionToolbarState]);

  const bringSelectionToFront = useCallback(
    (photoIds: string[]) => {
      const uniquePhotoIds = [...new Set(photoIds)];
      if (uniquePhotoIds.length === 0) {
        return;
      }

      updateTransforms((current) => {
        const maxZ = current.reduce((highest, transform) => Math.max(highest, transform.zIndex), 0);
        const selectedTransforms = current
          .filter((transform) => uniquePhotoIds.includes(transform.photoId))
          .sort((a, b) => a.zIndex - b.zIndex);
        const nextZIndexByPhotoId = new Map(
          selectedTransforms.map((transform, index) => [transform.photoId, maxZ + index + 1]),
        );

        return current.map((transform) =>
          nextZIndexByPhotoId.has(transform.photoId)
            ? { ...transform, zIndex: nextZIndexByPhotoId.get(transform.photoId)! }
            : transform,
        );
      });
    },
    [updateTransforms],
  );

  const getSelectionFromMarquee = useCallback(
    (nextMarqueeRect: MarqueeRect): Selection => {
      const photoIds: string[] = [];
      const captionIds: string[] = [];

      for (const transform of transformsRef.current) {
        const photoBounds = {
          left: transform.x * containerSize.w,
          top: transform.y * containerSize.h,
          width: transform.width * containerSize.w,
          height: transform.height * containerSize.h,
        };
        if (rectContains(nextMarqueeRect, photoBounds)) {
          photoIds.push(transform.photoId);
        }

        const captionElement = captionElementRefs.current.get(transform.photoId);
        if (captionElement) {
          const caption = getCaptionTransform(transform);
          const { width, height } = captionElement.getBoundingClientRect();
          const captionCenterX = (transform.x + transform.width / 2 + caption.offsetX) * containerSize.w;
          const captionCenterY = (transform.y + transform.height / 2 + caption.offsetY) * containerSize.h;
          const captionBounds = {
            left: captionCenterX - width / 2,
            top: captionCenterY - height / 2,
            width,
            height,
          };
          if (rectContains(nextMarqueeRect, captionBounds)) {
            captionIds.push(transform.photoId);
          }
        }
      }

      return normalizeSelection({ photoIds, captionIds });
    },
    [containerSize.h, containerSize.w, getCaptionBounds],
  );

  const startSelectionDrag = useCallback(
    (
      nextSelection: Selection,
      clientX: number,
      clientY: number,
      pointerTarget: SelectionTarget,
      shouldNarrowSelectionOnClick: boolean,
    ) => {
      if (!nextSelection) {
        return;
      }

      const selectedPhotoIdSet = new Set(nextSelection.photoIds);
      const selectedCaptionIdSet = new Set(nextSelection.captionIds);
      const photoStarts = transformsRef.current
        .filter((transform) => selectedPhotoIdSet.has(transform.photoId))
        .map((transform) => ({
          photoId: transform.photoId,
          x: transform.x,
          y: transform.y,
          width: transform.width,
          height: transform.height,
        }));
      const captionStarts = transformsRef.current
        .filter(
          (transform) =>
            selectedCaptionIdSet.has(transform.photoId) && !selectedPhotoIdSet.has(transform.photoId),
        )
        .map((transform) => {
          const caption = getCaptionTransform(transform);
          return {
            photoId: transform.photoId,
            offsetX: caption.offsetX,
            offsetY: caption.offsetY,
          };
        });

      didDragRef.current = false;
      setActiveGesture({
        type: "drag-selection",
        startClientX: clientX,
        startClientY: clientY,
        pointerTarget,
        shouldNarrowSelectionOnClick,
        photoStarts,
        captionStarts,
      });
    },
    [],
  );

  const handleSelectablePointerDown = useCallback(
    (target: SelectionTarget, clientX: number, clientY: number, extendSelection: boolean) => {
      setEditingCaptionId(null);

      if (extendSelection) {
        setSelection((current) => toggleSelectionTarget(current, target));
        return;
      }

      // Snapshot state before drag starts so undo reverts the whole gesture
      useHistoryStore.getState().pushState();

      const targetAlreadySelected = isSelectionTargetSelected(selection, target);
      const shouldNarrowSelectionOnClick =
        targetAlreadySelected && getSelectionItemCount(selection) > 1;
      const nextSelection = targetAlreadySelected
        ? selection ?? createSingleSelection(target)
        : createSingleSelection(target);
      setSelection(nextSelection);
      bringSelectionToFront(getSelectionTransformIds(nextSelection));
      startSelectionDrag(
        nextSelection,
        clientX,
        clientY,
        target,
        shouldNarrowSelectionOnClick,
      );
    },
    [bringSelectionToFront, selection, startSelectionDrag],
  );

  const beginRotate = useCallback((photoId: string, clientX: number, clientY: number) => {
    const transform = transformsRef.current.find((item) => item.photoId === photoId);
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!transform || !canvasRect || containerSize.w <= 0 || containerSize.h <= 0) return;

    // Snapshot state before rotation starts
    useHistoryStore.getState().pushState();

    const centerClientX = canvasRect.left + (transform.x + transform.width / 2) * containerSize.w;
    const centerClientY = canvasRect.top + (transform.y + transform.height / 2) * containerSize.h;
    const startAngle =
      (Math.atan2(clientY - centerClientY, clientX - centerClientX) * 180) / Math.PI + 90;

    setEditingCaptionId(null);
    const nextSelection = createSingleSelection({ kind: "photo", photoId });
    setSelection(nextSelection);
    bringSelectionToFront(getSelectionTransformIds(nextSelection));
    setActiveGesture({
      type: "rotate-photo",
      photoId,
      centerClientX,
      centerClientY,
      startAngle,
      startRotation: transform.rotation,
    });
  }, [bringSelectionToFront, containerSize.h, containerSize.w]);

  const beginResize = useCallback((photoId: string, handle: ResizeHandle, clientX: number, clientY: number, containerEl: HTMLElement | null) => {
    const transform = transformsRef.current.find((item) => item.photoId === photoId);
    if (!transform || containerSize.w <= 0 || containerSize.h <= 0) return;

    // Snapshot state before resize starts
    useHistoryStore.getState().pushState();

    const rect = containerEl?.getBoundingClientRect();
    const containerOffsetX = rect?.left ?? 0;
    const containerOffsetY = rect?.top ?? 0;

    const width = transform.width * containerSize.w;
    const height = transform.height * containerSize.h;
    const aspect = width / Math.max(height, 1);
    const { horizontal, vertical } = getHandleDirections(handle);
    const rotation = (transform.rotation * Math.PI) / 180;
    // The dragged corner is where the pointer is now (screen coords).
    // The anchor is the opposite corner — offset by the full diagonal in screen coords.
    const diagonalOffset = rotateVector(
      -horizontal * width,
      -vertical * height,
      rotation,
    );
    const anchorX = clientX + diagonalOffset.x;
    const anchorY = clientY + diagonalOffset.y;

    setEditingCaptionId(null);
    const nextSelection = createSingleSelection({ kind: "photo", photoId });
    setSelection(nextSelection);
    bringSelectionToFront(getSelectionTransformIds(nextSelection));
    setActiveGesture({
      type: "resize-photo",
      photoId,
      handle,
      anchorX,
      anchorY,
      aspect,
      rotation,
      containerOffsetX,
      containerOffsetY,
    });
  }, [bringSelectionToFront, containerSize.h, containerSize.w]);

  useEffect(() => {
    if (!initialGesture || containerSize.w <= 0 || containerSize.h <= 0) {
      return;
    }

    handleSelectablePointerDown(
      { kind: initialGesture.target, photoId: initialGesture.photoId },
      initialGesture.clientX,
      initialGesture.clientY,
      false,
    );
    onInitialGestureHandled?.();
  }, [
    containerSize.h,
    containerSize.w,
    handleSelectablePointerDown,
    initialGesture,
    onInitialGestureHandled,
  ]);

  useEffect(() => {
    if (!activeGesture || containerSize.w <= 0 || containerSize.h <= 0) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();

      if (activeGesture.type === "marquee-select") {
        const nextMarqueeRect = createMarqueeRect(
          activeGesture.startClientX,
          activeGesture.startClientY,
          event.clientX,
          event.clientY,
          activeGesture.containerRect,
        );
        marqueeRectRef.current = nextMarqueeRect;
        setMarqueeRect(nextMarqueeRect);
        if (
          nextMarqueeRect.width >= MARQUEE_DRAG_THRESHOLD_PX ||
          nextMarqueeRect.height >= MARQUEE_DRAG_THRESHOLD_PX
        ) {
          setSelection(getSelectionFromMarquee(nextMarqueeRect));
        }
        return;
      }

      if (activeGesture.type === "drag-selection") {
        if (
          !didDragRef.current &&
          Math.abs(event.clientX - activeGesture.startClientX) < MARQUEE_DRAG_THRESHOLD_PX &&
          Math.abs(event.clientY - activeGesture.startClientY) < MARQUEE_DRAG_THRESHOLD_PX
        ) {
          return;
        }

        didDragRef.current = true;
        const dx = (event.clientX - activeGesture.startClientX) / containerSize.w;
        const dy = (event.clientY - activeGesture.startClientY) / containerSize.h;

        const clampedDx = activeGesture.photoStarts.reduce(
          (nextDx, transform) =>
            clamp(
              nextDx,
              -transform.x - transform.width / 2,
              1 - transform.x - transform.width / 2,
            ),
          dx,
        );
        const clampedDy = activeGesture.photoStarts.reduce(
          (nextDy, transform) =>
            clamp(
              nextDy,
              -transform.y - transform.height / 2,
              1 - transform.y - transform.height / 2,
            ),
          dy,
        );
        const captionStartMap = new Map(
          activeGesture.captionStarts.map((captionStart) => [captionStart.photoId, captionStart]),
        );
        let limitedDx = clampedDx;
        let limitedDy = clampedDy;

        for (const captionStart of activeGesture.captionStarts) {
          const transform = transformsRef.current.find((item) => item.photoId === captionStart.photoId);
          if (!transform) {
            continue;
          }

          const { width, height } = getCaptionBounds(transform.photoId);
          const visibleWidth = Math.min(MIN_CAPTION_VISIBLE_PX, width / 2);
          const visibleHeight = Math.min(MIN_CAPTION_VISIBLE_PX, height / 2);
          const photoCenterX = transform.x + transform.width / 2;
          const photoCenterY = transform.y + transform.height / 2;
          limitedDx = clamp(
            limitedDx,
            (visibleWidth - width / 2) / containerSize.w - photoCenterX - captionStart.offsetX,
            (containerSize.w + width / 2 - visibleWidth) / containerSize.w - photoCenterX - captionStart.offsetX,
          );
          limitedDy = clamp(
            limitedDy,
            (visibleHeight - height / 2) / containerSize.h - photoCenterY - captionStart.offsetY,
            (containerSize.h + height / 2 - visibleHeight) / containerSize.h - photoCenterY - captionStart.offsetY,
          );
        }

        updateTransformsLocal((current) =>
          current.map((transform) => {
            const photoStart = activeGesture.photoStarts.find(
              (photoTransform) => photoTransform.photoId === transform.photoId,
            );
            const captionStart = captionStartMap.get(transform.photoId);
            if (!photoStart && !captionStart) {
              return transform;
            }

            if (photoStart) {
              return {
                ...transform,
                x: photoStart.x + limitedDx,
                y: photoStart.y + limitedDy,
              };
            }

            const caption = getCaptionTransform(transform);
            return {
              ...transform,
              caption: {
                ...caption,
                offsetX: captionStart!.offsetX + limitedDx,
                offsetY: captionStart!.offsetY + limitedDy,
              },
            };
          }),
        );
        return;
      }

      if (activeGesture.type === "rotate-photo") {
        const currentAngle =
          (Math.atan2(
            event.clientY - activeGesture.centerClientY,
            event.clientX - activeGesture.centerClientX,
          ) * 180) /
            Math.PI +
          90;
        const angleDelta = currentAngle - activeGesture.startAngle;
        let nextAngle = normalizeRotation(activeGesture.startRotation + angleDelta);
        if (event.shiftKey) {
          const snapTarget = getRotationSnapTarget(nextAngle);
          if (snapTarget !== undefined) {
            nextAngle = normalizeRotation(snapTarget);
          }
        }

        updateTransformsLocal((current) =>
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
      // Convert screen-space center to container-local coords
      const screenCenterX = activeGesture.anchorX + draggedCornerOffset.x / 2;
      const screenCenterY = activeGesture.anchorY + draggedCornerOffset.y / 2;
      const nextCenterX = clamp(
        screenCenterX - activeGesture.containerOffsetX,
        0,
        containerSize.w,
      );
      const nextCenterY = clamp(
        screenCenterY - activeGesture.containerOffsetY,
        0,
        containerSize.h,
      );
      const nextX = nextCenterX / containerSize.w - nextWidth / (2 * containerSize.w);
      const nextY = nextCenterY / containerSize.h - nextHeight / (2 * containerSize.h);

      updateTransformsLocal((current) =>
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
      if (activeGesture.type === "marquee-select") {
        const nextMarqueeRect = marqueeRectRef.current;
        if (
          !nextMarqueeRect ||
          (nextMarqueeRect.width < MARQUEE_DRAG_THRESHOLD_PX &&
            nextMarqueeRect.height < MARQUEE_DRAG_THRESHOLD_PX)
        ) {
          setSelection(null);
        }
        marqueeRectRef.current = null;
        setMarqueeRect(null);
      } else if (
        activeGesture.type === "drag-selection" &&
        !didDragRef.current &&
        activeGesture.shouldNarrowSelectionOnClick
      ) {
        setSelection(createSingleSelection(activeGesture.pointerTarget));
      }

      // Commit local transforms to store on gesture end
      if (activeGesture.type !== "marquee-select") {
        commitTransforms();
      }

      didDragRef.current = false;
      setActiveGesture(null);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor =
      activeGesture.type === "drag-selection"
        ? "grabbing"
        : activeGesture.type === "marquee-select"
          ? "crosshair"
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
  }, [
    activeGesture,
    commitTransforms,
    containerSize.h,
    containerSize.w,
    getCaptionBounds,
    getSelectionFromMarquee,
    updateTransformsLocal,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setActiveGesture(null);
      didDragRef.current = false;
      marqueeRectRef.current = null;
      setMarqueeRect(null);
      if (editingCaptionId) {
        setEditingCaptionId(null);
        return;
      }

      setSelection(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingCaptionId]);

  const commitCaptionText = useCallback((photoId: string, text: string) => {
    useHistoryStore.getState().pushState();
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
    (photoIds: string[], updates: Partial<NonNullable<FreePhotoTransform["caption"]>>) => {
      useHistoryStore.getState().pushState();
      const selectedIds = new Set(photoIds);
      updateTransforms((current) =>
        current.map((transform) => {
          if (!selectedIds.has(transform.photoId)) {
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
  // Measure actual DOM size for accurate caption font scaling (matches PhotoOverlay's ResizeObserver)
  const canvasRef = useRef<HTMLDivElement>(null);
  const [measuredSize, setMeasuredSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    if (!canvasRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w > 0 && h > 0) {
          setMeasuredSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        }
      }
    });
    obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, []);
  const effectiveW = measuredSize.w > 0 ? measuredSize.w : containerSize.w;
  const captionScale = effectiveW > 0 ? effectiveW / 1000 : 1;
  const maxZIndex = effectiveTransforms.reduce((highest, transform) => Math.max(highest, transform.zIndex), 0);
  const showCaptionToolbar = Boolean(selectedCaptionToolbarState) && !editingCaptionId;

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 z-20"
      onPointerDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          !canvasRef.current ||
          containerSize.w <= 0 ||
          containerSize.h <= 0
        ) {
          return;
        }

        setEditingCaptionId(null);
        const containerRect = canvasRef.current.getBoundingClientRect();
        const nextMarqueeRect = createMarqueeRect(
          event.clientX,
          event.clientY,
          event.clientX,
          event.clientY,
          containerRect,
        );
        marqueeRectRef.current = nextMarqueeRect;
        setMarqueeRect(nextMarqueeRect);
        setActiveGesture({
          type: "marquee-select",
          startClientX: event.clientX,
          startClientY: event.clientY,
          containerRect,
        });
      }}
      style={mapSnapshot ? { backgroundImage: `url(${mapSnapshot})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {orderedItems.map(({ transform, photo }) => {
        const caption = getCaptionTransform(transform);
        const scaledCaptionFontSize = (caption.fontSize ?? defaultCaptionFontSize) * captionScale;
        const captionText = caption.text ?? photo.caption ?? "";
        const captionShouldRender =
          Boolean(captionText) ||
          selectedPhotoIdSet.has(photo.id) ||
          selectedCaptionIdSet.has(photo.id) ||
          editingCaptionId === photo.id;
        const photoSelected = selectedPhotoIdSet.has(photo.id);
        const captionSelected = selectedCaptionIdSet.has(photo.id);
        const showPhotoControls = singleSelectedPhotoId === photo.id;
        const captionCenterX = transform.x + transform.width / 2 + caption.offsetX;
        const captionCenterY = transform.y + transform.height / 2 + caption.offsetY;

        return (
          <Fragment key={photo.id}>
            <div
              className="absolute cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={(event) => {
                event.stopPropagation();
                handleSelectablePointerDown(
                  { kind: "photo", photoId: photo.id },
                  event.clientX,
                  event.clientY,
                  event.shiftKey || event.metaKey || event.ctrlKey,
                );
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
              <PhotoFrame
                frameStyle={photoFrameStyle}
                photoId={photo.id}
                className="h-full w-full"
                mediaStyle={{ borderRadius: `${borderRadius}px` }}
                disableDecorativeRotation
              >
                <img
                  src={photo.url}
                  alt={photo.caption || "Photo"}
                  className="h-full w-full select-none object-cover"
                  draggable={false}
                  style={{
                    objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%`,
                  }}
                />
              </PhotoFrame>
              {photoSelected ? (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-indigo-500 ring-offset-2 ring-offset-white/30"
                    style={{ borderRadius: `${borderRadius}px` }}
                  />
                  {showPhotoControls ? (
                    <>
                      <div className="pointer-events-none absolute left-1/2 top-0 h-7 -translate-x-1/2 -translate-y-full border-l border-indigo-500" />
                      <button
                        type="button"
                        className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 -translate-y-[150%] rounded-full border-2 border-white bg-indigo-500 shadow-sm cursor-grab active:cursor-grabbing transition-transform hover:scale-125"
                        style={{ touchAction: "none" }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          beginRotate(photo.id, event.clientX, event.clientY);
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
                          className={`absolute h-4 w-4 rounded-full border-2 border-white bg-indigo-500 shadow-sm transition-transform hover:scale-150 ${className}`}
                          style={{ cursor: getHandleCursor(handle), touchAction: "none" }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            beginResize(photo.id, handle, event.clientX, event.clientY, canvasRef.current);
                          }}
                          aria-label={`Resize photo from ${handle} corner`}
                        />
                      ))}
                    </>
                  ) : null}
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
                    handleSelectablePointerDown(
                      { kind: "caption", photoId: photo.id },
                      event.clientX,
                      event.clientY,
                      event.shiftKey || event.metaKey || event.ctrlKey,
                    );
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setSelection(createSingleSelection({ kind: "caption", photoId: photo.id }));
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
              </>
            ) : null}
          </Fragment>
        );
      })}
      {marqueeRect ? (
        <div
          className="pointer-events-none absolute border border-indigo-500/70 bg-indigo-500/10"
          style={{
            left: `${marqueeRect.left}px`,
            top: `${marqueeRect.top}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`,
            zIndex: maxZIndex + 3,
          }}
        />
      ) : null}
      {showCaptionToolbar && selectedCaptionToolbarState ? (
        <div
          className="absolute z-10 flex flex-col gap-2 overflow-hidden rounded-xl border border-indigo-100 bg-white/95 px-3 py-2 shadow-xl"
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            left: `${selectedCaptionToolbarState.toolbarPosition.toolbarLeft}px`,
            top: `${selectedCaptionToolbarState.toolbarPosition.toolbarTop}px`,
            width: `${selectedCaptionToolbarState.toolbarPosition.toolbarWidth}px`,
            zIndex: maxZIndex + 4,
          }}
        >
          <div className="flex items-center gap-2">
            <select
              className="h-8 min-w-0 flex-1 truncate rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-indigo-500"
              style={{ fontFamily: selectedCaptionToolbarState.fontFamily }}
              value={selectedCaptionToolbarState.fontFamilyMixed ? "__mixed" : selectedCaptionToolbarState.fontFamily}
              onChange={(event) => {
                if (event.target.value === "__mixed") {
                  return;
                }
                applyCaptionStyle(selectedCaptionToolbarState.photoIds, { fontFamily: event.target.value });
              }}
            >
              {selectedCaptionToolbarState.fontFamilyMixed ? (
                <option value="__mixed">Mixed</option>
              ) : null}
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
              value={selectedCaptionToolbarState.fontSize}
              onChange={(event) =>
                applyCaptionStyle(selectedCaptionToolbarState.photoIds, {
                  fontSize: Number(event.target.value),
                })
              }
              className="h-1 w-24 accent-indigo-500"
            />
            <span className="w-10 text-right text-[10px] text-gray-500">
              {selectedCaptionToolbarState.fontSizeMixed
                ? "Mixed"
                : `${selectedCaptionToolbarState.fontSize}px`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-9 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
              Text
            </span>
            <div className="flex items-center gap-1">
              {CAPTION_COLOR_PRESETS.map((color) => (
                <button
                  key={`toolbar-${color}`}
                  type="button"
                  className={`h-5 w-5 rounded-full border ${
                    !selectedCaptionToolbarState.colorMixed && selectedCaptionToolbarState.color === color
                      ? "border-indigo-500 ring-2 ring-indigo-200"
                      : "border-gray-200"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => applyCaptionStyle(selectedCaptionToolbarState.photoIds, { color })}
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
                  applyCaptionStyle(selectedCaptionToolbarState.photoIds, {
                    color: customColorInput.trim(),
                  });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && customColorInput.trim()) {
                  applyCaptionStyle(selectedCaptionToolbarState.photoIds, {
                    color: customColorInput.trim(),
                  });
                }
              }}
              placeholder={selectedCaptionToolbarState.colorMixed ? "Mixed" : "#6366f1"}
              className="h-8 w-20 rounded-md border border-gray-200 px-2 text-xs text-gray-700 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-9 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
                Fill
              </span>
              <div className="flex items-center gap-1">
                {CAPTION_BG_PRIMARY.map((color) => (
                  <button
                    key={`toolbar-bg-${color}`}
                    type="button"
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold ${
                      !selectedCaptionToolbarState.bgColorMixed && selectedCaptionToolbarState.bgColor === color
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-gray-200"
                    }`}
                    style={{
                      backgroundColor: color === "transparent" ? "#ffffff" : color,
                      color: color === "transparent" ? "#6b7280" : "transparent",
                      backgroundImage: color === "transparent"
                        ? "linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)"
                        : undefined,
                    }}
                    onClick={() => applyCaptionStyle(selectedCaptionToolbarState.photoIds, { bgColor: color })}
                    aria-label={`Set caption background ${color}`}
                  >
                    {color === "transparent" ? "T" : ""}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="h-5 rounded border border-gray-200 px-1.5 text-[9px] text-gray-500 hover:bg-gray-100"
                onClick={() => setBgExpanded((prev) => !prev)}
              >
                {bgExpanded ? "Less" : "More"}
              </button>
            </div>
            {bgExpanded && (
              <div className="flex flex-wrap items-center gap-1 pl-11">
                {CAPTION_BG_EXTENDED.map((color) => (
                  <button
                    key={`toolbar-bg-ext-${color}`}
                    type="button"
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      !selectedCaptionToolbarState.bgColorMixed && selectedCaptionToolbarState.bgColor === color
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-gray-200"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => applyCaptionStyle(selectedCaptionToolbarState.photoIds, { bgColor: color })}
                    aria-label={`Set caption background ${color}`}
                  />
                ))}
                <input
                  type="text"
                  value={selectedCaptionToolbarState.bgColorMixed ? "" : bgColorDisplayHex(selectedCaptionToolbarState.bgColor)}
                  onChange={(event) => {
                    const val = event.target.value.trim();
                    if (val) applyCaptionStyle(selectedCaptionToolbarState.photoIds, { bgColor: val });
                  }}
                  placeholder={selectedCaptionToolbarState.bgColorMixed ? "Mixed" : "#000000"}
                  className="h-8 w-20 rounded-md border border-gray-200 px-2 text-xs text-gray-700 outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
