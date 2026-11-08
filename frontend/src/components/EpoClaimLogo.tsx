interface LogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export function EpoClaimLogo({
  size = 56,
  className = "",
  showWordmark = false,
}: LogoProps) {
  return (
    <div className={`epoclaim-brand-lockup ${className}`}>
      {/* Official Standalone EpoClaim Brand Symbol */}
      <img
        src="/epoclaim-symbol.png"
        alt="EpoClaim symbol"
        width={size}
        height={size}
        className="epoclaim-symbol-image"
        loading="eager"
        decoding="async"
      />

      {/* Cohesive Brand Lockup Wordmark (Live HTML Text) */}
      {showWordmark && (
        <div className="epoclaim-brand-text">
          <div className="brand-primary-row">
            <span className="brand-name-text">EpoClaim</span>
          </div>
          <span className="brand-descriptor-text">
            Temporal Fact Verification & Stale-Answer Detection
          </span>
        </div>
      )}
    </div>
  );
}
