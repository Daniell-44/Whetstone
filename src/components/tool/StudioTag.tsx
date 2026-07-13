// The ONE Pro-gate marker (merge adjudication 2026-07-13: a single tag
// grammar everywhere - strip tabs, engine buttons, upsell chips). Mono,
// graphite, hairline border. Never redline (reserved for engine findings),
// never restyled per surface: if a gate needs to look different, the gate
// is wrong, not the tag.
export default function StudioTag() {
  return (
    <span class="font-mono text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border border-hairline text-muted shrink-0">
      Studio
    </span>
  );
}
