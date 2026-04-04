/**
 * TraceRecap Brand System
 *
 * Warm, travel-inspired palette with personality.
 * Think golden hour sunsets, ocean horizons, vintage maps.
 */

export const brand = {
  colors: {
    // Primary — warm sunset orange-coral
    primary: {
      50: "#fff7ed",
      100: "#ffedd5",
      200: "#fed7aa",
      300: "#fdba74",
      400: "#fb923c",
      500: "#f97316", // Main brand
      600: "#ea580c",
      700: "#c2410c",
      800: "#9a3412",
      900: "#7c2d12",
    },
    // Secondary — deep ocean teal
    ocean: {
      50: "#f0fdfa",
      100: "#ccfbf1",
      200: "#99f6e4",
      300: "#5eead4",
      400: "#2dd4bf",
      500: "#14b8a6", // Accent
      600: "#0d9488",
      700: "#0f766e",
      800: "#115e59",
      900: "#134e4a",
    },
    // Tertiary — earthy warm beige
    sand: {
      50: "#fefce8",
      100: "#fef9c3",
      200: "#fef08a",
      300: "#fde047",
      400: "#facc15",
      500: "#eab308",
      600: "#ca8a04",
      700: "#a16207",
      800: "#854d0e",
      900: "#713f12",
    },
    // Neutral — warm grays (not cold)
    warm: {
      50: "#fafaf9",
      100: "#f5f5f4",
      200: "#e7e5e4",
      300: "#d6d3d1",
      400: "#a8a29e",
      500: "#78716c",
      600: "#57534e",
      700: "#44403c",
      800: "#292524",
      900: "#1c1917",
      950: "#0c0a09",
    },
  },

  gradients: {
    // Sunset gradient — hero backgrounds
    sunset: "linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)",
    // Route line gradient
    route: "linear-gradient(90deg, #f97316 0%, #14b8a6 100%)",
    // Warm mesh for landing page
    warmMesh: `
      radial-gradient(at 20% 30%, rgba(249,115,22,0.12) 0px, transparent 50%),
      radial-gradient(at 75% 15%, rgba(20,184,166,0.08) 0px, transparent 50%),
      radial-gradient(at 50% 80%, rgba(234,179,8,0.06) 0px, transparent 50%),
      radial-gradient(at 90% 60%, rgba(249,115,22,0.06) 0px, transparent 50%),
      #fffbf5
    `,
    // Subtle warm bg for cards
    cardWarm: "linear-gradient(145deg, #fffbf5 0%, #fff7ed 100%)",
  },

  fonts: {
    // Display — headings with character
    display: "'General Sans', 'Plus Jakarta Sans', var(--font-geist-sans), system-ui, sans-serif",
    // Body — clean readability
    body: "var(--font-geist-sans), system-ui, sans-serif",
    // Mono — code snippets
    mono: "var(--font-geist-mono), 'SF Mono', Menlo, monospace",
    // Handwritten — for travel journal vibes
    handwritten: "var(--font-caveat), 'Caveat', cursive",
  },

  shadows: {
    // Warm-tinted shadows instead of cold gray
    sm: "0 1px 2px 0 rgba(120, 53, 15, 0.05)",
    md: "0 4px 6px -1px rgba(120, 53, 15, 0.07), 0 2px 4px -2px rgba(120, 53, 15, 0.05)",
    lg: "0 10px 15px -3px rgba(120, 53, 15, 0.08), 0 4px 6px -4px rgba(120, 53, 15, 0.04)",
    xl: "0 20px 25px -5px rgba(120, 53, 15, 0.1), 0 8px 10px -6px rgba(120, 53, 15, 0.04)",
    glow: "0 0 30px rgba(249, 115, 22, 0.15)",
    oceanGlow: "0 0 30px rgba(20, 184, 166, 0.15)",
  },

  animation: {
    // Easing curves
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;
