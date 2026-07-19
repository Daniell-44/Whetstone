// ---------------------------------------------------------------------------
// analysis-events - shared window-event names for cross-island signalling.
//
// StudioEditor and OnboardingTour are separate Preact islands on
// /creator/studio, so they cannot share component state. StudioEditor
// dispatches this event on the first landing of the audit state in 'done';
// the tour listens for it to start its post-analysis act.
// ---------------------------------------------------------------------------

export const STUDIO_ANALYSIS_DONE_EVENT = 'whetstone:studio-analysis-done';
