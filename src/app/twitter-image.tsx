import { ImageResponse } from "next/og";
import {
  alt,
  contentType,
  size,
  TraceRecapSocialImage,
} from "./opengraph-image";

export { alt, contentType, size };

export default function TwitterImage() {
  return new ImageResponse(<TraceRecapSocialImage />, size);
}
