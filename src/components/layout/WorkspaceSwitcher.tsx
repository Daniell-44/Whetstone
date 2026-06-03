import { useState, useEffect } from 'preact/hooks';

interface WorkspaceOption {
  id:   string;
  name: string;
  role: string;
}

interface Props {
  currentWorkspaceId?: string | null;
}

export default function WorkspaceSwitcher({ currentWorkspaceId }: Props) {
  const [workspaces, setWorkspaces]   = useState<WorkspaceOption[]>([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.ok ? r.json() : null)
      .then((data: unknown) => {
        const typed = data as { ok: boolean; workspaces: WorkspaceOption[] } | null;
        if (typed?.ok) setWorkspaces(typed.workspaces);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const current = workspaces.find(w => w.id === currentWorkspaceId) ?? workspaces[0];

  if (loading || workspaces.length === 0) return null;

  function navigate(workspaceId: string) {
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', workspaceId);
    window.location.href = `/creator/documents?workspace=${workspaceId}`;
  }

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        class="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <span class="max-w-[160px] truncate">{current?.name ?? 'Workspace'}</span>
        <svg class="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div class="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl border border-gray-100 bg-white shadow-lg py-1">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              type="button"
              onClick={() => navigate(ws.id)}
              class={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${ws.id === currentWorkspaceId ? 'font-medium text-amber-700' : 'text-gray-700'}`}
            >
              <span class="block truncate">{ws.name}</span>
              <span class="block text-xs text-gray-400 capitalize">{ws.role}</span>
            </button>
          ))}
          <div class="border-t border-gray-100 mt-1 pt-1">
            <a
              href="/api/workspaces"
              class="block px-4 py-2 text-xs text-gray-400 hover:text-amber-600 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                // Navigate to create workspace page or use inline form
                fetch('/api/workspaces', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: 'New Workspace' }),
                })
                  .then(r => r.json())
                  .then((data: unknown) => {
                    const typed = data as { ok: boolean; workspaceId: string };
                    if (typed.ok) window.location.href = `/workspaces/${typed.workspaceId}/settings`;
                  })
                  .catch(() => {});
              }}
            >
              + New workspace
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
