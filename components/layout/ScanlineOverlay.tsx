export function ScanlineOverlay() {
  return (
    <div className="fixed inset-0 z-[999] pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 crt-noise" />
      <div className="absolute inset-0 scanline-overlay" />
    </div>
  );
}
