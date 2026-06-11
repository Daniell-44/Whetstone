import { useState, useEffect, useRef } from 'preact/hooks';
import type { ArgumentExtractionResult, ExtractionStatement } from '../../lib/extraction';

// ---------------------------------------------------------------------------
// Build Mermaid definition from extraction result
// ---------------------------------------------------------------------------

function escapeLabel(text: string): string {
  // Mermaid uses quotes and brackets specially — escape them
  return text
    .replace(/"/g, "'")
    .replace(/[[\]{}()<>]/g, '')
    .slice(0, 80) + (text.length > 80 ? '…' : '');
}

const INFERENCE_SHORT: Record<string, string> = {
  modus_ponens:            'MP',
  modus_tollens:           'MT',
  hypothetical_syllogism:  'HS',
  disjunctive_syllogism:   'DS',
  categorical_syllogism:   'CS',
  inductive_generalisation: 'Ind.',
  abduction:               'Abd.',
  analogy:                 'Anal.',
  other:                   '→',
};

export function buildMermaidDef(result: ArgumentExtractionResult): string {
  const lines: string[] = ['graph TD'];

  // Define nodes
  for (const s of result.statements) {
    const label = escapeLabel(s.text);
    if (s.type === 'premise') {
      const isImplicit = s.text.startsWith('★');
      if (isImplicit) {
        lines.push(`  ${s.id}["${s.id}: ${label}"]:::implicit`);
      } else {
        lines.push(`  ${s.id}["${s.id}: ${label}"]:::premise`);
      }
    } else {
      lines.push(`  ${s.id}(["${s.id}: ${label}"]):::conclusion`);
    }
  }

  // Define edges
  for (const s of result.statements) {
    if (s.type === 'conclusion' && s.derivedFrom && s.derivedFrom.length > 0) {
      const rule = s.inferenceRule ? INFERENCE_SHORT[s.inferenceRule] ?? '→' : '→';
      for (const src of s.derivedFrom) {
        lines.push(`  ${src} -->|${rule}| ${s.id}`);
      }
    }
  }

  // Style classes
  lines.push('');
  lines.push('  classDef premise fill:#f3f4f6,stroke:#9ca3af,color:#374151');
  lines.push('  classDef implicit fill:#fefce8,stroke:#d97706,color:#92400e,stroke-dasharray: 5 5');
  lines.push('  classDef conclusion fill:#dbeafe,stroke:#3b82f6,color:#1e40af');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  result: ArgumentExtractionResult;
}

export default function ArgumentFlowChart({ result }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    if (result.statements.length === 0) {
      setLoading(false);
      return;
    }

    const def = buildMermaidDef(result);

    // Dynamic import of mermaid
    import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs' as string)
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          flowchart: { curve: 'basis', padding: 16 },
        });
        const id = `mermaid-${Date.now()}`;
        return mermaid.render(id, def);
      })
      .then(({ svg }) => {
        if (containerRef.current) {
          // Mermaid emits SVG with explicit width/height attributes that
          // overflow on mobile and break parent layout. Strip them and let
          // CSS handle sizing: width=100%, height=auto, max-width=container.
          const responsive = svg
            .replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1')
            .replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1')
            .replace(/<svg(\s|>)/, '<svg style="max-width:100%;height:auto;display:block;margin:0 auto"$1');
          containerRef.current.innerHTML = responsive;
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to render diagram');
        setLoading(false);
      });
  }, [result]);

  if (result.statements.length === 0) {
    return <p class="text-sm text-gray-400 italic">No argument structure to visualise.</p>;
  }

  return (
    <div class="space-y-3">
      {loading && (
        <div class="text-center py-8">
          <p class="text-sm text-gray-400">Rendering flow chart…</p>
        </div>
      )}

      {error && (
        <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p class="text-xs text-red-600">Diagram failed: {error}</p>
        </div>
      )}

      <div
        ref={containerRef}
        class="overflow-x-auto rounded-lg border border-gray-100 bg-white p-4"
      />

      {/* Legend */}
      <div class="flex flex-wrap gap-4 text-[10px] text-gray-400">
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          Premise
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded bg-yellow-50 border border-amber-300 border-dashed" />
          Implicit premise
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full bg-blue-100 border border-blue-400" />
          Conclusion
        </span>
        <span class="flex items-center gap-1.5">
          MP = Modus ponens · MT = Modus tollens · HS = Hypothetical syl. · Ind. = Inductive · Abd. = Abductive
        </span>
      </div>
    </div>
  );
}
