// Stored topic-page record. The display shape (TopicData) plus storage
// metadata (slug, dates, status, category). The cross-document audit result
// is computed once at publish and cached here so every reader is served the
// same pre-computed analysis at near-zero per-view cost.

export type ArticleType = 'news' | 'opinion' | 'analysis';

export interface StoredTopicSource {
  id:           string;
  outlet:       string;
  writer:       string | null;
  date:         string;
  type:         ArticleType;
  leaning:      number;        // -100..+100
  title:        string;
  url:          string;
  mainPoint:    string;
  centralClaim: string;
  keyWarrant:   string;
  steelman:     string;
}

export interface StoredTopicTakeaways {
  agree:            string;
  realDisagreement: string;
  sharedAssumption: string;
  talkingPast:      string;
}

export interface StoredTopic {
  slug:          string;
  question:      string;
  framing:       string;
  category:      string | null;
  sources:       StoredTopicSource[];
  takeaways:     StoredTopicTakeaways;
  editorNote:    string | null;     // the Whetstone editor's voice (optional)
  publishedDate: string;            // YYYY-MM-DD
  status:        'draft' | 'published';
}
