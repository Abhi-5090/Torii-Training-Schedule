import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  addDocHeader(doc, `Trainer Timetable & Workload: ${trainer.name}`, 'Individual Mentor Weekly Schedule');

  // Workload metrics
  const breakdownList = Object.entries(trainer.activitiesBreakdown || {})
    .map(([task, count]) => `${task}: ${count} slot(s)`)
    .join('  •  ');

  const totalClasses = (trainer.mainCount || 0) + (trainer.supportCount || 0);
  const totalOccupied = totalClasses + (trainer.otherCount || 0) + (trainer.lunchCount || 0);

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2.2, font: 'helvetica' },
    body: [
      [
        `Main Mentor: ${trainer.mainCount || 0} slots`,
        `Support Mentor: ${trainer.supportCount || 0} slots`,
        `Assigned Work: ${trainer.otherCount || 0} slots`,
        `Free Periods: ${trainer.totalFree || 0} slots`,
        `Total Active Load: ${totalOccupied} slots`,
      ],
      ...(breakdownList ? [[{ content: `Special Assignments: ${breakdownList}`, colSpan: 5, styles: { fontStyle: 'italic', textColor: MUTED_INK } }]] : []),
    ],
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
      
      if (role === 'main') {
        row.push(`${val}\n[MAIN MENTOR]`);
      } else if (role === 'support') {
        row.push(`${val}\n[SUPPORT]`);
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
      fontSize: 8,
      cellPadding: 2.5,
      halign: 'center',
      valign: 'middle',
      lineColor: LINE_BORDER,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32, fillColor: LIGHT_GREY },
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

  // Page 1: Executive Trainer Workload Summary
  addDocHeader(doc, 'Consolidated Trainer Workload & Deployment Matrix', 'Faculty & Mentor Master Workload Summary');

  const summaryRows = trainers.map((t, idx) => {
    const taskDetails = Object.entries(t.activitiesBreakdown || {})
      .map(([task, count]) => `${task} (${count})`)
      .join(', ');

    const totalClasses = (t.mainCount || 0) + (t.supportCount || 0);
    const totalActive = totalClasses + (t.otherCount || 0);

    return [
      idx + 1,
      t.name,
      t.mainCount || 0,
      t.supportCount || 0,
      t.otherCount || 0,
      taskDetails || '—',
      totalActive,
      t.totalFree || 0,
    ];
  });

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    head: [['#', 'Trainer Name', 'Main Classes', 'Support Classes', 'Assigned Tasks', 'Task Breakdown / Details', 'Total Occupied Slots', 'Free Slots']],
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
      fontSize: 8,
      cellPadding: 2.2,
      valign: 'middle',
      lineColor: LINE_BORDER,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'center', cellWidth: 26 },
      5: { cellWidth: 80 },
      6: { fontStyle: 'bold', halign: 'center', cellWidth: 32, textColor: BRAND_ORANGE },
      7: { halign: 'center', cellWidth: 22 },
    },
    alternateRowStyles: {
      fillColor: LIGHT_GREY,
    },
  });

  // Individual Timetable Pages for each Trainer
  for (const t of trainers) {
    doc.addPage();
    addDocHeader(doc, `Timetable: ${t.name}`, `Weekly Timetable & Assigned Tasks — ${t.email || t.phone || 'Mentor'}`);

    const breakdownList = Object.entries(t.activitiesBreakdown || {})
      .map(([task, count]) => `${task}: ${count} slot(s)`)
      .join('  •  ');

    const totalClasses = (t.mainCount || 0) + (t.supportCount || 0);
    const totalOccupied = totalClasses + (t.otherCount || 0) + (t.lunchCount || 0);

    autoTable(doc, {
      startY: 48,
      margin: { left: 14, right: 14 },
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica' },
      body: [
        [
          `Main Mentor: ${t.mainCount || 0} slots`,
          `Support Mentor: ${t.supportCount || 0} slots`,
          `Assigned Work: ${t.otherCount || 0} slots`,
          `Free Periods: ${t.totalFree || 0} slots`,
          `Total Occupied: ${totalOccupied} slots`,
        ],
        ...(breakdownList ? [[{ content: `Special Assignments: ${breakdownList}`, colSpan: 5, styles: { fontStyle: 'italic', textColor: MUTED_INK } }]] : []),
      ],
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
        
        if (role === 'main') {
          row.push(`${val}\n[MAIN MENTOR]`);
        } else if (role === 'support') {
          row.push(`${val}\n[SUPPORT]`);
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
        fontSize: 8,
        cellPadding: 2.5,
        halign: 'center',
        valign: 'middle',
        lineColor: LINE_BORDER,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32, fillColor: LIGHT_GREY },
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
