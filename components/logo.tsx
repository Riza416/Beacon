import { cn } from "@/lib/utils";

interface BeaconLogoProps {
  /** Pixel size of the mark. Wordmark scales with text-size context. */
  size?: number;
  /** Show "Beacon" wordmark after the mark. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * Beacon logo: a transmitter pulsing concentric signal rings, with the
 * wordmark in a violet → indigo gradient. The outer ring loops with a
 * slow scale+fade animation defined inline so the logo doesn't depend on
 * any external CSS file.
 */
export function BeaconLogo({
  size = 22,
  withWordmark = true,
  className,
}: BeaconLogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 leading-none", className)}
    >
      <BeaconMark size={size} />
      {withWordmark && (
        <span
          className="bg-clip-text text-transparent font-semibold tracking-tight"
          style={{
            backgroundImage:
              "linear-gradient(90deg, hsl(270 95% 78%) 0%, hsl(280 90% 70%) 45%, hsl(250 100% 78%) 100%)",
          }}
        >
          Beacon
        </span>
      )}
    </span>
  );
}

export function BeaconMark({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes beacon-pulse {
          0% { transform: scale(0.55); opacity: 0.0; }
          25% { opacity: 0.55; }
          100% { transform: scale(1.15); opacity: 0.0; }
        }
        @keyframes beacon-core {
          0%, 100% { filter: drop-shadow(0 0 0 hsl(270 95% 70% / 0)); }
          50% { filter: drop-shadow(0 0 4px hsl(270 95% 70% / 0.65)); }
        }
        .beacon-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1px solid hsl(270 95% 70%);
          opacity: 0;
          animation: beacon-pulse 2.4s ease-out infinite;
        }
        .beacon-ring.r2 { animation-delay: 0.8s; }
        .beacon-ring.r3 { animation-delay: 1.6s; }
      `}</style>
      <span className="beacon-ring" />
      <span className="beacon-ring r2" />
      <span className="beacon-ring r3" />
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        className="absolute inset-0"
        style={{ animation: "beacon-core 3s ease-in-out infinite" }}
      >
        <defs>
          <radialGradient id="beacon-core-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0 0% 100%)" stopOpacity="1" />
            <stop offset="55%" stopColor="hsl(270 95% 70%)" stopOpacity="1" />
            <stop
              offset="100%"
              stopColor="hsl(270 95% 50%)"
              stopOpacity="0.85"
            />
          </radialGradient>
          <linearGradient id="beacon-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(270 95% 80%)" />
            <stop offset="100%" stopColor="hsl(250 100% 65%)" />
          </linearGradient>
        </defs>
        {/* Outer thin static arc — futuristic frame */}
        <circle
          cx="12"
          cy="12"
          r="10.5"
          stroke="url(#beacon-arc)"
          strokeWidth="0.6"
          strokeDasharray="2.5 1.4"
          opacity="0.55"
        />
        {/* Mid arc — open at the bottom */}
        <path
          d="M 3 12 A 9 9 0 0 1 21 12"
          stroke="url(#beacon-arc)"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        {/* Core emitter */}
        <circle cx="12" cy="12" r="3.4" fill="url(#beacon-core-grad)" />
        <circle cx="12" cy="12" r="1.2" fill="hsl(0 0% 100%)" />
      </svg>
    </span>
  );
}
