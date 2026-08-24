/**
 * Troy AI Intelligence & Query Engine
 * Accurately answers schedule, trainer, batch, venue, and time queries
 * directly from live database schedule data.
 */

// Helper to normalize strings for comparison
function norm(str) {
  return String(str || '').toLowerCase().trim().replace(/[-_.,/\\()]/g, ' ');
}

// Check if query contains any of the keywords
function hasAny(q, ...keywords) {
  const nq = norm(q);
  return keywords.some(k => {
    const nk = norm(k);
    if (!nk) return false;
    const regex = new RegExp(`\\b${nk}\\b`, 'i');
    return regex.test(nq) || nq.includes(nk);
  });
}

// Find day mentioned in user query
function extractDay(q, days = []) {
  const nq = norm(q);
  const dayNames = [
    { full: 'monday', short: 'mon', standard: 'Monday' },
    { full: 'tuesday', short: 'tue', standard: 'Tuesday' },
    { full: 'wednesday', short: 'wed', standard: 'Wednesday' },
    { full: 'thursday', short: 'thu', standard: 'Thursday' },
    { full: 'friday', short: 'fri', standard: 'Friday' },
    { full: 'saturday', short: 'sat', standard: 'Saturday' },
    { full: 'sunday', short: 'sun', standard: 'Sunday' },
  ];

  if (hasAny(nq, 'today')) {
    const jsDay = new Date().getDay(); // 0 = Sun, 1 = Mon...
    const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const current = map[jsDay];
    if (days.includes(current)) return current;
    return days[0] || 'Monday';
  }

  if (hasAny(nq, 'tomorrow')) {
    const jsDay = (new Date().getDay() + 1) % 7;
    const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const tomorrow = map[jsDay];
    if (days.includes(tomorrow)) return tomorrow;
    return days[0] || 'Monday';
  }

  for (const d of dayNames) {
    if (new RegExp(`\\b(${d.full}|${d.short})\\b`, 'i').test(nq)) {
      const match = days.find(x => norm(x) === d.full || norm(x) === d.short);
      return match || d.standard;
    }
  }

  return null;
}

// Find period/slot mentioned in user query
function extractSlot(q, slots = []) {
  const nq = norm(q);
  const match = nq.match(/\b(slot|period|hour|session)\s*([0-9]+)\b/i) || nq.match(/\bp([0-9]+)\b/i);
  if (match) {
    const num = parseInt(match[1] || match[2] || match[0], 10);
    if (!isNaN(num) && num >= 1 && num <= slots.length) {
      return { index: num - 1, number: num, label: slots[num - 1] || `Period ${num}` };
    }
  }
  return null;
}

/**
 * Main query processor for Troy
 * @param {string} userQuery
 * @param {object} scheduleData - Full schedule graph from API
 * @returns {string} Markdown formatted response
 */
export function answerScheduleQuery(userQuery, scheduleData) {
  if (!scheduleData) {
    return "I'm connecting to the live schedule database right now. Please ask me again in a moment!";
  }

  const q = String(userQuery || '').trim();
  if (!q) {
    return "How can I help you today? You can ask me about any trainer, batch, hall, subject, or daily timetable!";
  }

  const {
    config = {},
    trainers = [],
    venues = [],
    batches = [],
    groups = [],
    upcoming = [],
    conflicts = [],
  } = scheduleData;

  const days = config.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const slots = config.slots || [];
  const lunchIndex = config.lunchIndex !== undefined ? config.lunchIndex : 3;

  const nq = norm(q);
  const targetDay = extractDay(q, days);
  const targetSlot = extractSlot(q, slots);

  // ── 1. GREETINGS & SMALL TALK ──────────────────────────────────────
  if (/^(hi|hello|hey|greetings|hola|namaste|yo|good\s*(morning|afternoon|evening))\b/i.test(nq)) {
    return `Hello! 👋 I'm **Troy**, your AI schedule assistant for **Torii Training Management**.\n\nI'm trained live on our entire database containing **${batches.length} batches**, **${trainers.length} trainers**, and **${venues.length} training halls**.\n\n**Here are things you can ask me:**\n- 👨‍🏫 *"What is Abhishek's schedule?"* or *"Who teaches Python?"*\n- 🎓 *"When is Batch-1 class on Monday?"*\n- 🏢 *"Which halls are free on Wednesday?"*\n- 📅 *"Show Monday timetable"* or *"When is lunch break?"*\n- 📊 *"Summary of all batches and trainers"*`;
  }

  if (hasAny(nq, 'who are you', 'what are you', 'your name', 'about you', 'who is troy')) {
    return `I am **Troy**, the intelligent chatbot and timetable companion for the **Torii Training Schedule Board** at NCET.\n\nI continuously monitor the master schedule database to provide instant, 100% accurate information on:\n- 📅 **Batch classes & rooms**\n- 👨‍🏫 **Trainer assignments & free hours**\n- 🏛️ **Venue/Hall occupancy**\n- ⏰ **Live daily periods & break timings**\n\nAsk me anything!`;
  }

  // ── 2. LUNCH BREAK & PERIOD CONFIG ────────────────────────────────
  if (hasAny(nq, 'lunch', 'lunch break', 'recess', 'interval', 'break time')) {
    const lunchSlotName = slots[lunchIndex] || 'Period 4';
    return `🍽️ **Lunch Break Details:**\n\n- **Period:** Slot ${lunchIndex + 1} (${lunchSlotName})\n- **Timing:** Dedicated campus-wide break for all trainers and batches.\n\n*(Note: Sessions scheduled around lunch resume immediately in Slot ${lunchIndex + 2})*`;
  }

  if (hasAny(nq, 'slots', 'periods', 'timings', 'bell schedule', 'what time does slot', 'class hours')) {
    let res = `⏰ **Master College Period Timings (${slots.length} Slots):**\n\n`;
    slots.forEach((s, idx) => {
      const isLunch = idx === lunchIndex;
      res += `- **Slot ${idx + 1}:** \`${s}\` ${isLunch ? '🍱 *(Lunch Break)*' : ''}\n`;
    });
    res += `\n**Teaching Days:** ${days.join(', ')}`;
    return res;
  }

  // ── 3. CONFLICTS & SCHEDULE INTEGRITY ─────────────────────────────
  if (hasAny(nq, 'conflict', 'conflicts', 'double booking', 'clash', 'overlap')) {
    if (!conflicts || conflicts.length === 0) {
      return `✅ **No Schedule Conflicts!**\n\nAll **${batches.length} batches** and **${trainers.length} trainers** have zero overlapping bookings. Every training hall and trainer slot is cleanly allocated.`;
    }
    let res = `⚠️ **Detected ${conflicts.length} Schedule Conflict(s):**\n\n`;
    conflicts.forEach((c, idx) => {
      res += `${idx + 1}. **${c.kind === 'trainer' ? 'Trainer Clash' : 'Hall Clash'}:** \`${c.subject}\` on **${c.day}** (${c.slot}) between **${c.batches.join('** and **')}**\n`;
    });
    return res;
  }

  // ── 4. OVERALL STATS & SUMMARY ───────────────────────────────────
  if (hasAny(nq, 'stats', 'statistics', 'summary', 'overview', 'how many', 'total count', 'numbers')) {
    const totalStudents = batches.reduce((acc, b) => acc + (Number(b.count) || 0), 0);
    const totalSessions = batches.reduce((acc, b) => acc + (b.rows || []).length, 0);
    const activeTrainers = trainers.filter(t => t.totalTrainings > 0).length;

    let res = `📊 **Torii Master Schedule Overview:**\n\n`;
    res += `- **Total Year Groups:** ${groups.length} active ${upcoming.length > 0 ? `(+ ${upcoming.length} upcoming)` : ''}\n`;
    res += `- **Total Batches:** ${batches.length} batches (${totalStudents > 0 ? totalStudents.toLocaleString() + ' students' : 'enrolled'})\n`;
    res += `- **Total Weekly Sessions:** ${totalSessions} class blocks\n`;
    res += `- **Registered Trainers:** ${trainers.length} (${activeTrainers} actively assigned)\n`;
    res += `- **Available Halls/Venues:** ${venues.length} locations\n`;
    res += `- **Teaching Days:** ${days.length} days (${days.join(', ')})\n\n`;

    if (upcoming.length > 0) {
      res += `⏳ **Upcoming Bands:** ${upcoming.map(u => `*${u.group}*`).join(', ')}\n`;
    }
    return res;
  }

  // ── 5. TRAINER SCHEDULE & AVAILABILITY ─────────────────────────────
  // Look for trainer name match
  const matchedTrainer = trainers.find(t => {
    const tn = norm(t.name);
    return nq.includes(tn) || tn.split(' ').some(part => part.length >= 3 && new RegExp(`\\b${part}\\b`, 'i').test(nq));
  });

  if (matchedTrainer) {
    // Check if looking for availability on a specific day/slot
    if (targetDay || targetSlot) {
      const d = targetDay || days[0];
      const gridDay = matchedTrainer.grid?.[d] || [];
      const rolesDay = matchedTrainer.roles?.[d] || [];
      const venuesDay = matchedTrainer.venues?.[d] || [];

      if (targetSlot) {
        const slotVal = gridDay[targetSlot.index];
        const roleVal = rolesDay[targetSlot.index];
        const hallVal = venuesDay[targetSlot.index];

        if (!slotVal || slotVal === 'Lunch Break' || slotVal === 'Free') {
          return `🟢 **${matchedTrainer.name} is FREE on ${d} at Slot ${targetSlot.number} (${targetSlot.label})**.\n\nNo training session or task is booked for this period.`;
        }
        return `🔴 **${matchedTrainer.name} is BUSY on ${d} at Slot ${targetSlot.number} (${targetSlot.label})**:\n\n- **Activity/Class:** ${slotVal}\n- **Role:** ${roleVal === 'main' ? 'Lead Trainer' : roleVal === 'support' ? 'Support Trainer' : 'Assigned'}\n${hallVal ? `- **Venue:** ${hallVal}` : ''}`;
      }

      // Entire day schedule for this trainer
      let dayRes = `📋 **${matchedTrainer.name}'s Schedule for ${d}:**\n\n`;
      let hasClass = false;
      slots.forEach((s, idx) => {
        const item = gridDay[idx];
        const role = rolesDay[idx];
        const hall = venuesDay[idx];
        if (item && item !== 'Lunch Break') {
          hasClass = true;
          dayRes += `- **Slot ${idx + 1} (${s}):** **${item}** (${role || 'assigned'})${hall ? ` @ *${hall}*` : ''}\n`;
        } else if (idx === lunchIndex) {
          dayRes += `- **Slot ${idx + 1} (${s}):** 🍱 *Lunch Break*\n`;
        } else {
          dayRes += `- **Slot ${idx + 1} (${s}):** 🟢 *Free*\n`;
        }
      });

      if (!hasClass) {
        dayRes += `\n*${matchedTrainer.name} has no scheduled sessions on ${d} and is fully free for appointments/support.*`;
      }
      return dayRes;
    }

    // Full Trainer Profile & Weekly Breakdown
    let res = `👨‍🏫 **Trainer Profile: ${matchedTrainer.name}**\n\n`;
    if (matchedTrainer.email) res += `📧 **Email:** ${matchedTrainer.email}\n`;
    if (matchedTrainer.phone) res += `📱 **Phone:** ${matchedTrainer.phone}\n`;
    res += `⏱️ **Weekly Workload:** **${matchedTrainer.totalTrainings || 0} active training sessions** (Lead: ${matchedTrainer.mainCount || 0}, Support: ${matchedTrainer.supportCount || 0})\n\n`;

    // Find all batch sessions taught by this trainer
    const taughtSessions = [];
    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        if ((r.mainList || []).includes(matchedTrainer.name) || (r.supportList || []).includes(matchedTrainer.name)) {
          const isMain = (r.mainList || []).includes(matchedTrainer.name);
          taughtSessions.push({
            batch: b.name,
            group: b.group,
            subject: r.subject,
            day: r.day,
            time: r.time,
            venue: r.venue,
            role: isMain ? 'Lead Trainer' : 'Support Trainer',
          });
        }
      });
    });

    if (taughtSessions.length > 0) {
      res += `**Assigned Sessions:**\n`;
      taughtSessions.forEach((s, idx) => {
        res += `${idx + 1}. **${s.subject}** for **${s.batch}** (${s.group})\n   📅 ${s.day} · ⏰ ${s.time} ${s.venue ? `· 🏛️ ${s.venue}` : ''} *(${s.role})*\n`;
      });
    } else {
      res += `*No active training sessions currently assigned to this trainer.*`;
    }

    return res;
  }

  // Check general trainer listing / who is teaching
  if (hasAny(nq, 'trainers', 'trainer list', 'who are the trainers', 'all trainers', 'faculty', 'teachers', 'mentors')) {
    let res = `👨‍🏫 **Registered Trainers (${trainers.length} Total):**\n\n`;
    trainers.forEach((t, idx) => {
      res += `${idx + 1}. **${t.name}** — ${t.totalTrainings || 0} sessions/week ${t.email ? `(${t.email})` : ''}\n`;
    });
    res += `\n*Ask me about any specific trainer to see their full schedule or free slots!*`;
    return res;
  }

  // ── 6. BATCH SCHEDULE & INFORMATION ──────────────────────────────
  const matchedBatch = batches.find(b => {
    const bn = norm(b.name);
    return nq.includes(bn) || (bn.length > 3 && new RegExp(`\\b${bn}\\b`, 'i').test(nq));
  });

  if (matchedBatch) {
    let res = `🎓 **Batch Details: ${matchedBatch.name}**\n\n`;
    res += `- **Year Band:** ${matchedBatch.group}\n`;
    if (matchedBatch.dept) res += `- **Department:** ${matchedBatch.dept}\n`;
    if (matchedBatch.count) res += `- **Student Strength:** ${matchedBatch.count} students\n`;
    if (matchedBatch.venues && matchedBatch.venues.length) {
      res += `- **Assigned Hall(s):** ${matchedBatch.venues.join(', ')}\n`;
    }
    res += `\n**Weekly Timetable (${(matchedBatch.rows || []).length} sessions):**\n`;

    if (!matchedBatch.rows || matchedBatch.rows.length === 0) {
      res += `*No sessions configured yet for this batch.*`;
    } else {
      let filteredRows = matchedBatch.rows;
      if (targetDay) {
        filteredRows = matchedBatch.rows.filter(r => r.day.toLowerCase().includes(targetDay.toLowerCase()));
      }

      if (filteredRows.length === 0 && targetDay) {
        res += `\n*No classes scheduled for ${matchedBatch.name} on ${targetDay}.*\n`;
      } else {
        filteredRows.forEach((r, idx) => {
          res += `\n**${idx + 1}. ${r.subject}**\n`;
          res += `   📅 **Day:** ${r.day} (${r.time})\n`;
          res += `   🏛️ **Venue:** ${r.venue || 'To be assigned'}\n`;
          res += `   👨‍🏫 **Trainer:** ${r.trainer} ${r.support && r.support !== '—' ? `*(Support: ${r.support})*` : ''}\n`;
        });
      }
    }
    return res;
  }

  // Check general batch listing
  if (hasAny(nq, 'batches', 'batch list', 'all batches', 'classes', 'show batches')) {
    let res = `🎓 **Current Active Batches (${batches.length} Total):**\n\n`;
    groups.forEach(g => {
      res += `**📂 ${g.group} (${g.batches.length} batches):**\n`;
      g.batches.forEach((b, i) => {
        res += `  ${i + 1}. **${b.name}** ${b.dept ? `[${b.dept}]` : ''} · ${(b.rows || []).length} sessions ${b.venues?.length ? `(@ ${b.venues.join(', ')})` : ''}\n`;
      });
      res += `\n`;
    });
    return res;
  }

  // ── 7. VENUE / HALL OCCUPANCY & AVAILABILITY ──────────────────────
  const matchedVenue = venues.find(v => {
    const vn = norm(v.name);
    return nq.includes(vn) || (vn.length >= 3 && new RegExp(`\\b${vn}\\b`, 'i').test(nq));
  });

  if (matchedVenue) {
    let res = `🏛️ **Training Venue: ${matchedVenue.name}**\n\n`;
    if (matchedVenue.capacity) res += `👥 **Capacity:** ${matchedVenue.capacity} seats\n\n`;

    // Check which batches meet here
    const venueSessions = [];
    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        if (r.venue === matchedVenue.name) {
          venueSessions.push({
            batch: b.name,
            group: b.group,
            subject: r.subject,
            day: r.day,
            time: r.time,
            trainer: r.trainer,
          });
        }
      });
    });

    if (venueSessions.length === 0) {
      res += `🟢 *This hall is currently completely free throughout the week with no assigned classes.*`;
    } else {
      res += `**Scheduled Classes (${venueSessions.length}):**\n`;
      venueSessions.forEach((s, idx) => {
        res += `${idx + 1}. **${s.subject}** (${s.batch} · ${s.group})\n   📅 ${s.day} · ⏰ ${s.time} · 👨‍🏫 ${s.trainer}\n`;
      });
    }

    return res;
  }

  // Check which halls are free
  if (hasAny(nq, 'free hall', 'free halls', 'free venue', 'free venues', 'empty room', 'available hall', 'available room')) {
    const d = targetDay || days[0];
    let res = `🏢 **Hall Availability for ${d}:**\n\n`;

    venues.forEach(v => {
      const freeSlots = v.free?.[d] || [];
      const totalOccupied = slots.length - freeSlots.length - 1; // minus lunch
      if (freeSlots.length === slots.length - 1) {
        res += `- 🟢 **${v.name}**: Fully Free all day (${v.capacity || 60} capacity)\n`;
      } else if (freeSlots.length > 0) {
        res += `- 🟡 **${v.name}**: Free during ${freeSlots.length} periods\n`;
      } else {
        res += `- 🔴 **${v.name}**: Fully Booked\n`;
      }
    });

    res += `\n*Ask me about a specific hall name to view its exact period timetable!*`;
    return res;
  }

  if (hasAny(nq, 'venues', 'halls', 'all venues', 'all halls', 'rooms', 'seminar hall')) {
    let res = `🏛️ **Registered Training Halls (${venues.length} Total):**\n\n`;
    venues.forEach((v, idx) => {
      res += `${idx + 1}. **${v.name}** ${v.capacity ? `(${v.capacity} seats)` : ''}\n`;
    });
    return res;
  }

  // ── 8. DAY-WISE SCHEDULE / TIMETABLE QUERY ────────────────────────
  if (targetDay || hasAny(nq, 'today schedule', 'monday schedule', 'timetable', 'day wise', 'daily schedule')) {
    const d = targetDay || 'Monday';
    const daySessions = [];

    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        if (r.day.toLowerCase().includes(d.toLowerCase())) {
          daySessions.push({
            batch: b.name,
            group: b.group,
            subject: r.subject,
            time: r.time,
            slot: r.slot,
            venue: r.venue,
            trainer: r.trainer,
            support: r.support,
          });
        }
      });
    });

    if (daySessions.length === 0) {
      return `📅 **Schedule for ${d}:**\n\nNo classes are scheduled on this day across the college.`;
    }

    let res = `📅 **Master Schedule for ${d} (${daySessions.length} Active Sessions):**\n\n`;
    daySessions.forEach((s, idx) => {
      res += `${idx + 1}. **${s.subject}** — **${s.batch}** (${s.group})\n`;
      res += `   ⏰ **Time:** ${s.time} (Slot ${s.slot})\n`;
      res += `   🏛️ **Venue:** ${s.venue || 'TBA'} · 👨‍🏫 **Trainer:** ${s.trainer}\n\n`;
    });
    return res;
  }

  // ── 9. SUBJECT SEARCH ─────────────────────────────────────────────
  // Extract all subjects in database
  const allSubjects = new Set();
  batches.forEach(b => (b.rows || []).forEach(r => { if (r.subject) allSubjects.add(r.subject); }));

  const matchedSubject = Array.from(allSubjects).find(s => norm(s).includes(nq) || nq.includes(norm(s)));
  if (matchedSubject) {
    const subjectSessions = [];
    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        if (r.subject.toLowerCase() === matchedSubject.toLowerCase()) {
          subjectSessions.push({
            batch: b.name,
            group: b.group,
            day: r.day,
            time: r.time,
            venue: r.venue,
            trainer: r.trainer,
          });
        }
      });
    });

    let res = `📚 **Subject: ${matchedSubject}** (${subjectSessions.length} sessions found)\n\n`;
    subjectSessions.forEach((s, idx) => {
      res += `${idx + 1}. **${s.batch}** (${s.group})\n   📅 ${s.day} (${s.time}) · 🏛️ ${s.venue || 'TBA'} · 👨‍🏫 ${s.trainer}\n`;
    });
    return res;
  }

  // ── 10. YEAR GROUPS ───────────────────────────────────────────────
  if (hasAny(nq, 'year group', 'year groups', 'final year', 'third year', 'second year', 'first year')) {
    let res = `🏫 **Year Groups & Batches:**\n\n`;
    groups.forEach(g => {
      res += `**• ${g.group}** (${g.batches.length} batches):\n`;
      g.batches.forEach(b => {
        res += `   - **${b.name}** ${b.dept ? `[${b.dept}]` : ''} · ${(b.rows || []).length} sessions\n`;
      });
      res += `\n`;
    });

    if (upcoming.length > 0) {
      res += `**⏳ Awaiting Schedule:**\n`;
      upcoming.forEach(u => {
        res += `• **${u.group}**: *${u.note || 'Schedule under finalisation.'}*\n`;
      });
    }
    return res;
  }

  // ── 11. SMART REASONING & FALLBACK ────────────────────────────────
  return `I searched the live schedule database for **"${q}"**, but couldn't find an exact match.\n\n**Here are quick questions you can ask me:**\n- 👨‍🏫 **Trainer timetable:** *"What is Abhishek's schedule?"* or *"Who teaches Java?"*\n- 🎓 **Batch classes:** *"Show Batch 1 timetable"* or *"Where is Final Year class?"*\n- 🏢 **Room occupancy:** *"Which halls are free on Wednesday?"*\n- 📅 **Day timetable:** *"Show Monday schedule"* or *"When is lunch break?"*\n- 📊 **Overview:** *"Show overall schedule summary"*`;
}
