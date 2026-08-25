/**
 * The two pure helpers behind the Reader's transcript path.
 *
 * isYouTubeUrl decides whether a pasted link goes to segmentation or to the
 * article extractor. Getting it wrong in one direction sends a video to the
 * extractor, which returns a player shell that the engine then audits as if it
 * were prose. Getting it wrong in the other sends an article to segmentation,
 * which finds no argument passages in something that is one long argument.
 */
import { describe, it, expect } from 'vitest';
import { isYouTubeUrl } from '../../src/components/audit/AuditForm';
import { timeRange } from '../../src/components/transcript/TranscriptSegments';

describe('isYouTubeUrl', () => {
  it('matches the forms a reader actually pastes', () => {
    const yes = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/abc123',
      'https://www.youtube.com/embed/abc123',
      'https://www.youtube.com/live/abc123',
      'http://www.youtube.com/watch?v=abc',
      '  https://youtu.be/abc  ',
      'HTTPS://WWW.YOUTUBE.COM/WATCH?V=ABC',
    ];
    for (const u of yes) expect(isYouTubeUrl(u), u).toBe(true);
  });

  it('leaves ordinary articles to the article extractor', () => {
    const no = [
      'https://www.theguardian.com/environment/2026/aug/01/nuclear-costings',
      'https://youtube.blogspot.com/watch?v=abc',
      'https://notyoutube.com/watch?v=abc',
      'https://www.youtube.com/',
      'https://www.youtube.com/@somechannel',
      'https://example.com/?url=https://youtu.be/abc',
      '',
      'not a url at all',
    ];
    for (const u of no) expect(isYouTubeUrl(u), u).toBe(false);
  });
});

describe('timeRange', () => {
  it('formats minutes and seconds', () => {
    expect(timeRange(305, 512)).toBe('5:05 - 8:32');
    expect(timeRange(0, 59)).toBe('0:00 - 0:59');
  });

  it('adds an hours field only once there are hours', () => {
    expect(timeRange(3661, 3725)).toBe('1:01:01 - 1:02:05');
    expect(timeRange(59, 61)).toBe('0:59 - 1:01');
  });

  it('prints nothing for a pasted transcript with no timings', () => {
    // Every cue sits at zero when there are no timestamps, and a range of
    // 0:00 to 0:00 on every row is noise dressed as data.
    expect(timeRange(0, 0)).toBe('');
  });
});
