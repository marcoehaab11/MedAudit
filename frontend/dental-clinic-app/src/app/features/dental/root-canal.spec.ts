import { rootCanalDraft, rootCanalNames } from './root-canal';

describe('Clinic root canal templates', () => {
  for (const quadrant of [1, 2, 3, 4]) {
    for (const position of [1, 2, 3]) {
      it(`uses one Canal 1 for ${quadrant * 10 + position}`, () => expect(rootCanalNames(quadrant * 10 + position)).toEqual(['Canal 1']));
    }
    for (const position of [4, 5]) {
      it(`uses the correct premolar canals for ${quadrant * 10 + position}`, () => expect(rootCanalNames(quadrant * 10 + position)).toEqual(quadrant <= 2 ? ['B', 'P'] : ['B', 'L']));
    }
    for (const position of [6, 7, 8]) {
      it(`uses the correct molar canals for ${quadrant * 10 + position}`, () => expect(rootCanalNames(quadrant * 10 + position)).toEqual(quadrant <= 2 ? position === 8 ? ['MB', 'DB', 'P'] : ['MB', 'MB2', 'DB', 'P'] : ['MB', 'ML', 'DB', 'DL']));
    }
  }
  it('keeps unmeasured canals blank instead of inventing lengths', () => {
    expect(rootCanalDraft(26).canals.every(c => c.lengthMm === null && c.finalFileSize === '')).toBe(true);
  });
  it('restores saved measurements, stage and extra legacy canals without changing the previous record', () => {
    const previous = { id: 'r1', toothId: 't26', toothNumber: 26, stage: 3, notes: 'Next: obturation', canals: [{ id: 'c1', name: 'mb', lengthMm: 21.5, finalFileSize: '25/.06' }, { id: 'c2', name: 'Extra', lengthMm: 20 }], createdAt: '', createdBy: '' };
    const draft = rootCanalDraft(26, previous);
    expect(draft.stage).toBe(3); expect(draft.notes).toBe('Next: obturation');
    expect(draft.canals[0]).toMatchObject({ name: 'MB', lengthMm: 21.5, finalFileSize: '25/.06' });
    expect(draft.canals.map(c => c.name)).toContain('Extra');
    draft.canals[0].lengthMm = 23; expect(previous.canals[0].lengthMm).toBe(21.5);
  });
});
