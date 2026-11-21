/**
 * RANKING RULE — "Standard competition ranking" (1-2-2-4):
 *
 *  1. Results are ordered by marks obtained, highest first.
 *  2. Students with EQUAL marks receive the SAME rank.
 *  3. The next distinct score skips the positions consumed by the tie.
 *     e.g. marks [95, 90, 90, 80] -> ranks [1, 2, 2, 4]
 *  4. Inside a tie, rows are listed by registration number (A→Z) purely for a
 *     stable, predictable display order; this never affects the rank value.
 *
 * Pure function so it can be unit-tested without a database.
 */
function assignRanks(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (b.marksObtained !== a.marksObtained) return b.marksObtained - a.marksObtained;
    return String(a.registrationNo).localeCompare(String(b.registrationNo));
  });

  let previousMarks = null;
  let previousRank = 0;
  return sorted.map((row, index) => {
    const rank = row.marksObtained === previousMarks ? previousRank : index + 1;
    previousMarks = row.marksObtained;
    previousRank = rank;
    return { ...row, rank };
  });
}

function toPercentage(marks, total) {
  if (!total) return 0;
  return Math.round((marks / total) * 10000) / 100; // 2 decimal places
}

module.exports = { assignRanks, toPercentage };
