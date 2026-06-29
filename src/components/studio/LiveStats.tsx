import { useMemo } from 'preact/hooks';

function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function sentenceCount(text: string): number {
  const matches = text.match(/[.!?]+(?=\s|$)/g);
  return Math.max(1, matches ? matches.length : 0);
}

function syllableCount(word: string): number {
  const lower   = word.toLowerCase().replace(/[^a-z]/g, '');
  const matches = lower.match(/[aeiou]+/g);
  return Math.max(1, matches ? matches.length : 0);
}

function fleschKincaid(text: string): number {
  const words     = wordCount(text);
  const sentences = sentenceCount(text);
  if (words === 0) return 0;
  const allWords  = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = allWords.reduce((sum, w) => sum + syllableCount(w), 0);
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

function readingTime(words: number): string {
  const mins = Math.max(1, Math.ceil(words / 238));
  return `${mins} min read`;
}

interface Props {
  text: string;
}

export default function LiveStats({ text }: Props) {
  const stats = useMemo(() => {
    const words     = wordCount(text);
    const sentences = sentenceCount(text);
    const avgLen    = words > 0 ? Math.round(words / sentences) : 0;
    const grade     = words >= 20 ? fleschKincaid(text) : 0;
    return { words, sentences, avgLen, grade, reading: readingTime(words) };
  }, [text]);

  if (stats.words === 0) return null;

  return (
    <div class="flex items-center gap-3 text-xs text-gray-400 px-1">
      <span>{stats.words.toLocaleString()} words</span>
      <span>·</span>
      <span>{stats.sentences} sentence{stats.sentences !== 1 ? 's' : ''}</span>
      <span>·</span>
      <span>~{stats.avgLen} w/s</span>
      {stats.grade > 0 && (
        <>
          <span>·</span>
          <span>Grade {stats.grade.toFixed(1)}</span>
        </>
      )}
      <span>·</span>
      <span>{stats.reading}</span>
    </div>
  );
}
