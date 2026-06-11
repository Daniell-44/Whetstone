// ---------------------------------------------------------------------------
// Whitelisted event catalogue + metadata schema.
//
// Adding a new event:
//   1. Add it to ANALYTICS_EVENT_NAMES below
//   2. Add a one-line description in EVENT_DESCRIPTIONS
//   3. Document any new metadata keys allowed for that event
//
// The catalogue is enforced server-side: events not in this list are rejected
// at the ingestion endpoint. This makes auditing what we collect trivial.
// ---------------------------------------------------------------------------

export const ANALYTICS_EVENT_NAMES = [
  // Page navigation
  'page_view',

  // Audit flow
  'audit_started',
  'audit_completed',
  'audit_failed',

  // Sample-based exploration
  'sample_picked',
  'sample_audit_viewed',

  // Sharing
  'audit_share_link_created',
  'finding_card_shared',
  'scorecard_shared',

  // Studio actions
  'goal_changed',
  'view_mode_changed',         // highlights ↔ heatmap, text ↔ diagram ↔ inverted
  'finding_action_taken',      // accept / dismiss / addressed
  'feedback_submitted',

  // Counterargument and tools
  'counterargument_requested',
  'transcript_audit_started',
  'transcript_audit_completed',

  // Subscription
  'pricing_viewed',
  'checkout_started',
  'subscription_started',
  'subscription_cancelled',

  // Account
  'account_signed_in',
  'account_signed_out',

  // A/B testing
  'experiment_exposure',

  // Lenses (Studio-tier)
  'presupposition_requested',
  'rhetorical_mode_requested',
  'epistemic_humility_requested',
  'disagreement_engagement_requested',
  'structural_incentive_requested',

  // Onboarding
  'onboarding_step',

  // Cross-document
  'cross_document_started',
  'cross_document_completed',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const EVENT_DESCRIPTIONS: Record<AnalyticsEventName, string> = {
  page_view:                    'A page was loaded',
  audit_started:                'User triggered an audit',
  audit_completed:              'Audit returned successfully',
  audit_failed:                 'Audit returned an error',
  sample_picked:                'User loaded one of the pre-cached samples in Studio',
  sample_audit_viewed:          'User viewed the cached audit results for a sample',
  audit_share_link_created:     'User created a shareable audit permalink',
  finding_card_shared:          'User opened the share-as-image popover for a finding',
  scorecard_shared:             'User clicked a share button on a scorecard',
  goal_changed:                 'User changed audience or intent in the goal selector',
  view_mode_changed:            'User toggled between view modes (highlights/heatmap/diagram/etc.)',
  finding_action_taken:         'User clicked accept/dismiss/addressed on a finding',
  feedback_submitted:           'User submitted thumbs-up/down or qualitative feedback',
  counterargument_requested:    'User ran the counterargument generator',
  transcript_audit_started:     'User started a transcript audit',
  transcript_audit_completed:   'Transcript audit returned successfully',
  pricing_viewed:               'Pricing page was viewed',
  checkout_started:             'User clicked checkout in Stripe',
  subscription_started:         'Stripe webhook confirmed new subscription',
  subscription_cancelled:       'Stripe webhook confirmed cancellation',
  account_signed_in:            'Magic-link sign-in completed',
  account_signed_out:           'User signed out',
  experiment_exposure:          'User was first shown a variant of an active experiment',
  presupposition_requested:         'User ran the presupposition lens',
  rhetorical_mode_requested:        'User ran the rhetorical-mode lens',
  epistemic_humility_requested:     'User ran the epistemic-humility lens',
  disagreement_engagement_requested:'User ran the disagreement-engagement lens',
  structural_incentive_requested:   'User ran the structural-incentive (cui bono) lens',
  onboarding_step:                  'Onboarding tour step shown / skipped / completed',
  cross_document_started:           'User started a cross-document audit',
  cross_document_completed:         'Cross-document audit returned successfully',
};

// ---------------------------------------------------------------------------
// Allowed metadata keys per event. Any key not in the per-event allowlist is
// stripped at ingestion. Values are always coerced to string|number|boolean.
// ---------------------------------------------------------------------------

export const EVENT_METADATA_ALLOWLIST: Record<AnalyticsEventName, readonly string[]> = {
  page_view:                  ['referrer_kind'] as const,    // 'internal' | 'external' | 'direct' — never a full referrer URL
  audit_started:              ['surface', 'source_kind'] as const,
  audit_completed:            ['latency_ms', 'finding_count', 'has_phase_two'] as const,
  audit_failed:               ['error_code'] as const,
  sample_picked:              ['sample_id'] as const,
  sample_audit_viewed:        ['sample_id'] as const,
  audit_share_link_created:   [],
  finding_card_shared:        ['severity'] as const,
  scorecard_shared:           ['platform', 'category'] as const,
  goal_changed:               ['field', 'value'] as const,
  view_mode_changed:          ['context', 'from', 'to'] as const,
  finding_action_taken:       ['lens', 'action'] as const,
  feedback_submitted:         ['lens', 'rating'] as const,
  counterargument_requested:  ['surface'] as const,
  transcript_audit_started:   ['kind'] as const,
  transcript_audit_completed: ['latency_ms', 'segment_count'] as const,
  pricing_viewed:             [],
  checkout_started:           ['tier'] as const,
  subscription_started:       ['tier'] as const,
  subscription_cancelled:     ['tier'] as const,
  account_signed_in:          [],
  account_signed_out:         [],
  experiment_exposure:        ['experiment', 'variant'] as const,
  presupposition_requested:         ['surface', 'finding_count'] as const,
  rhetorical_mode_requested:        ['surface', 'dominant_appeal'] as const,
  epistemic_humility_requested:     ['surface', 'verdict'] as const,
  disagreement_engagement_requested:['surface', 'verdict'] as const,
  structural_incentive_requested:   ['surface', 'alignment_count'] as const,
  onboarding_step:                  ['event', 'step'] as const,
  cross_document_started:           ['doc_count'] as const,
  cross_document_completed:         ['latency_ms', 'finding_count'] as const,
};
