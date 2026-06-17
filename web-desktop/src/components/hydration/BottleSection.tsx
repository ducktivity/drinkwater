import { Show, onMount, onCleanup } from 'solid-js'
import { clamp } from '../../utils'
import { useSettings } from '../../context/SettingsContext'
import { useHydration } from '../../context/HydrationContext'
import { useHistory } from '../../context/HistoryContext'
import { useOverlay } from '../../context/OverlayContext'

// ─── SVG layout constants ────────────────────────────────────────────────────
// All measurements are in SVG user-units (the viewBox is SVG_W × SVG_H).
const SVG_W = 120,
  SVG_H = 240
const BOTTLE_W = 72,
  BOTTLE_H = 200
const NECK_W = 28,
  NECK_H = 32
const BODY_TOP = NECK_H + 4 // Y offset where the wide body begins (below the neck)
const BODY_BOT = BOTTLE_H
const BODY_H = BODY_BOT - BODY_TOP
// Top-left origin of the bottle drawing within the viewBox
const ORIGIN_X = (SVG_W - BOTTLE_W) / 2
const ORIGIN_Y = (SVG_H - BOTTLE_H) / 2 - 2
const CAP_H = 14
// X origin of the narrow neck, centred on the bottle body
const NECK_ORIGIN_X = ORIGIN_X + (BOTTLE_W - NECK_W) / 2
// ─────────────────────────────────────────────────────────────────────────────

/** Rounded-rectangle path for the wide bottle body. */
const BODY_PATH = `M ${ORIGIN_X + 14} ${ORIGIN_Y + BODY_TOP} L ${ORIGIN_X + BOTTLE_W - 14} ${ORIGIN_Y + BODY_TOP} Q ${ORIGIN_X + BOTTLE_W} ${ORIGIN_Y + BODY_TOP} ${ORIGIN_X + BOTTLE_W} ${ORIGIN_Y + BODY_TOP + 14} L ${ORIGIN_X + BOTTLE_W} ${ORIGIN_Y + BODY_BOT - 14} Q ${ORIGIN_X + BOTTLE_W} ${ORIGIN_Y + BODY_BOT} ${ORIGIN_X + BOTTLE_W - 14} ${ORIGIN_Y + BODY_BOT} L ${ORIGIN_X + 14} ${ORIGIN_Y + BODY_BOT} Q ${ORIGIN_X} ${ORIGIN_Y + BODY_BOT} ${ORIGIN_X} ${ORIGIN_Y + BODY_BOT - 14} L ${ORIGIN_X} ${ORIGIN_Y + BODY_TOP + 14} Q ${ORIGIN_X} ${ORIGIN_Y + BODY_TOP} ${ORIGIN_X + 14} ${ORIGIN_Y + BODY_TOP} Z`

/** Rounded-rectangle path for the narrow bottle neck. */
const NECK_PATH = `M ${NECK_ORIGIN_X} ${ORIGIN_Y + NECK_H + 4} L ${NECK_ORIGIN_X} ${ORIGIN_Y + NECK_H / 2} Q ${NECK_ORIGIN_X} ${ORIGIN_Y} ${NECK_ORIGIN_X + NECK_W / 2 - 4} ${ORIGIN_Y} L ${NECK_ORIGIN_X + NECK_W / 2 + 4} ${ORIGIN_Y} Q ${NECK_ORIGIN_X + NECK_W} ${ORIGIN_Y} ${NECK_ORIGIN_X + NECK_W} ${ORIGIN_Y + NECK_H / 2} L ${NECK_ORIGIN_X + NECK_W} ${ORIGIN_Y + NECK_H + 4} Z`

/**
 * Converts a fill fraction (0–1) into the Y coordinate of the water surface
 * inside the SVG viewBox. fillFraction=1 means full (surface at BODY_TOP);
 * fillFraction=0 means empty (surface at BODY_BOT).
 */
function computeWaterSurfaceY(fillFraction: number) {
  return ORIGIN_Y + BODY_TOP + (1 - fillFraction) * BODY_H
}

/**
 * The draggable hydration bottle. Reads the active-bottle level and bottle size
 * from context and routes drag/commit gestures back through the hydration and
 * overlay contexts. On a past day it shows a static, full bottle with no
 * controls, since dragging would log against today rather than the day viewed.
 */
export function BottleSection() {
  const settings = useSettings()
  const hydration = useHydration()
  const history = useHistory()
  const overlay = useOverlay()

  /** Bottle volume in ml. */
  const size = () => settings.bottleSize()
  /** Drag interaction is only enabled on the live day. */
  const isInteractive = () => history.isViewingToday()
  /** Live level on the live day; a static, full bottle on past days. */
  const fillFraction = () =>
    history.isViewingToday() ? hydration.fillFraction() : 1

  /** Whether a drag interaction is currently in progress. */
  let isDragging = false
  let svgElement!: SVGSVGElement

  const waterSurfaceY = () => computeWaterSurfaceY(fillFraction())

  /** Millilitres drunk from the active bottle so far (full size minus the remaining level), rounded. */
  const mlDrankSoFar = () => Math.round((1 - fillFraction()) * size())

  /** Human-readable label shown below the bottle describing the current fill level. */
  const bottleLevelLabel = () => {
    const fraction = fillFraction()
    if (fraction >= 0.99) return `Full bottle · ${size()} ml`
    if (fraction <= 0.01) return 'Almost done — release to log!'
    return `${Math.round(fraction * size())} ml remaining`
  }

  /**
   * Maps a pointer's clientY screen position into a 0–1 fill fraction by
   * projecting it into SVG user-space and normalising against the bottle body height.
   */
  function pointerClientYToFillFraction(clientY: number) {
    const svgBounds = svgElement.getBoundingClientRect()
    // Scale the screen Y into SVG user-space coordinates
    const svgRelativeY = (clientY - svgBounds.top) * (SVG_H / svgBounds.height)
    return clamp(1 - (svgRelativeY - (ORIGIN_Y + BODY_TOP)) / BODY_H, 0, 1)
  }

  function handleDragMove(clientY: number) {
    if (!isDragging) return
    // Live drag updates: move the bottle visual without touching the daily total.
    hydration.handleFillFractionChange(pointerClientYToFillFraction(clientY))
  }

  function handleDragEnd(clientY: number) {
    if (!isDragging) return
    isDragging = false
    // Trigger the "bottle emptied" flow when the user releases near the bottom,
    // otherwise commit the resting level so it can fold into today's total.
    if (pointerClientYToFillFraction(clientY) <= 0.05) {
      overlay.handleBottleEmptied()
    } else {
      hydration.handleDragSettled()
    }
  }

  onMount(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY)
    const handleMouseUp = (e: MouseEvent) => handleDragEnd(e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault()
        handleDragMove(e.touches[0].clientY)
      }
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (isDragging) handleDragEnd(e.changedTouches[0].clientY)
    }

    // Register global listeners so drags are tracked even when the pointer leaves the SVG
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    onCleanup(() => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    })
  })

  return (
    <div class="flex flex-col items-center gap-2.5 w-full">
      {/* Interactive SVG bottle */}
      <div class="flex flex-col items-center select-none touch-none">
        <svg
          ref={svgElement!}
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          class="overflow-visible"
          onMouseDown={(e) => {
            if (!isInteractive()) return
            isDragging = true
            handleDragMove(e.clientY)
          }}
          onTouchStart={(e) => {
            if (!isInteractive()) return
            e.preventDefault()
            isDragging = true
            handleDragMove(e.touches[0].clientY)
          }}
        >
          <defs>
            {/* Clip path mirrors the rounded bottle body so water stays inside the curves */}
            <clipPath id="wclip">
              <path d={BODY_PATH} />
            </clipPath>
          </defs>

          {/* Bottle body outline */}
          <path
            d={BODY_PATH}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.13)"
            stroke-width="1.5"
          />

          {/* Water fill — dims when near-empty to hint at the "log it" threshold */}
          <rect
            x={ORIGIN_X}
            y={waterSurfaceY()}
            width={BOTTLE_W}
            height={ORIGIN_Y + BODY_BOT - waterSurfaceY()}
            fill={
              fillFraction() > 0.05
                ? 'rgba(56,189,248,0.42)'
                : 'rgba(56,189,248,0.12)'
            }
            clip-path="url(#wclip)"
          />

          {/* Animated water-surface ripple — hidden when full or empty */}
          <Show when={fillFraction() > 0.015 && fillFraction() < 0.99}>
            <path
              d={`M ${ORIGIN_X} ${waterSurfaceY()} q ${BOTTLE_W / 4} -3 ${BOTTLE_W / 2} 0 q ${BOTTLE_W / 4} 3 ${BOTTLE_W / 2} 0`}
              fill="none"
              stroke="rgba(125,211,252,0.55)"
              stroke-width="1.5"
            />
          </Show>

          {/* Bottle neck outline */}
          <path
            d={NECK_PATH}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.13)"
            stroke-width="1.5"
          />

          {/* Bottle cap — highlights in blue when the bottle is more than half full */}
          <rect
            x={NECK_ORIGIN_X - 2}
            y={ORIGIN_Y - CAP_H}
            width={NECK_W + 4}
            height={CAP_H}
            rx="5"
            fill={
              fillFraction() > 0.5
                ? 'rgba(56,189,248,0.55)'
                : 'rgba(255,255,255,0.12)'
            }
          />

          {/* Percentage label centred in the bottle body */}
          <text
            x={SVG_W / 2}
            y={ORIGIN_Y + BODY_TOP + BODY_H / 2 + 5}
            text-anchor="middle"
            font-size="15"
            font-weight="600"
            font-family="-apple-system, BlinkMacSystemFont, sans-serif"
            fill={
              fillFraction() > 0.18
                ? 'rgba(255,255,255,0.9)'
                : 'rgba(255,255,255,0.35)'
            }
          >
            {Math.round(fillFraction() * 100)}%
          </text>
        </svg>

        <Show when={isInteractive()}>
          <div class="text-xs text-[#7a7f96] flex items-center gap-1.25 mt-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            Drag to set level
          </div>
        </Show>
      </div>

      <div class="text-[13px] text-[#7a7f96] text-center">
        {bottleLevelLabel()}
      </div>

      {/* Log the amount drunk so far without dragging the bottle all the way to empty.
          Disabled until at least 1 ml has been consumed from the active bottle. */}
      <Show when={isInteractive() && mlDrankSoFar() > 0}>
        <button
          class="px-4 py-2 rounded-[10px] border border-white/10 bg-[#222535] text-[13px] font-semibold text-[#f0f2f7] cursor-pointer"
          onClick={() => overlay.handleLogDrank()}
        >
          Log {mlDrankSoFar()} ml drank
        </button>
      </Show>
    </div>
  )
}
