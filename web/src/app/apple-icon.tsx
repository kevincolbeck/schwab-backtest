import { ImageResponse } from "next/og";

/** Apple touch icon (180x180 PNG), generated from the same mark as icon.svg
 *  so the two can't drift. iOS ignores SVG icons, hence a raster twin. */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0f14",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect x="12" y="16" width="4" height="32" rx="2" fill="#4da2ff" />
          <path
            d="M24 42 L32 42 L32 34 L40 34 L40 26 L50 26"
            fill="none"
            stroke="#e9edf4"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="26" r="4" fill="#4da2ff" />
        </svg>
      </div>
    ),
    size,
  );
}
