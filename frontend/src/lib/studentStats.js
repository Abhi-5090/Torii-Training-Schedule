/**
 * Calculates the unique enrolled students count across all year groups and sections,
 * preventing double-counting of the same student sections that appear across multiple
 * subject tracks or training modules.
 *
 * @param {Array} batches - List of batch objects
 * @returns {number} Unique students count
 */
export function calculateUniqueStudents(batches = []) {
  if (!Array.isArray(batches)) return 0;

  const byGroup = {};
  for (const b of batches) {
    const grp = (b.group || 'Default').trim();
    if (!byGroup[grp]) byGroup[grp] = [];
    byGroup[grp].push(b);
  }

  let totalUnique = 0;

  for (const groupBatches of Object.values(byGroup)) {
    const sectionMap = {};

    for (const b of groupBatches) {
      const count = Number(b.count) || 0;
      const dept = (b.dept || '').trim().toLowerCase();

      let sectionKey = '';
      if (dept) {
        // Group by department / section within this year group
        sectionKey = 'dept:' + dept;
      } else {
        // Extract section or batch number identifier (e.g., "Batch-1", "Batch 2", "Sec A", "Section 1")
        const match = (b.name || '').match(/(batch\s*[-_]?\s*[0-9]+|sec\s*[-_]?\s*[a-z0-9]+|section\s*[-_]?\s*[a-z0-9]+)/i);
        if (match) {
          sectionKey = 'sec:' + match[1].toLowerCase().replace(/\s+/g, '');
        } else {
          sectionKey = 'name:' + (b.name || '').trim().toLowerCase();
        }
      }

      if (!sectionMap[sectionKey] || count > sectionMap[sectionKey]) {
        sectionMap[sectionKey] = count;
      }
    }

    const groupTotal = Object.values(sectionMap).reduce((a, c) => a + c, 0);
    totalUnique += groupTotal;
  }

  return totalUnique;
}
