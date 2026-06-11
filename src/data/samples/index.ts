import { HELMETS_SAMPLE } from './helmets';
import { STUDY_ABSTRACT_SAMPLE } from './study-abstract';
import { POLEMIC_SAMPLE } from './polemic';
import type { Sample } from './types';

export { sampleSignature } from './types';
export type { Sample } from './types';

export const SAMPLES: Sample[] = [
  HELMETS_SAMPLE,
  STUDY_ABSTRACT_SAMPLE,
  POLEMIC_SAMPLE,
];

export function getSampleById(id: string): Sample | undefined {
  return SAMPLES.find(s => s.id === id);
}
