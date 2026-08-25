export function JackySproutIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="jackySproutIcon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.5 20.5v-7.3" stroke="var(--jacky-sprout-ink, #111111)" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M11.5 14.7C7.08 14.55 4.22 12.27 4.35 7.78c4.18-.18 7.04 1.02 8.02 3.87.3.88.35 1.9.23 3.05Z"
        fill="var(--jacky-sprout-green, #83CF1B)"
        stroke="var(--jacky-sprout-ink, #111111)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12.25 13.35c-.17-4.88 2.47-8.47 7.39-8.9.31 4.84-1.56 8.18-5.12 9.17-.71.2-1.47.25-2.27.2Z"
        fill="var(--jacky-sprout-green, #83CF1B)"
        stroke="var(--jacky-sprout-ink, #111111)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M6.35 9.2c1.64.25 2.83.9 3.61 1.95" stroke="var(--jacky-sprout-green-light, #D9F57C)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M15 7.04c1.08-.74 2.06-1.06 3.08-1.1" stroke="var(--jacky-sprout-green-light, #D9F57C)" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
