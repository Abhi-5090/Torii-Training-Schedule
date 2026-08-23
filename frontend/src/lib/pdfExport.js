import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { abbreviateVenue } from './abbreviate.js';

const BRAND_ORANGE = [241, 93, 35];     // #F15D23
const DARK_INK = [26, 22, 19];          // #1A1613
const MUTED_INK = [102, 94, 88];       // #665E58
const ACCENT_BG = [255, 244, 238];      // #FFF4EE
const LINE_BORDER = [228, 220, 212];    // #E4DCD4
const LIGHT_GREY = [247, 246, 244];

function addDocHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background banner
  doc.setFillColor(...DARK_INK);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Orange accent strip
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(0, 24, pageWidth, 2.5, 'F');

  // Title & subtitle text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TORII MINDS · NCET TRAINING MANAGEMENT', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(240, 180, 158);
  doc.text(subtitle || 'Weekly Training & Workload Report', 14, 19);

  // Document title below header banner
  doc.setTextColor(...DARK_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_INK);
  const now = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Generated: ${now}  |  Official Timetable Record`, 14, 44);
}

function addDocFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(...LINE_BORDER);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_INK);
    doc.text('Torii — Step IN Stand OUT  |  Nagarjuna College of Engineering & Technology', 14, pageHeight - 7);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

// Helper to extract detailed trainings and activities breakdowns with venue details
function getTrainerBreakdowns(trainer, days = []) {
  const trainingsMap = {};
  const activitiesBreakdown = {};

  if (trainer.grid && trainer.roles) {
    for (const d of Object.keys(trainer.grid)) {
      const gRow = trainer.grid[d] || [];
      const rRow = trainer.roles[d] || [];
      const vRow = trainer.venues ? trainer.venues[d] || [] : [];

      for (let i = 0; i < gRow.length; i++) {
        const val = gRow[i];
        const role = rRow[i];
        const venue = vRow[i] || '';

        if ((role === 'main' || role === 'support') && val) {
          const key = venue ? `${val}__${venue}` : val;
          if (!trainingsMap[key]) {
            trainingsMap[key] = {
              batchName: val,
              venue: venue || '',
              slots: 0,
              mainSlots: 0,
              supportSlots: 0,
            };
          }
          trainingsMap[key].slots++;
          if (role === 'main') trainingsMap[key].mainSlots++;
          if (role === 'support') trainingsMap[key].supportSlots++;
        } else if (role === 'other' && val) {
          activitiesBreakdown[val] = (activitiesBreakdown[val] || 0) + 1;
        }
      }
    }
  }

  // Fallback to pre-calculated breakdowns if grid was empty
  if (!Object.keys(trainingsMap).length && trainer.trainingsBreakdown) {
    for (const [key, count] of Object.entries(trainer.trainingsBreakdown)) {
      trainingsMap[key] = {
        batchName: key,
        venue: '',
        slots: count,
        mainSlots: count,
        supportSlots: 0,
      };
    }
  }
  if (!Object.keys(activitiesBreakdown).length && trainer.activitiesBreakdown) {
    Object.assign(activitiesBreakdown, trainer.activitiesBreakdown);
  }

  const trainingsList = Object.values(trainingsMap);
  const totalTrainings = (trainer.mainCount || 0) + (trainer.supportCount || 0);
  const totalOther = trainer.otherCount || Object.values(activitiesBreakdown).reduce((s, n) => s + n, 0);

  return {
    trainingsList,
    activitiesBreakdown,
    totalTrainings,
    totalOther,
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   1. EXPORT MASTER BATCHES SCHEDULE PDF
   ─────────────────────────────────────────────────────────────────────────── */
export function exportBatchesPDF(data) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  addDocHeader(doc, 'Master Batches & Sessions Schedule', 'Academic Training Timetable');

  // Summary Metrics Bar
  const totalStudents = data.batches.reduce((s, b) => s + (b.count || 0), 0);
  const totalSessions = data.batches.reduce((s, b) => s + (b.rows || []).length, 0);

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2.5, font: 'helvetica' },
    body: [[
      `Total Batches: ${data.batches.length}`,
      `Active Year Groups: ${data.groups.length}`,
      `Total Enrolled Students: ${totalStudents.toLocaleString()}`,
      `Weekly Sessions: ${totalSessions}`,
      `Training Halls: ${data.venues.length}`,
      `Trainers: ${data.trainers.length}`,
    ]],
    didParseCell: (dataCell) => {
      dataCell.cell.styles.fillColor = ACCENT_BG;
      dataCell.cell.styles.textColor = BRAND_ORANGE;
      dataCell.cell.styles.fontStyle = 'bold';
      dataCell.cell.styles.halign = 'center';
    },
  });

  let currentY = doc.lastAutoTable.finalY + 6;

  for (const group of data.groups) {
    if (currentY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...BRAND_ORANGE);
    doc.text(`${group.group} (${group.batches.length} ${group.batches.length > 1 ? 'Batches' : 'Batch'})`, 14, currentY);

    const rows = [];
    for (const b of group.batches) {
      for (const r of b.rows || []) {
        rows.push([
          b.name + (b.dept ? `\n[${b.dept}]` : ''),
          b.count ? `${b.count} stds` : '—',
          r.day,
          r.time + (r.slot ? `\n(Slot ${r.slot})` : ''),
          r.subject,
          r.venue || '—',
          r.trainer || 'To be assigned',
          r.support && r.support !== '—' ? r.support : '—',
        ]);
      }
    }

    autoTable(doc, {
      startY: currentY + 3,
      margin: { left: 14, right: 14 },
      head: [['Batch / Department', 'Size', 'Days', 'Time & Slots', 'Subject', 'Training Hall', 'Main Mentor(s)', 'Support Mentor(s)']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: DARK_INK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'middle',
        lineColor: LINE_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { halign: 'center', cellWidth: 16 },
        2: { fontStyle: 'bold', halign: 'center', cellWidth: 26 },
        3: { halign: 'center', cellWidth: 38 },
        4: { fontStyle: 'bold', cellWidth: 34 },
        5: { halign: 'center', cellWidth: 38 },
        6: { cellWidth: 38 },
        7: { cellWidth: 34 },
      },
      alternateRowStyles: {
        fillColor: LIGHT_GREY,
      },
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  addDocFooter(doc);
  doc.save('Torii_Batches_Schedule.pdf');
}

/* ───────────────────────────────────────────────────────────────────────────
   2. EXPORT SINGLE TRAINER TIMETABLE & WORKLOAD PDF
   ─────────────────────────────────────────────────────────────────────────── */
export function exportTrainerPDF(trainer, config) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { slots, days, lunchIndex } = config;

  addDocHeader(doc, `Trainer Timetable & Workload: ${trainer.name}`, 'Individual Mentor Weekly Schedule & Venue Deployment');

  const { trainingsList, activitiesBreakdown, totalTrainings, totalOther } = getTrainerBreakdowns(trainer, days);

  const totalOccupied = totalTrainings + totalOther + (trainer.lunchCount || 0);

  const bodyRows = [
    [
      `Total Trainings: ${totalTrainings} slots\n(${trainer.mainCount || 0} Main, ${trainer.supportCount || 0} Support)`,
      `Other Activities: ${totalOther} slots`,
      `Free Periods: ${trainer.totalFree || 0} slots`,
      `Total Active Load: ${totalOccupied} slots`,
    ],
  ];

  if (trainingsList.length > 0) {
    const bulletList = trainingsList.map(t => {
      const roleStr = t.mainSlots && t.supportSlots
        ? `(${t.mainSlots} Main, ${t.supportSlots} Support)`
        : (t.supportSlots ? '(Support Mentor)' : '(Main Mentor)');
      const vStr = t.venue ? ` | Venue: ${t.venue}` : '';
      return `•  ${t.batchName}${vStr}  —  ${t.slots} Slot(s)  ${roleStr}`;
    }).join('\n');

    bodyRows.push([{
      content: `ASSIGNED ACADEMIC TRAININGS & VENUES:\n${bulletList}`,
      colSpan: 4,
      styles: { fontStyle: 'bold', textColor: [184, 56, 14], fillColor: [255, 248, 244], cellPadding: 3, lineHeightFactor: 1.35 },
    }]);
  }

  const otherEntries = Object.entries(activitiesBreakdown);
  if (otherEntries.length > 0) {
    const otherBullets = otherEntries.map(([task, count]) => {
      return `•  ${task}: ${count} Slot(s)`;
    }).join('\n');

    bodyRows.push([{
      content: `OTHER ASSIGNED WORK & SPECIAL DUTIES:\n${otherBullets}`,
      colSpan: 4,
      styles: { fontStyle: 'bold', textColor: [30, 64, 120], fillColor: [244, 248, 254], cellPadding: 3, lineHeightFactor: 1.35 },
    }]);
  }

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica', lineColor: LINE_BORDER },
    body: bodyRows,
    didParseCell: (dataCell) => {
      if (dataCell.row.index === 0) {
        dataCell.cell.styles.fillColor = ACCENT_BG;
        dataCell.cell.styles.textColor = BRAND_ORANGE;
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.halign = 'center';
      }
    },
  });

  // Timetable Grid
  const gridHead = ['Period / Time', ...days];
  const gridRows = slots.map((timeLabel, slotIdx) => {
    const row = [`Slot ${slotIdx + 1}\n${timeLabel}`];
    for (const day of days) {
      const val = trainer.grid?.[day]?.[slotIdx] || '';
      const role = trainer.roles?.[day]?.[slotIdx] || '';
      const venue = trainer.venues?.[day]?.[slotIdx] || '';
      
      if (role === 'main') {
        row.push(`${val}${venue ? `\n@ ${abbreviateVenue(venue)}` : ''}\n[MAIN MENTOR]`);
      } else if (role === 'support') {
        row.push(`${val}${venue ? `\n@ ${abbreviateVenue(venue)}` : ''}\n[SUPPORT]`);
      } else if (role === 'other') {
        row.push(`${val}\n[ASSIGNED]`);
      } else if (role === 'lunch' || (slotIdx === lunchIndex && (!val || val.toLowerCase().includes('lunch')))) {
        row.push('Lunch Break');
      } else if (!val) {
        row.push('Free');
      } else {
        row.push(val);
      }
    }
    return row;
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    margin: { left: 14, right: 14 },
    head: [gridHead],
    body: gridRows,
    theme: 'grid',
    headStyles: {
      fillColor: DARK_INK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      halign: 'center',
      valign: 'middle',
      lineColor: LINE_BORDER,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30, fillColor: LIGHT_GREY },
    },
    didParseCell: (dataCell) => {
      if (dataCell.section === 'body' && dataCell.column.index > 0) {
        const text = String(dataCell.cell.raw || '');
        if (text.includes('[MAIN MENTOR]')) {
          dataCell.cell.styles.fillColor = [254, 237, 230];
          dataCell.cell.styles.textColor = [184, 56, 14];
          dataCell.cell.styles.fontStyle = 'bold';
        } else if (text.includes('[SUPPORT]')) {
          dataCell.cell.styles.fillColor = [255, 245, 240];
          dataCell.cell.styles.textColor = [196, 88, 50];
        } else if (text.includes('[ASSIGNED]')) {
          dataCell.cell.styles.fillColor = [240, 244, 250];
          dataCell.cell.styles.textColor = [30, 64, 120];
          dataCell.cell.styles.fontStyle = 'bold';
        } else if (text === 'Lunch Break') {
          dataCell.cell.styles.fillColor = [250, 248, 245];
          dataCell.cell.styles.textColor = [140, 130, 120];
        } else if (text === 'Free') {
          dataCell.cell.styles.fillColor = [255, 255, 255];
          dataCell.cell.styles.textColor = [160, 150, 140];
        }
      }
    },
  });

  addDocFooter(doc);
  doc.save(`Torii_Trainer_${trainer.name.replace(/\s+/g, '_')}_Schedule.pdf`);
}

/* ───────────────────────────────────────────────────────────────────────────
   3. EXPORT CONSOLIDATED ALL TRAINERS WORKLOAD & TIMETABLES PDF
   ─────────────────────────────────────────────────────────────────────────── */
export function exportAllTrainersPDF(scheduleData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { trainers, slots, days, lunchIndex } = scheduleData;

  // Page 1: Executive Trainer Workload Summary Matrix
  addDocHeader(doc, 'Consolidated Trainer Workload & Deployment Matrix', 'Faculty & Mentor Master Workload and Venue Deployment Summary');

  const summaryRows = trainers.map((t, idx) => {
    const { trainingsList, activitiesBreakdown, totalTrainings, totalOther } = getTrainerBreakdowns(t, days);

    const trainingsBullets = trainingsList.length > 0
      ? trainingsList.map(item => {
          const vStr = item.venue ? ` [${abbreviateVenue(item.venue)}]` : '';
          const roleStr = item.mainSlots && item.supportSlots
            ? ` (${item.mainSlots}M, ${item.supportSlots}S)`
            : (item.supportSlots ? ' (Supp)' : ' (Main)');
          return `• ${item.batchName}${vStr} — ${item.slots}h${roleStr}`;
        }).join('\n')
      : '— None';

    const otherEntries = Object.entries(activitiesBreakdown);
    const otherBullets = otherEntries.length > 0
      ? otherEntries.map(([task, count]) => `• ${task} — ${count}h`).join('\n')
      : '—';

    const totalActive = totalTrainings + totalOther;

    return [
      idx + 1,
      t.name,
      `${totalTrainings} slots\n(${t.mainCount || 0} Main, ${t.supportCount || 0} Supp)`,
      trainingsBullets,
      otherBullets,
      totalActive,
      t.totalFree || 0,
    ];
  });

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    head: [['#', 'Trainer Name', 'Total Trainings', 'Assigned Trainings (Batches, Venues & Hours)', 'Other Assigned Tasks', 'Total Load', 'Free Slots']],
    body: summaryRows,
    theme: 'grid',
    headStyles: {
      fillColor: DARK_INK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      valign: 'middle',
      lineColor: LINE_BORDER,
      lineWidth: 0.15,
      lineHeightFactor: 1.25,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 34 },
      2: { halign: 'center', cellWidth: 28, fontStyle: 'bold', textColor: [184, 56, 14] },
      3: { cellWidth: 96 },
      4: { cellWidth: 44 },
      5: { fontStyle: 'bold', halign: 'center', cellWidth: 24, textColor: BRAND_ORANGE },
      6: { halign: 'center', cellWidth: 20 },
    },
    alternateRowStyles: {
      fillColor: LIGHT_GREY,
    },
  });

  // Individual Timetable Pages for each Trainer
  for (const t of trainers) {
    doc.addPage();
    addDocHeader(doc, `Timetable & Workload: ${t.name}`, `Weekly Timetable, Trainings & Assigned Venues — ${t.email || t.phone || 'Mentor'}`);

    const { trainingsList, activitiesBreakdown, totalTrainings, totalOther } = getTrainerBreakdowns(t, days);

    const totalOccupied = totalTrainings + totalOther + (t.lunchCount || 0);

    const bodyRows = [
      [
        `Total Trainings: ${totalTrainings} slots\n(${t.mainCount || 0} Main, ${t.supportCount || 0} Support)`,
        `Other Activities: ${totalOther} slots`,
        `Free Periods: ${t.totalFree || 0} slots`,
        `Total Active Load: ${totalOccupied} slots`,
      ],
    ];

    if (trainingsList.length > 0) {
      const bulletList = trainingsList.map(item => {
        const roleStr = item.mainSlots && item.supportSlots
          ? `(${item.mainSlots} Main, ${item.supportSlots} Support)`
          : (item.supportSlots ? '(Support Mentor)' : '(Main Mentor)');
        const vStr = item.venue ? ` | Venue: ${item.venue}` : '';
        return `•  ${item.batchName}${vStr}  —  ${item.slots} Slot(s)  ${roleStr}`;
      }).join('\n');

      bodyRows.push([{
        content: `ASSIGNED ACADEMIC TRAININGS & VENUES:\n${bulletList}`,
        colSpan: 4,
        styles: { fontStyle: 'bold', textColor: [184, 56, 14], fillColor: [255, 248, 244], cellPadding: 3, lineHeightFactor: 1.35 },
      }]);
    }

    const otherEntries = Object.entries(activitiesBreakdown);
    if (otherEntries.length > 0) {
      const otherBullets = otherEntries.map(([task, count]) => {
        return `•  ${task}: ${count} Slot(s)`;
      }).join('\n');

      bodyRows.push([{
        content: `OTHER ASSIGNED WORK & SPECIAL DUTIES:\n${otherBullets}`,
        colSpan: 4,
        styles: { fontStyle: 'bold', textColor: [30, 64, 120], fillColor: [244, 248, 254], cellPadding: 3, lineHeightFactor: 1.35 },
      }]);
    }

    autoTable(doc, {
      startY: 48,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica', lineColor: LINE_BORDER },
      body: bodyRows,
      didParseCell: (dataCell) => {
        if (dataCell.row.index === 0) {
          dataCell.cell.styles.fillColor = ACCENT_BG;
          dataCell.cell.styles.textColor = BRAND_ORANGE;
          dataCell.cell.styles.fontStyle = 'bold';
          dataCell.cell.styles.halign = 'center';
        }
      },
    });

    const gridHead = ['Period / Time', ...days];
    const gridRows = slots.map((timeLabel, slotIdx) => {
      const row = [`Slot ${slotIdx + 1}\n${timeLabel}`];
      for (const day of days) {
        const val = t.grid?.[day]?.[slotIdx] || '';
        const role = t.roles?.[day]?.[slotIdx] || '';
        const venue = t.venues?.[day]?.[slotIdx] || '';
        
        if (role === 'main') {
          row.push(`${val}${venue ? `\n@ ${abbreviateVenue(venue)}` : ''}\n[MAIN MENTOR]`);
        } else if (role === 'support') {
          row.push(`${val}${venue ? `\n@ ${abbreviateVenue(venue)}` : ''}\n[SUPPORT]`);
        } else if (role === 'other') {
          row.push(`${val}\n[ASSIGNED]`);
        } else if (role === 'lunch' || (slotIdx === lunchIndex && (!val || val.toLowerCase().includes('lunch')))) {
          row.push('Lunch Break');
        } else if (!val) {
          row.push('Free');
        } else {
          row.push(val);
        }
      }
      return row;
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      margin: { left: 14, right: 14 },
      head: [gridHead],
      body: gridRows,
      theme: 'grid',
      headStyles: {
        fillColor: DARK_INK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.2,
        halign: 'center',
        valign: 'middle',
        lineColor: LINE_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30, fillColor: LIGHT_GREY },
      },
      didParseCell: (dataCell) => {
        if (dataCell.section === 'body' && dataCell.column.index > 0) {
          const text = String(dataCell.cell.raw || '');
          if (text.includes('[MAIN MENTOR]')) {
            dataCell.cell.styles.fillColor = [254, 237, 230];
            dataCell.cell.styles.textColor = [184, 56, 14];
            dataCell.cell.styles.fontStyle = 'bold';
          } else if (text.includes('[SUPPORT]')) {
            dataCell.cell.styles.fillColor = [255, 245, 240];
            dataCell.cell.styles.textColor = [196, 88, 50];
          } else if (text.includes('[ASSIGNED]')) {
            dataCell.cell.styles.fillColor = [240, 244, 250];
            dataCell.cell.styles.textColor = [30, 64, 120];
            dataCell.cell.styles.fontStyle = 'bold';
          } else if (text === 'Lunch Break') {
            dataCell.cell.styles.fillColor = [250, 248, 245];
            dataCell.cell.styles.textColor = [140, 130, 120];
          } else if (text === 'Free') {
            dataCell.cell.styles.fillColor = [255, 255, 255];
            dataCell.cell.styles.textColor = [160, 150, 140];
          }
        }
      },
    });
  }

  addDocFooter(doc);
  doc.save('Torii_Consolidated_Trainers_Schedule.pdf');
}

/* ───────────────────────────────────────────────────────────────────────────
   4. EXPORT SINGLE DAY SCHEDULE PDF
   ─────────────────────────────────────────────────────────────────────────── */
export function exportDayPDF(data, dayName) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dayIdx = data.days.indexOf(dayName);

  addDocHeader(doc, `Daily Academic Schedule: ${dayName}`, 'Official Day-Wise Training & Hall Deployment Record');

  // Collect all sessions for this day
  const rows = [];
  let totalBatches = 0;
  const venuesSet = new Set();
  const trainersSet = new Set();

  for (const group of data.groups) {
    for (const b of group.batches) {
      const dayRows = (b.rows || []).filter(r => dayIdx !== -1 && r.dayIndexes && r.dayIndexes.includes(dayIdx));
      if (dayRows.length > 0) {
        totalBatches++;
        for (const r of dayRows) {
          if (r.venue) venuesSet.add(r.venue);
          (r.mainList || []).forEach(t => trainersSet.add(t));
          (r.supportList || []).forEach(t => trainersSet.add(t));

          rows.push([
            group.group,
            b.name + (b.dept ? `\n[${b.dept}]` : ''),
            r.time + (r.slot ? `\n(Slot ${r.slot})` : ''),
            r.subject,
            r.venue || '—',
            r.trainer || 'To be assigned',
            r.support && r.support !== '—' ? r.support : '—',
            b.count ? `${b.count}` : '—',
          ]);
        }
      }
    }
  }

  // Summary Metrics Bar
  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2.5, font: 'helvetica' },
    body: [[
      `Day: ${dayName}`,
      `Active Batches: ${totalBatches}`,
      `Total Sessions: ${rows.length}`,
      `Mentors on Duty: ${trainersSet.size}`,
      `Halls in Use: ${venuesSet.size}`,
    ]],
    didParseCell: (dataCell) => {
      dataCell.cell.styles.fillColor = ACCENT_BG;
      dataCell.cell.styles.textColor = BRAND_ORANGE;
      dataCell.cell.styles.fontStyle = 'bold';
      dataCell.cell.styles.halign = 'center';
    },
  });

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...MUTED_INK);
    doc.text(`No academic sessions scheduled for ${dayName}.`, 14, doc.lastAutoTable.finalY + 15);
  } else {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      margin: { left: 14, right: 14 },
      head: [['Year Group', 'Batch / Dept', 'Time & Slots', 'Subject', 'Training Hall', 'Main Mentor(s)', 'Support Mentor(s)', 'Students']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: DARK_INK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.2,
        valign: 'middle',
        lineColor: LINE_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 28, halign: 'center' },
        1: { fontStyle: 'bold', cellWidth: 40 },
        2: { halign: 'center', cellWidth: 36 },
        3: { fontStyle: 'bold', cellWidth: 38 },
        4: { halign: 'center', cellWidth: 36 },
        5: { cellWidth: 38 },
        6: { cellWidth: 34 },
        7: { halign: 'center', cellWidth: 18 },
      },
      alternateRowStyles: {
        fillColor: LIGHT_GREY,
      },
    });
  }

  addDocFooter(doc);
  doc.save(`Torii_Schedule_${dayName}.pdf`);
}

