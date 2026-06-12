import { useState, useEffect } from 'preact/hooks';
import type { Scorecard, ScorecardPosition, ScorecardSource } from '../../lib/scorecard';
import { deriveSlug } from '../../lib/curatorHelpers';

// ---------------------------------------------------------------------------
// Composer-only types (separate from the final Scorecard shape)
// ---------------------------------------------------------------------------

interface ComposerArticle {
  url: string;
  title: string;
  publication: string;
  text: string;
  extracting: boolean;
  extractError: string | null;
}

interface ComposerPosition {
  label: string;
  articles: ComposerArticle[];
  leaning: number;
}

interface ComposerState {
  question: string;
  positions: ComposerPosition[];
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().split('T')[0]!;

const newArticle = (): ComposerArticle => ({
  url: '', title: '', publication: '', text: '', extracting: false, extractError: null,
});

const newComposerPosition = (): ComposerPosition => ({ label: '', articles: [newArticle()], leaning: 0 });

const defaultComposer = (): ComposerState => ({
  question: '',
  positions: [newComposerPosition(), newComposerPosition()],
});

const newEditorPosition = (): ScorecardPosition => ({
  label: '',
  bestCase: { claim: '', grounds: '', warrant: '' },
  fatalFlaw: { name: '', explanation: '' },
  sources: [{ title: '', publication: '', url: '' }],
});

const blankScorecard = (): Scorecard => ({
  slug: '',
  question: '',
  dek: '',
  publishedDate: TODAY,
  positions: [newEditorPosition(), newEditorPosition()],
  metaAnalysis: { bridgingWarrant: '', explanation: '' },
});

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const EXTRACT_ERRORS: Record<string, string> = {
  TOO_SHORT: 'Article too short - paste the text manually.',
  NOT_HTML: 'URL does not point to HTML - paste the text manually.',
  FETCH_FAILED: 'Could not fetch the URL - paste the text manually.',
  EXTRACTION_FAILED: 'Could not extract article text - paste the text manually.',
};

async function apiPost(
  path: string,
  body: unknown,
  secret: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Analyser-Secret': secret },
      body: JSON.stringify(body),
    });
    let data: unknown = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function fmtApiError(status: number, data: unknown): string {
  if (status === 0)   return 'Network error - check your connection.';
  if (status === 401) return 'Secret invalid - check the secret field above.';
  if (status === 500) {
    const d = data as Record<string, unknown>;
    const msg = d?.error ?? d?.message ?? 'Unknown server error';
    return `Server error: ${String(msg)}`;
  }
  return `Error ${status}: ${JSON.stringify(data)}`;
}

// ---------------------------------------------------------------------------
// Shared Tailwind class constants
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
const textareaCls = inputCls + ' resize-y';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
const sectionCls = 'bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm';
const cardCls = 'bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-3';
const innerCardCls = 'bg-white border border-gray-200 rounded-lg p-3 space-y-2';
const btnPrimary =
  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 ' +
  'rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const btnSecondary =
  'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border ' +
  'border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const btnDanger =
  'inline-flex items-center px-2 py-1 text-xs font-medium text-red-500 border border-red-200 ' +
  'rounded-md hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const errorCls = 'text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2';
const successCls = 'text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2';
const subHeadCls = 'text-xs font-semibold uppercase tracking-wide mb-2';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CuratorEditor({
  existingScorecards,
}: {
  existingScorecards: Scorecard[];
}) {
  const [secret, setSecret]           = useState('');
  const [composer, setComposer]       = useState<ComposerState>(defaultComposer());
  const [draft, setDraft]             = useState<Scorecard | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [savedSlug, setSavedSlug]     = useState<string | null>(null);

  // Restore secret from sessionStorage on first mount
  useEffect(() => {
    const stored = sessionStorage.getItem('whetstone-curator-secret');
    if (stored) setSecret(stored);
  }, []);

  // ---------------------------------------------------------------------------
  // Top-bar handlers
  // ---------------------------------------------------------------------------

  const handleSecretChange = (value: string) => {
    setSecret(value);
    sessionStorage.setItem('whetstone-curator-secret', value);
  };

  const handleLoadExisting = (slug: string) => {
    if (!slug) return;
    const sc = existingScorecards.find(s => s.slug === slug);
    if (!sc) return;
    setDraft({ ...sc });
    setSlugTouched(true);
    setSavedSlug(null);
    setSaveError(null);
  };

  const handleNewBlank = () => {
    setDraft(blankScorecard());
    setSlugTouched(false);
    setSavedSlug(null);
    setSaveError(null);
  };

  // ---------------------------------------------------------------------------
  // Composer helpers
  // ---------------------------------------------------------------------------

  const updateComposerArticle = (
    posIdx: number,
    artIdx: number,
    updates: Partial<ComposerArticle>,
  ) => {
    setComposer(prev => {
      const positions = [...prev.positions];
      const articles = [...positions[posIdx]!.articles];
      articles[artIdx] = { ...articles[artIdx]!, ...updates };
      positions[posIdx] = { ...positions[posIdx]!, articles };
      return { ...prev, positions };
    });
  };

  const handleExtract = async (posIdx: number, artIdx: number) => {
    const url = composer.positions[posIdx]?.articles[artIdx]?.url.trim();
    if (!url) return;
    if (!secret) {
      updateComposerArticle(posIdx, artIdx, { extractError: 'Enter the secret first.' });
      return;
    }

    updateComposerArticle(posIdx, artIdx, { extracting: true, extractError: null });

    const { ok, status, data } = await apiPost('/api/extract-article', { url }, secret);

    if (!ok) {
      updateComposerArticle(posIdx, artIdx, {
        extracting: false,
        extractError: fmtApiError(status, data),
      });
      return;
    }

    type ExtractResponse = {
      ok: boolean;
      article?: { title: string; publication: string; url: string; text: string };
      error?: { code: string; message: string };
    };
    const d = data as ExtractResponse;

    if (!d.ok) {
      const code = d.error?.code ?? '';
      updateComposerArticle(posIdx, artIdx, {
        extracting: false,
        extractError: EXTRACT_ERRORS[code] ?? `Extraction failed: ${d.error?.message ?? 'Unknown'}`,
      });
      return;
    }

    updateComposerArticle(posIdx, artIdx, {
      extracting: false,
      extractError: null,
      title: d.article?.title ?? '',
      publication: d.article?.publication ?? '',
      url: d.article?.url ?? url,
      text: d.article?.text ?? '',
    });
  };

  const handleGenerate = async () => {
    if (!secret) { setGenerateError('Enter the secret first.'); return; }
    if (!composer.question.trim()) { setGenerateError('Enter a debate question.'); return; }

    const positions = composer.positions.map(pos => ({
      label: pos.label.trim(),
      leaning: pos.leaning,
      articles: pos.articles
        .filter(a => a.text.trim())
        .map(a => ({
          title: a.title.trim() || 'Article',
          publication: a.publication.trim() || 'Unknown',
          url: a.url.trim() || 'https://example.com',
          text: a.text.trim(),
        })),
    }));

    const badPos = positions.find(p => !p.label || p.articles.length === 0);
    if (badPos) {
      setGenerateError('Each position needs a label and at least one article with text.');
      return;
    }
    if (positions.length < 2) {
      setGenerateError('At least 2 positions required.');
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    const { ok, status, data } = await apiPost(
      '/api/analyse-debate',
      { question: composer.question.trim(), positions },
      secret,
    );

    setGenerating(false);

    if (!ok) { setGenerateError(fmtApiError(status, data)); return; }

    const sc = (data as { scorecard: Scorecard }).scorecard;
    setDraft({ ...sc, slug: sc.slug || deriveSlug(sc.question) });
    setSlugTouched(true);
    setSavedSlug(null);
    setSaveError(null);
  };

  // ---------------------------------------------------------------------------
  // Editor helpers
  // ---------------------------------------------------------------------------

  const updateDraft = (updater: (prev: Scorecard) => Scorecard) => {
    setDraft(prev => (prev ? updater(prev) : null));
  };

  const updatePosition = (posIdx: number, updates: Partial<ScorecardPosition>) => {
    updateDraft(sc => {
      const positions = [...sc.positions];
      positions[posIdx] = { ...positions[posIdx]!, ...updates };
      return { ...sc, positions };
    });
  };

  const updateSource = (posIdx: number, srcIdx: number, updates: Partial<ScorecardSource>) => {
    updateDraft(sc => {
      const positions = [...sc.positions];
      const sources = [...positions[posIdx]!.sources];
      sources[srcIdx] = { ...sources[srcIdx]!, ...updates };
      positions[posIdx] = { ...positions[posIdx]!, sources };
      return { ...sc, positions };
    });
  };

  const handleSave = async () => {
    if (!draft)  { setSaveError('No draft to save.'); return; }
    if (!secret) { setSaveError('Enter the secret first.'); return; }

    setSaving(true);
    setSaveError(null);
    setSavedSlug(null);

    const { ok, status, data } = await apiPost('/api/save-scorecard', draft, secret);
    setSaving(false);

    if (!ok) { setSaveError(fmtApiError(status, data)); return; }

    setSavedSlug((data as { slug: string }).slug);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div class="max-w-4xl mx-auto px-4 py-4 space-y-8">

      {/* ------------------------------------------------------------------ */}
      {/* (a) Top bar                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section class={sectionCls}>
        <h2 class="text-sm font-semibold text-gray-700">Settings</h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class={labelCls} for="curator-secret">Secret</label>
            <input
              id="curator-secret"
              type="password"
              class={inputCls}
              placeholder="wh-analyser-…"
              value={secret}
              onInput={e => handleSecretChange((e.currentTarget as HTMLInputElement).value)}
              autocomplete="off"
            />
          </div>

          <div>
            <label class={labelCls} for="curator-load">Load existing scorecard</label>
            <select
              id="curator-load"
              class={inputCls}
              onChange={e => handleLoadExisting((e.currentTarget as HTMLSelectElement).value)}
            >
              <option value="">- select to load into editor -</option>
              {existingScorecards.map(sc => (
                <option key={sc.slug} value={sc.slug}>
                  {sc.question} ({sc.publishedDate})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <button class={btnSecondary} onClick={handleNewBlank}>
            + New blank scorecard
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* (b) Composer                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section class={sectionCls}>
        <div>
          <h2 class="text-sm font-semibold text-gray-700">Composer</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            Assemble source articles per position and generate a draft. Or skip straight to the Editor below.
          </p>
        </div>

        <div>
          <label class={labelCls}>Debate question</label>
          <input
            class={inputCls}
            placeholder="Should schools ban smartphones during the school day?"
            value={composer.question}
            onInput={e =>
              setComposer(prev => ({
                ...prev,
                question: (e.currentTarget as HTMLInputElement).value,
              }))
            }
          />
        </div>

        {/* Positions */}
        <div class="space-y-4">
          {composer.positions.map((pos, posIdx) => (
            <div key={posIdx} class={cardCls}>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-400 shrink-0">
                  Position {posIdx + 1}
                </span>
                <input
                  class={inputCls + ' flex-1'}
                  placeholder={`Label, e.g. "Full ban"`}
                  value={pos.label}
                  onInput={e => {
                    const label = (e.currentTarget as HTMLInputElement).value;
                    setComposer(prev => {
                      const positions = [...prev.positions];
                      positions[posIdx] = { ...positions[posIdx]!, label };
                      return { ...prev, positions };
                    });
                  }}
                />
                <button
                  class={btnDanger}
                  disabled={composer.positions.length <= 2}
                  onClick={() =>
                    setComposer(prev => ({
                      ...prev,
                      positions: prev.positions.filter((_, i) => i !== posIdx),
                    }))
                  }
                  title="Remove position"
                >
                  ✕
                </button>
              </div>

              <div class="flex items-center gap-2 mt-2">
                <label class="text-[11px] text-gray-400 shrink-0">Leaning (-100 left … +100 right)</label>
                <input
                  type="number" min={-100} max={100}
                  class={inputCls + ' w-24'}
                  value={pos.leaning}
                  onInput={e => {
                    const leaning = parseInt((e.currentTarget as HTMLInputElement).value || '0', 10);
                    setComposer(prev => {
                      const positions = [...prev.positions];
                      positions[posIdx] = { ...positions[posIdx]!, leaning };
                      return { ...prev, positions };
                    });
                  }}
                />
                <span class="text-[11px] text-gray-400">drives the Briefing spectrum</span>
              </div>

              {/* Articles */}
              <div class="space-y-3">
                {pos.articles.map((art, artIdx) => (
                  <div key={artIdx} class={innerCardCls}>
                    <div class="flex items-center gap-2">
                      <input
                        class={inputCls + ' flex-1'}
                        placeholder="Article URL"
                        value={art.url}
                        onInput={e =>
                          updateComposerArticle(posIdx, artIdx, {
                            url: (e.currentTarget as HTMLInputElement).value,
                          })
                        }
                      />
                      <button
                        class={btnSecondary}
                        disabled={!art.url.trim() || art.extracting}
                        onClick={() => handleExtract(posIdx, artIdx)}
                      >
                        {art.extracting ? 'Extracting…' : 'Extract'}
                      </button>
                      <button
                        class={btnDanger}
                        disabled={pos.articles.length <= 1}
                        onClick={() => {
                          setComposer(prev => {
                            const positions = [...prev.positions];
                            const articles = positions[posIdx]!.articles.filter(
                              (_, i) => i !== artIdx,
                            );
                            positions[posIdx] = {
                              ...positions[posIdx]!,
                              articles: articles.length ? articles : [newArticle()],
                            };
                            return { ...prev, positions };
                          });
                        }}
                        title="Remove article"
                      >
                        ✕
                      </button>
                    </div>

                    {art.extractError && (
                      <p class={errorCls}>{art.extractError}</p>
                    )}

                    <div class="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label class={labelCls}>Title</label>
                        <input
                          class={inputCls}
                          placeholder="Article title"
                          value={art.title}
                          onInput={e =>
                            updateComposerArticle(posIdx, artIdx, {
                              title: (e.currentTarget as HTMLInputElement).value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label class={labelCls}>Publication</label>
                        <input
                          class={inputCls}
                          placeholder="Publication name"
                          value={art.publication}
                          onInput={e =>
                            updateComposerArticle(posIdx, artIdx, {
                              publication: (e.currentTarget as HTMLInputElement).value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label class={labelCls}>Article text</label>
                      <textarea
                        class={textareaCls + ' min-h-[72px]'}
                        placeholder="Paste article text here, or use Extract to fetch it automatically."
                        value={art.text}
                        onInput={e =>
                          updateComposerArticle(posIdx, artIdx, {
                            text: (e.currentTarget as HTMLTextAreaElement).value,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                class={btnSecondary}
                onClick={() =>
                  setComposer(prev => {
                    const positions = [...prev.positions];
                    positions[posIdx] = {
                      ...positions[posIdx]!,
                      articles: [...positions[posIdx]!.articles, newArticle()],
                    };
                    return { ...prev, positions };
                  })
                }
              >
                + Add article
              </button>
            </div>
          ))}
        </div>

        {composer.positions.length < 5 && (
          <button
            class={btnSecondary}
            onClick={() =>
              setComposer(prev => ({
                ...prev,
                positions: [...prev.positions, newComposerPosition()],
              }))
            }
          >
            + Add position
          </button>
        )}

        {generateError && <p class={errorCls}>{generateError}</p>}

        <div class="flex items-center gap-3">
          <button class={btnPrimary} disabled={generating} onClick={handleGenerate}>
            {generating ? (
              <>
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating… (~30 s)
              </>
            ) : (
              'Generate scorecard'
            )}
          </button>
          {generating && (
            <span class="text-xs text-gray-400">Engine is running - results populate the Editor below</span>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* (c) Editor (visible once a draft exists)                           */}
      {/* ------------------------------------------------------------------ */}
      {draft && (
        <section class={sectionCls}>
          <h2 class="text-sm font-semibold text-gray-700">Editor</h2>

          {/* Metadata */}
          <div class="space-y-3">
            <div>
              <label class={labelCls}>Question</label>
              <input
                class={inputCls}
                value={draft.question}
                onInput={e => {
                  const q = (e.currentTarget as HTMLInputElement).value;
                  updateDraft(sc => ({
                    ...sc,
                    question: q,
                    slug: slugTouched ? sc.slug : deriveSlug(q),
                  }));
                }}
              />
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class={labelCls}>Slug</label>
                <input
                  class={inputCls}
                  value={draft.slug}
                  onInput={e => {
                    setSlugTouched(true);
                    updateDraft(sc => ({
                      ...sc,
                      slug: (e.currentTarget as HTMLInputElement).value,
                    }));
                  }}
                />
                <p class="text-xs text-gray-400 mt-1">
                  Auto-derived from question until you edit this field.
                </p>
              </div>

              <div>
                <label class={labelCls}>Published date</label>
                <input
                  type="date"
                  class={inputCls}
                  value={draft.publishedDate}
                  onInput={e =>
                    updateDraft(sc => ({
                      ...sc,
                      publishedDate: (e.currentTarget as HTMLInputElement).value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label class={labelCls}>Dek (subtitle)</label>
              <textarea
                class={textareaCls + ' min-h-[56px]'}
                value={draft.dek}
                onInput={e =>
                  updateDraft(sc => ({
                    ...sc,
                    dek: (e.currentTarget as HTMLTextAreaElement).value,
                  }))
                }
              />
            </div>
          </div>

          {/* Positions */}
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-semibold text-gray-700">
                Positions ({draft.positions.length} / 5)
              </span>
              {draft.positions.length < 5 && (
                <button
                  class={btnSecondary}
                  onClick={() =>
                    updateDraft(sc => ({
                      ...sc,
                      positions: [...sc.positions, newEditorPosition()],
                    }))
                  }
                >
                  + Add position
                </button>
              )}
            </div>

            <div class="space-y-6">
              {draft.positions.map((pos, posIdx) => (
                <div key={posIdx} class={cardCls}>
                  {/* Position header */}
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-gray-400 shrink-0">
                      Position {posIdx + 1}
                    </span>
                    <input
                      class={inputCls + ' flex-1'}
                      placeholder="Position label"
                      value={pos.label}
                      onInput={e =>
                        updatePosition(posIdx, {
                          label: (e.currentTarget as HTMLInputElement).value,
                        })
                      }
                    />
                    <button
                      class={btnDanger}
                      disabled={draft.positions.length <= 2}
                      onClick={() =>
                        updateDraft(sc => ({
                          ...sc,
                          positions: sc.positions.filter((_, i) => i !== posIdx),
                        }))
                      }
                      title="Remove position"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Best case */}
                  <div>
                    <p class={subHeadCls + ' text-indigo-600'}>Best Case</p>
                    <div class="space-y-2">
                      <div>
                        <label class={labelCls}>Claim</label>
                        <input
                          class={inputCls}
                          value={pos.bestCase.claim}
                          onInput={e =>
                            updatePosition(posIdx, {
                              bestCase: {
                                ...pos.bestCase,
                                claim: (e.currentTarget as HTMLInputElement).value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label class={labelCls}>Grounds</label>
                        <textarea
                          class={textareaCls + ' min-h-[80px]'}
                          value={pos.bestCase.grounds}
                          onInput={e =>
                            updatePosition(posIdx, {
                              bestCase: {
                                ...pos.bestCase,
                                grounds: (e.currentTarget as HTMLTextAreaElement).value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label class={labelCls}>Warrant</label>
                        <textarea
                          class={textareaCls + ' min-h-[56px]'}
                          value={pos.bestCase.warrant}
                          onInput={e =>
                            updatePosition(posIdx, {
                              bestCase: {
                                ...pos.bestCase,
                                warrant: (e.currentTarget as HTMLTextAreaElement).value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fatal flaw */}
                  <div>
                    <p class={subHeadCls + ' text-amber-600'}>Fatal Flaw</p>
                    <div class="space-y-2">
                      <div>
                        <label class={labelCls}>Flaw name</label>
                        <input
                          class={inputCls}
                          value={pos.fatalFlaw.name}
                          onInput={e =>
                            updatePosition(posIdx, {
                              fatalFlaw: {
                                ...pos.fatalFlaw,
                                name: (e.currentTarget as HTMLInputElement).value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label class={labelCls}>Explanation</label>
                        <textarea
                          class={textareaCls + ' min-h-[56px]'}
                          value={pos.fatalFlaw.explanation}
                          onInput={e =>
                            updatePosition(posIdx, {
                              fatalFlaw: {
                                ...pos.fatalFlaw,
                                explanation: (e.currentTarget as HTMLTextAreaElement).value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sources */}
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <p class={subHeadCls + ' text-gray-500'}>Sources</p>
                      <button
                        class={btnSecondary}
                        onClick={() =>
                          updateDraft(sc => {
                            const positions = [...sc.positions];
                            positions[posIdx] = {
                              ...positions[posIdx]!,
                              sources: [
                                ...positions[posIdx]!.sources,
                                { title: '', publication: '', url: '' },
                              ],
                            };
                            return { ...sc, positions };
                          })
                        }
                      >
                        + Add source
                      </button>
                    </div>

                    <div class="space-y-2">
                      {pos.sources.map((src, srcIdx) => (
                        <div key={srcIdx} class={innerCardCls}>
                          <div class="grid gap-2 sm:grid-cols-3">
                            <div>
                              <label class={labelCls}>Title</label>
                              <input
                                class={inputCls}
                                placeholder="Article title"
                                value={src.title}
                                onInput={e =>
                                  updateSource(posIdx, srcIdx, {
                                    title: (e.currentTarget as HTMLInputElement).value,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label class={labelCls}>Publication</label>
                              <input
                                class={inputCls}
                                placeholder="Publisher"
                                value={src.publication}
                                onInput={e =>
                                  updateSource(posIdx, srcIdx, {
                                    publication: (e.currentTarget as HTMLInputElement).value,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label class={labelCls}>URL</label>
                              <input
                                class={inputCls}
                                placeholder="https://…"
                                value={src.url}
                                onInput={e =>
                                  updateSource(posIdx, srcIdx, {
                                    url: (e.currentTarget as HTMLInputElement).value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div class="flex justify-end">
                            <button
                              class={btnDanger}
                              disabled={pos.sources.length <= 1}
                              onClick={() =>
                                updateDraft(sc => {
                                  const positions = [...sc.positions];
                                  const sources = positions[posIdx]!.sources.filter(
                                    (_, i) => i !== srcIdx,
                                  );
                                  positions[posIdx] = {
                                    ...positions[posIdx]!,
                                    sources: sources.length
                                      ? sources
                                      : [{ title: '', publication: '', url: '' }],
                                  };
                                  return { ...sc, positions };
                                })
                              }
                            >
                              Remove source
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meta-analysis */}
          <div>
            <p class={subHeadCls + ' text-gray-700'}>Meta-Analysis</p>
            <div class="space-y-3">
              <div>
                <label class={labelCls}>Bridging warrant</label>
                <textarea
                  class={textareaCls + ' min-h-[56px]'}
                  placeholder="The unstated assumption all sides share…"
                  value={draft.metaAnalysis.bridgingWarrant}
                  onInput={e =>
                    updateDraft(sc => ({
                      ...sc,
                      metaAnalysis: {
                        ...sc.metaAnalysis,
                        bridgingWarrant: (e.currentTarget as HTMLTextAreaElement).value,
                      },
                    }))
                  }
                />
              </div>
              <div>
                <label class={labelCls}>Explanation</label>
                <textarea
                  class={textareaCls + ' min-h-[72px]'}
                  placeholder="Why this shared assumption matters…"
                  value={draft.metaAnalysis.explanation}
                  onInput={e =>
                    updateDraft(sc => ({
                      ...sc,
                      metaAnalysis: {
                        ...sc.metaAnalysis,
                        explanation: (e.currentTarget as HTMLTextAreaElement).value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Save */}
          <div class="pt-2 space-y-3 border-t border-gray-100">
            {saveError && <p class={errorCls}>{saveError}</p>}
            {savedSlug && (
              <p class={successCls}>
                Saved!{' '}
                <a
                  href={`/scorecard/${savedSlug}`}
                  class="underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View /scorecard/{savedSlug}
                </a>
              </p>
            )}
            <button class={btnPrimary} disabled={saving} onClick={handleSave}>
              {saving ? (
                <>
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                'Save & publish'
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
