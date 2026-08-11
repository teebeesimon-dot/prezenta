interface LogoMarkProps {
  className?: string;
}

/**
 * Simbolul „prezenta": un inel de puncte (ca un indicator de prezență /
 * spinner) — fiecare punct este o persoană care se adună în jurul jocului.
 * Două puncte verzi accent dau energia brandului. Punctele principale
 * folosesc culoarea de text, deci marca se adaptează temei (light/dark).
 */
export function LogoMark({ className }: LogoMarkProps) {
  // 8 puncte distribuite uniform pe un cerc (centru 24,24, rază 14).
  const dots: { cx: number; cy: number; r: number; accent?: boolean }[] = [
    { cx: 38.0, cy: 24.0, r: 4.1, accent: true }, // dreapta (punct „lider")
    { cx: 33.9, cy: 33.9, r: 3.2 },
    { cx: 24.0, cy: 38.0, r: 3.2 },
    { cx: 14.1, cy: 33.9, r: 3.2 },
    { cx: 10.0, cy: 24.0, r: 3.2 },
    { cx: 14.1, cy: 14.1, r: 3.6, accent: true }, // stânga-sus
    { cx: 24.0, cy: 10.0, r: 3.2 },
    { cx: 33.9, cy: 14.1, r: 3.2 },
  ];

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="prezenta"
      className={className}
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          className={d.accent ? "fill-primary" : "fill-foreground"}
        />
      ))}
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <LogoMark className="h-8 w-8" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        prezenta
      </span>
    </span>
  );
}
