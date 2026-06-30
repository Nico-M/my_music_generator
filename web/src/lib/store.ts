import { create } from 'zustand';

export interface LyricLine {
  id: string;
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
  source: string;
  confidence: number | null;
  projectId: string;
}

export interface Project {
  id: string;
  title: string;
  audioPath: string;
  durationMs: number;
  vocalStartMs: number | null;
  vocalEndMs: number | null;
  template: string | null;
  transcriptJson: string | null;
  createdAt: string;
  updatedAt: string;
  lines: LyricLine[];
}

interface EditorStore {
  project: Project | null;
  lines: LyricLine[];
  currentTimeMs: number;
  isPlaying: boolean;

  setProject: (p: Project) => void;
  setLines: (lines: LyricLine[]) => void;
  setCurrentTimeMs: (ms: number) => void;
  setIsPlaying: (playing: boolean) => void;
  updateLine: (index: number, partial: Partial<LyricLine>) => void;
  saveTimeline: () => Promise<void>;
  saveLyrics: (texts: string[]) => Promise<void>;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: null,
  lines: [],
  currentTimeMs: 0,
  isPlaying: false,

  setProject: (p) => set({ project: p, lines: p.lines ?? [] }),

  setLines: (lines) => set({ lines }),

  setCurrentTimeMs: (ms) => set({ currentTimeMs: ms }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  updateLine: (index, partial) =>
    set((state) => ({
      lines: state.lines.map((line, i) =>
        i === index ? { ...line, ...partial } : line
      ),
    })),

  saveTimeline: async () => {
    const { project, lines } = get();
    if (!project) return;

    const res = await fetch(`/api/projects/${project.id}/timeline`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines: lines.map((l) => ({
          index: l.index,
          startMs: l.startMs,
          endMs: l.endMs,
        })),
      }),
    });
    const updated = await res.json();
    set({ project: updated, lines: updated.lines ?? [] });
  },

  saveLyrics: async (texts: string[]) => {
    const { project } = get();
    if (!project) return;

    await fetch(`/api/projects/${project.id}/lyrics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });

    // Reload project to get updated lines
    const res = await fetch(`/api/projects/${project.id}`);
    const updated = await res.json();
    set({ project: updated, lines: updated.lines ?? [] });
  },
}));
