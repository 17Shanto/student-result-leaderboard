const { assignRanks, toPercentage } = require('../src/services/ranking');

describe('assignRanks (standard competition ranking)', () => {
  test('orders by marks descending and gives equal marks the same rank', () => {
    const ranked = assignRanks([
      { registrationNo: 'C', marksObtained: 80 },
      { registrationNo: 'B', marksObtained: 90 },
      { registrationNo: 'A', marksObtained: 95 },
      { registrationNo: 'D', marksObtained: 90 },
    ]);
    expect(ranked.map((r) => [r.registrationNo, r.rank])).toEqual([
      ['A', 1],
      ['B', 2],
      ['D', 2],
      ['C', 4], // skips rank 3 because two students share rank 2
    ]);
  });

  test('everyone tied shares rank 1', () => {
    const ranked = assignRanks([
      { registrationNo: 'X', marksObtained: 50 },
      { registrationNo: 'Y', marksObtained: 50 },
    ]);
    expect(ranked.every((r) => r.rank === 1)).toBe(true);
  });

  test('empty input returns empty list', () => {
    expect(assignRanks([])).toEqual([]);
  });

  test('percentage is rounded to two decimals', () => {
    expect(toPercentage(2, 3)).toBe(66.67);
    expect(toPercentage(0, 100)).toBe(0);
  });
});
