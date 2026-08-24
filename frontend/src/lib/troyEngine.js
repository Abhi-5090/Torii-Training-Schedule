/**
 * Troy RAG AI Schedule Assistant
 * Combines structured schedule graph querying, intent classification,
 * and semantic retrieval (RAG) over all master database facts.
 */

// ── Text Normalization & Cleaning ──
function norm(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ');
}

function cleanQuery(str) {
  let q = norm(str);
  q = q.replace(/\b(sir|madam|mam|maam|miss|mr|mrs|dr|prof|professor|mentor|trainer|teacher|faculty)\b/g, ' ');
  q = q.replace(/\b(please|can you|tell me|what is|whats|show me|give me|check|find|who is|where is|when is|schedule of|timetable of|schedule for|timetable for|details of|classes of|class of|on|at|in|the)\b/g, ' ');
  return q.replace(/\s+/g, ' ').trim();
}

function hasAny(q, ...keywords) {
  const nq = norm(q);
  return keywords.some(k => {
    const nk = norm(k);
    if (!nk) return false;
    const regex = new RegExp(`\\b${nk}\\b`, 'i');
    return regex.test(nq) || nq.includes(nk);
  });
}

// ── Temporal Extractors ──
function extractDay(q, days = []) {
  const nq = norm(q);
  const dayMap = [
    { patterns: ['monday', 'mon', 'mondy', 'mnday'], standard: 'Monday' },
    { patterns: ['tuesday', 'tue', 'tues', 'tuseday', 'tusday'], standard: 'Tuesday' },
    { patterns: ['wednesday', 'wed', 'wednes', 'wensday', 'wendsday', 'wedday'], standard: 'Wednesday' },
    { patterns: ['thursday', 'thu', 'thur', 'thurs', 'thrusday', 'thruday'], standard: 'Thursday' },
    { patterns: ['friday', 'fri', 'firday', 'fridy', 'frday'], standard: 'Friday' },
    { patterns: ['saturday', 'sat', 'satur', 'saterday'], standard: 'Saturday' },
    { patterns: ['sunday', 'sun', 'sundy'], standard: 'Sunday' },
  ];

  if (/\b(today|todays|now|right now|currently)\b/i.test(nq)) {
    const jsDay = new Date().getDay(); // 0 = Sun, 1 = Mon...
    const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const current = map[jsDay];
    if (days.includes(current)) return current;
    return days[0] || 'Monday';
  }

  if (/\b(tomorrow|tomorrows)\b/i.test(nq)) {
    const jsDay = (new Date().getDay() + 1) % 7;
    const map = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const tomorrow = map[jsDay];
    if (days.includes(tomorrow)) return tomorrow;
    return days[0] || 'Monday';
  }

  for (const d of dayMap) {
    for (const pat of d.patterns) {
      if (new RegExp(`\\b${pat}\\b`, 'i').test(nq)) {
        const found = days.find(x => x.toLowerCase() === d.standard.toLowerCase());
        return found || d.standard;
      }
    }
  }

  return null;
}

function extractSlot(q, slots = []) {
  const nq = norm(q);
  const match = nq.match(/\b(slot|period|hour|session|p)\s*([0-9]+)\b/i);
  if (match) {
    const num = parseInt(match[2], 10);
    if (!isNaN(num) && num >= 1 && num <= slots.length) {
      return { index: num - 1, number: num, label: slots[num - 1] || `Period ${num}` };
    }
  }
  return null;
}

// ── RAG Knowledge Index Builder ──
function buildKnowledgeBase(scheduleData) {
  const { slots = [], days = [], batches = [], trainers = [], venues = [], groups = [] } = scheduleData;
  const facts = [];

  // Batch Session Facts
  batches.forEach(b => {
    (b.rows || []).forEach(r => {
      facts.push({
        type: 'session',
        entity: b.name,
        group: b.group,
        dept: b.dept,
        day: r.day,
        time: r.time,
        slot: r.slot,
        subject: r.subject,
        venue: r.venue,
        trainers: r.trainer,
        mainTrainers: r.mainList || [],
        supportTrainers: r.supportList || [],
        text: `Batch ${b.name} (${b.group}${b.dept ? ` · ${b.dept}` : ''}) has ${r.subject} on ${r.day} from ${r.time} (Slot ${r.slot}) in ${r.venue || 'TBA'} taught by ${r.trainer}${r.support && r.support !== '—' ? ` (Support: ${r.support})` : ''}.`,
      });
    });
  });

  // Trainer Facts
  trainers.forEach(t => {
    facts.push({
      type: 'trainer',
      entity: t.name,
      email: t.email,
      phone: t.phone,
      totalTrainings: t.totalTrainings || 0,
      mainCount: t.mainCount || 0,
      supportCount: t.supportCount || 0,
      text: `Trainer ${t.name} is scheduled for ${t.totalTrainings || 0} training sessions per week (Lead: ${t.mainCount || 0}, Support: ${t.supportCount || 0})${t.email ? ` with email ${t.email}` : ''}.`,
    });
  });

  // Venue Facts
  venues.forEach(v => {
    facts.push({
      type: 'venue',
      entity: v.name,
      capacity: v.capacity || 0,
      text: `Training venue ${v.name} has a seating capacity of ${v.capacity || 60} seats.`,
    });
  });

  return facts;
}

/**
 * Main Troy RAG Question Answering System
 */
export function answerScheduleQuery(userQuery, scheduleData) {
  if (!scheduleData) {
    return "I'm currently connecting to the master timetable database. Please ask me again in a moment!";
  }

  const rawQ = String(userQuery || '').trim();
  if (!rawQ) {
    return "How can I help you today? You can ask me about any trainer, batch, hall, subject, or daily timetable!";
  }

  const slots = scheduleData.slots || scheduleData.config?.slots || [];
  const days = scheduleData.days || scheduleData.config?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const lunchIndex = scheduleData.lunchIndex !== undefined ? scheduleData.lunchIndex : (scheduleData.config?.lunchIndex ?? 3);

  const trainers = scheduleData.trainers || [];
  const venues = scheduleData.venues || [];
  const batches = scheduleData.batches || [];
  const groups = scheduleData.groups || [];
  const upcoming = scheduleData.upcoming || [];
  const conflicts = scheduleData.conflicts || [];

  const nq = norm(rawQ);
  const cq = cleanQuery(rawQ);
  const targetDay = extractDay(rawQ, days);
  const targetSlot = extractSlot(rawQ, slots);

  // ── 1. GREETINGS & SELF IDENTIFICATION ──
  if (/^(hi|hello|hey|greetings|hola|namaste|yo|good\s*(morning|afternoon|evening))\b/i.test(nq)) {
    return `Hello! 👋 I'm **Troy**, your AI schedule assistant for **Torii Training Management**.\n\nI'm trained live on our complete database containing **${batches.length} batches**, **${trainers.length} trainers**, and **${venues.length} training halls**.\n\n**Quick questions you can ask me:**\n- 🟢 *"Who is free today?"* or *"Who is free on Friday slot 2?"*\n- 👨‍🏫 *"What is Sudhir's Friday schedule?"* or *"Who teaches Python?"*\n- 🎓 *"When is Batch 1 class on Monday?"*\n- 🏢 *"Which halls are free right now?"*\n- 📅 *"Show Monday timetable"* or *"When is lunch break?"*`;
  }

  if (hasAny(nq, 'who are you', 'what are you', 'your name', 'about you', 'who is troy')) {
    return `I am **Troy**, the AI schedule assistant for the **Torii Training Management Board** at NCET.\n\nI continuously monitor the master schedule database to provide instant, 100% accurate information on:\n- 🟢 **Trainer availability & free hours**\n- 📅 **Batch timetables & halls**\n- 👨‍🏫 **Trainer assignments & workloads**\n- 🏛️ **Venue & hall occupancy**\n- ⏰ **Live daily periods & break timings**`;
  }

  // ── 2. TRAINER AVAILABILITY & FREE TIME (INTENT: FREE_TRAINERS) ──
  const isFreeTrainersQuery =
    hasAny(nq, 'who is free', 'who are free', 'who has no class', 'who is available', 'which trainers are free', 'which trainer is free', 'free trainers', 'available trainers', 'anyone free', 'is anyone free', 'free staff', 'free faculty') &&
    !hasAny(nq, 'free hall', 'free halls', 'free venue', 'free venues', 'free room', 'free rooms');

  if (isFreeTrainersQuery) {
    const d = targetDay || days[0];

    // Case A: Free at a specific SLOT (e.g. "Who is free today in slot 2?")
    if (targetSlot) {
      const freeAtSlot = [];
      const busyAtSlot = [];

      trainers.forEach(t => {
        const item = t.grid?.[d]?.[targetSlot.index];
        if (!item || item === 'Lunch Break' || item === 'Free') {
          freeAtSlot.push(t.name);
        } else {
          busyAtSlot.push({ name: t.name, task: item });
        }
      });

      let res = `🟢 **Trainer Availability on ${d} at Slot ${targetSlot.number} (${targetSlot.label}):**\n\n`;
      if (freeAtSlot.length > 0) {
        res += `**Available Trainers (${freeAtSlot.length}):**\n`;
        freeAtSlot.forEach((name, i) => {
          res += `${i + 1}. **${name}** 🟢\n`;
        });
      } else {
        res += `*All trainers have classes scheduled during this period.*\n`;
      }

      if (busyAtSlot.length > 0) {
        res += `\n**Busy Trainers (${busyAtSlot.length}):**\n`;
        busyAtSlot.forEach((b, i) => {
          res += `${i + 1}. **${b.name}** — *${b.task}*\n`;
        });
      }
      return res;
    }

    // Case B: General Free Trainers for the Day (e.g. "Who is free today?")
    const fullyFree = [];
    const partiallyFree = [];

    trainers.forEach(t => {
      const dayGrid = t.grid?.[d] || [];
      const busyPeriods = [];
      const freePeriods = [];

      slots.forEach((s, idx) => {
        if (idx === lunchIndex) return; // Skip lunch
        const item = dayGrid[idx];
        if (item && item !== 'Lunch Break' && item !== 'Free') {
          busyPeriods.push({ slot: idx + 1, time: s, task: item });
        } else {
          freePeriods.push({ slot: idx + 1, time: s });
        }
      });

      if (busyPeriods.length === 0) {
        fullyFree.push(t);
      } else if (freePeriods.length > 0) {
        partiallyFree.push({ trainer: t, freePeriods, busyPeriods });
      }
    });

    let res = `🟢 **Trainer Availability for ${d}:**\n\n`;

    if (fullyFree.length > 0) {
      res += `**Fully Free All Day (No Classes):**\n`;
      fullyFree.forEach((t, i) => {
        res += `${i + 1}. **${t.name}** 🟢 ${t.email ? `*(${t.email})*` : ''}\n`;
      });
      res += `\n`;
    }

    if (partiallyFree.length > 0) {
      res += `**Partially Free (Available during specific periods):**\n`;
      partiallyFree.forEach(({ trainer, freePeriods }) => {
        const slotNumbers = freePeriods.map(p => `Slot ${p.slot}`).join(', ');
        res += `- **${trainer.name}**: Free during **${slotNumbers}** (${freePeriods.length} periods open)\n`;
      });
    }

    res += `\n*Ask me about any specific slot (e.g. "Who is free at slot 2?") or trainer to view their detailed timeline!*`;
    return res;
  }

  // ── 3. VENUE AVAILABILITY (INTENT: FREE_VENUES) ──
  if (hasAny(nq, 'free hall', 'free halls', 'free venue', 'free venues', 'empty room', 'available hall', 'available room', 'free rooms', 'which halls are free', 'which rooms are free', 'hall availability', 'venue availability')) {
    const d = targetDay || days[0];
    let res = `🏢 **Training Hall Availability for ${d}:**\n\n`;

    venues.forEach(v => {
      const freeSlots = v.free?.[d] || [];
      if (freeSlots.length >= slots.length - 1) {
        res += `- 🟢 **${v.name}**: **Fully Free All Day** (${v.capacity || 60} seats)\n`;
      } else if (freeSlots.length > 0) {
        res += `- 🟡 **${v.name}**: Free during **${freeSlots.length} periods** (${freeSlots.join(', ')})\n`;
      } else {
        res += `- 🔴 **${v.name}**: Fully Booked\n`;
      }
    });

    res += `\n*Ask me about any hall name (e.g. "Examination Block schedule") to see all classes happening there!*`;
    return res;
  }

  // ── 4. LUNCH BREAK & COLLEGE TIMINGS ──
  if (hasAny(nq, 'lunch', 'lunch break', 'recess', 'interval', 'break time')) {
    const lunchSlotName = slots[lunchIndex] || '11:50 – 12:40';
    return `🍽️ **Lunch Break Details:**\n\n- **Period:** Slot ${lunchIndex + 1} (\`${lunchSlotName}\`)\n- **Description:** Campus-wide break for all students, faculty, and trainers.\n\n*(Sessions scheduled before lunch resume in Slot ${lunchIndex + 2} at the regular start time).*`;
  }

  if (hasAny(nq, 'slots', 'periods', 'timings', 'bell schedule', 'what time does slot', 'class hours', 'time table timing')) {
    let res = `⏰ **Master College Period Timings (${slots.length} Slots):**\n\n`;
    slots.forEach((s, idx) => {
      const isLunch = idx === lunchIndex;
      res += `- **Slot ${idx + 1}:** \`${s}\` ${isLunch ? '🍱 *(Lunch Break)*' : ''}\n`;
    });
    res += `\n**Teaching Days:** ${days.join(', ')}`;
    return res;
  }

  // ── 5. SCHEDULE CONFLICTS ──
  if (hasAny(nq, 'conflict', 'conflicts', 'double booking', 'clash', 'overlap')) {
    if (!conflicts || conflicts.length === 0) {
      return `✅ **No Schedule Conflicts!**\n\nAll **${batches.length} batches** and **${trainers.length} trainers** have zero overlapping bookings. Every training hall and period is cleanly allocated.`;
    }
    let res = `⚠️ **Detected ${conflicts.length} Schedule Conflict(s):**\n\n`;
    conflicts.forEach((c, idx) => {
      res += `${idx + 1}. **${c.kind === 'trainer' ? 'Trainer Clash' : 'Hall Clash'}:** \`${c.subject}\` on **${c.day}** (${c.slot}) between **${c.batches.join('** and **')}**\n`;
    });
    return res;
  }

  // ── 6. OVERALL STATS & SUMMARY ──
  if (hasAny(nq, 'stats', 'statistics', 'summary', 'overview', 'how many', 'total count', 'numbers')) {
    const totalStudents = batches.reduce((acc, b) => acc + (Number(b.count) || 0), 0);
    const totalSessions = batches.reduce((acc, b) => acc + (b.rows || []).length, 0);
    const activeTrainers = trainers.filter(t => (t.totalTrainings || 0) > 0).length;

    let res = `📊 **Torii Master Schedule Summary:**\n\n`;
    res += `- **Total Year Groups:** ${groups.length} active ${upcoming.length > 0 ? `(+ ${upcoming.length} upcoming)` : ''}\n`;
    res += `- **Total Batches:** ${batches.length} batches (${totalStudents > 0 ? totalStudents.toLocaleString() + ' students' : 'enrolled'})\n`;
    res += `- **Total Weekly Sessions:** ${totalSessions} class blocks\n`;
    res += `- **Trainers:** ${trainers.length} registered (${activeTrainers} actively assigned)\n`;
    res += `- **Venues/Halls:** ${venues.length} rooms\n`;
    res += `- **Teaching Days:** ${days.length} days (${days.join(', ')})\n\n`;

    if (upcoming.length > 0) {
      res += `⏳ **Awaiting Schedule:** ${upcoming.map(u => `*${u.group}*`).join(', ')}\n`;
    }
    return res;
  }

  // ── 7. SPECIFIC TRAINER SCHEDULE (INTENT: TRAINER_SCHEDULE) ──
  const queryTokens = nq.split(' ').filter(w => w.length >= 2);
  const cleanedTokens = cq.split(' ').filter(w => w.length >= 2);

  const matchedTrainer = trainers.find(t => {
    const tn = norm(t.name);
    const parts = tn.split(' ');
    if (nq.includes(tn) || cq.includes(tn)) return true;
    return parts.some(p => p.length >= 3 && (queryTokens.includes(p) || cleanedTokens.includes(p)));
  });

  if (matchedTrainer) {
    if (targetDay) {
      const d = targetDay;
      const dayClasses = [];
      batches.forEach(b => {
        (b.rows || []).forEach(r => {
          if (r.day.toLowerCase().includes(d.toLowerCase())) {
            const isMain = (r.mainList || []).includes(matchedTrainer.name);
            const isSupport = (r.supportList || []).includes(matchedTrainer.name);
            if (isMain || isSupport) {
              dayClasses.push({
                batch: b.name,
                group: b.group,
                dept: b.dept,
                subject: r.subject,
                time: r.time,
                slot: r.slot,
                venue: r.venue,
                role: isMain ? 'Lead Trainer' : 'Support Trainer',
                mainList: r.mainList || [],
                supportList: r.supportList || [],
              });
            }
          }
        });
      });

      let dayRes = `📋 **${matchedTrainer.name}'s Schedule for ${d}:**\n\n`;

      if (dayClasses.length > 0) {
        dayClasses.forEach((c, idx) => {
          dayRes += `**${idx + 1}. ${c.subject}** — **${c.batch}** (${c.group}${c.dept ? ` · ${c.dept}` : ''})\n`;
          dayRes += `   ⏰ **Time:** ${c.time} (Slot ${c.slot})\n`;
          dayRes += `   🏛️ **Venue:** ${c.venue || 'To be assigned'}\n`;
          dayRes += `   👨‍🏫 **Role:** **${c.role}**`;
          if (c.mainList.length > 1) {
            dayRes += ` *(with ${c.mainList.filter(n => n !== matchedTrainer.name).join(', ')})*`;
          }
          if (c.supportList.length > 0 && !c.supportList.includes(matchedTrainer.name)) {
            dayRes += ` · *Support: ${c.supportList.join(', ')}*`;
          }
          dayRes += `\n\n`;
        });

        const lunchSlot = slots[lunchIndex] || '11:50 – 12:40';
        dayRes += `🍱 *Lunch Break:* Slot ${lunchIndex + 1} (\`${lunchSlot}\`)\n`;

        const freeSlots = matchedTrainer.free?.[d] || [];
        if (freeSlots.length > 0) {
          dayRes += `🟢 *Free Periods:* ${freeSlots.length} slot(s) available on this day.`;
        }
      } else {
        dayRes += `🟢 *${matchedTrainer.name} has no scheduled classes on ${d} and is fully free for appointments, preparations, or student mentoring.*`;
      }

      return dayRes;
    }

    // Weekly Trainer Overview
    let res = `👨‍🏫 **Trainer Profile: ${matchedTrainer.name}**\n\n`;
    if (matchedTrainer.email) res += `📧 **Email:** ${matchedTrainer.email}\n`;
    if (matchedTrainer.phone) res += `📱 **Phone:** ${matchedTrainer.phone}\n`;
    res += `⏱️ **Weekly Workload:** **${matchedTrainer.totalTrainings || 0} active training sessions** (Lead: ${matchedTrainer.mainCount || 0}, Support: ${matchedTrainer.supportCount || 0})\n\n`;

    const allTaught = [];
    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        const isMain = (r.mainList || []).includes(matchedTrainer.name);
        const isSupport = (r.supportList || []).includes(matchedTrainer.name);
        if (isMain || isSupport) {
          allTaught.push({
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

    if (allTaught.length > 0) {
      res += `**Weekly Class Assignments:**\n`;
      allTaught.forEach((s, idx) => {
        res += `${idx + 1}. **${s.subject}** for **${s.batch}** (${s.group})\n   📅 **${s.day}** · ⏰ ${s.time} ${s.venue ? `· 🏛️ *${s.venue}*` : ''} *(${s.role})*\n`;
      });
    } else {
      res += `*No active training sessions currently mapped to this trainer.*`;
    }

    return res;
  }

  // ── 8. SPECIFIC BATCH SCHEDULE (INTENT: BATCH_SCHEDULE) ──
  const genericBatchWords = new Set(['batch', 'batches', 'class', 'classes', 'year', 'group', 'the', 'a', 'all', 'who', 'where', 'when']);
  const matchedBatch = batches.find(b => {
    const bn = norm(b.name);
    if (nq.includes(bn) || cq.includes(bn)) return true;
    const parts = bn.split(' ').filter(w => w.length >= 2 && !genericBatchWords.has(w));
    return parts.length >= 1 && parts.every(p => nq.includes(p) || cq.includes(p));
  });

  if (matchedBatch) {
    let res = `🎓 **Batch: ${matchedBatch.name}** (${matchedBatch.group})\n\n`;
    if (matchedBatch.dept) res += `- **Department:** ${matchedBatch.dept}\n`;
    if (matchedBatch.count) res += `- **Students:** ${matchedBatch.count}\n`;
    if (matchedBatch.venues && matchedBatch.venues.length) {
      res += `- **Assigned Hall(s):** ${matchedBatch.venues.join(', ')}\n`;
    }

    if (targetDay) {
      res += `\n**Schedule for ${targetDay}:**\n`;
      const filteredRows = (matchedBatch.rows || []).filter(r => r.day.toLowerCase().includes(targetDay.toLowerCase()));
      if (filteredRows.length === 0) {
        res += `\n*No classes scheduled for ${matchedBatch.name} on ${targetDay}.*\n`;
      } else {
        filteredRows.forEach((r, idx) => {
          res += `\n**${idx + 1}. ${r.subject}**\n`;
          res += `   ⏰ **Time:** ${r.time} (Slot ${r.slot})\n`;
          res += `   🏛️ **Venue:** ${r.venue || 'To be assigned'}\n`;
          res += `   👨‍🏫 **Trainer:** **${r.trainer}** ${r.support && r.support !== '—' ? `*(Support: ${r.support})*` : ''}\n`;
        });
      }
    } else {
      res += `\n**Weekly Timetable (${(matchedBatch.rows || []).length} sessions):**\n`;
      if (!matchedBatch.rows || matchedBatch.rows.length === 0) {
        res += `*No sessions configured yet for this batch.*`;
      } else {
        matchedBatch.rows.forEach((r, idx) => {
          res += `\n**${idx + 1}. ${r.subject}**\n`;
          res += `   📅 **Day:** ${r.day} (${r.time})\n`;
          res += `   🏛️ **Venue:** ${r.venue || 'To be assigned'}\n`;
          res += `   👨‍🏫 **Trainer:** **${r.trainer}** ${r.support && r.support !== '—' ? `*(Support: ${r.support})*` : ''}\n`;
        });
      }
    }
    return res;
  }

  // ── 9. SUBJECT SEARCH (INTENT: SUBJECT_SEARCH) ──
  const allSubjects = new Set();
  batches.forEach(b => (b.rows || []).forEach(r => { if (r.subject) allSubjects.add(r.subject); }));

  const matchedSubject = Array.from(allSubjects).find(s => {
    const sn = norm(s);
    return nq.includes(sn) || cq.includes(sn) || sn.split(' ').some(part => part.length >= 3 && nq.includes(part));
  });

  if (matchedSubject) {
    let subjectSessions = [];
    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        if (r.subject.toLowerCase() === matchedSubject.toLowerCase()) {
          subjectSessions.push({
            batch: b.name,
            group: b.group,
            dept: b.dept,
            day: r.day,
            time: r.time,
            slot: r.slot,
            venue: r.venue,
            trainer: r.trainer,
            support: r.support,
          });
        }
      });
    });

    if (targetDay) {
      subjectSessions = subjectSessions.filter(s => s.day.toLowerCase().includes(targetDay.toLowerCase()));
    }

    let res = `📚 **Subject: ${matchedSubject}** ${targetDay ? `on **${targetDay}**` : ''} (${subjectSessions.length} sessions found)\n\n`;
    if (subjectSessions.length === 0) {
      res += `*No ${matchedSubject} sessions are scheduled ${targetDay ? `on ${targetDay}` : ''}.*`;
    } else {
      subjectSessions.forEach((s, idx) => {
        res += `${idx + 1}. **${s.batch}** (${s.group}${s.dept ? ` · ${s.dept}` : ''})\n   📅 **${s.day}** · ⏰ ${s.time} (Slot ${s.slot})\n   🏛️ **Venue:** ${s.venue || 'To be assigned'} · 👨‍🏫 **Trainer:** **${s.trainer}** ${s.support && s.support !== '—' ? `*(Support: ${s.support})*` : ''}\n\n`;
      });
    }
    return res;
  }

  // ── 10. SPECIFIC VENUE SEARCH (INTENT: VENUE_SEARCH) ──
  const genericVenueWords = new Set(['hall', 'halls', 'venue', 'venues', 'room', 'rooms', 'block', 'floor', 'training', 'the', 'a', 'an', 'which', 'free', 'available']);
  const matchedVenue = venues.find(v => {
    const vn = norm(v.name);
    if (nq.includes(vn) || cq.includes(vn)) return true;
    const parts = vn.split(' ').filter(w => w.length >= 3 && !genericVenueWords.has(w));
    if (parts.length === 0) return false;
    return parts.every(part => nq.includes(part) || cq.includes(part));
  });

  if (matchedVenue) {
    let res = `🏛️ **Training Venue: ${matchedVenue.name}**\n\n`;
    if (matchedVenue.capacity) res += `👥 **Seating Capacity:** ${matchedVenue.capacity} seats\n\n`;

    let venueSessions = [];
    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        if (r.venue && r.venue.toLowerCase() === matchedVenue.name.toLowerCase()) {
          venueSessions.push({
            batch: b.name,
            group: b.group,
            dept: b.dept,
            subject: r.subject,
            day: r.day,
            time: r.time,
            slot: r.slot,
            trainer: r.trainer,
          });
        }
      });
    });

    if (targetDay) {
      venueSessions = venueSessions.filter(s => s.day.toLowerCase().includes(targetDay.toLowerCase()));
    }

    if (venueSessions.length === 0) {
      res += `🟢 *This hall is unoccupied ${targetDay ? `on ${targetDay}` : 'throughout the week'}.*`;
    } else {
      res += `**Scheduled Classes ${targetDay ? `on ${targetDay}` : ''} (${venueSessions.length}):**\n`;
      venueSessions.forEach((s, idx) => {
        res += `${idx + 1}. **${s.subject}** (${s.batch} · ${s.group})\n   📅 **${s.day}** · ⏰ ${s.time} (Slot ${s.slot}) · 👨‍🏫 **${s.trainer}**\n`;
      });
    }

    return res;
  }

  // ── 11. GENERAL DAY-WISE TIMETABLE (INTENT: DAY_TIMETABLE) ──
  // Triggers ONLY if user explicitly asked for timetable / day schedule or day with no other entity
  if (targetDay && (hasAny(nq, 'schedule', 'timetable', 'classes', 'sessions', 'what is happening', 'what is scheduled', 'day wise') || queryTokens.length <= 2)) {
    const d = targetDay;
    const daySessions = [];

    batches.forEach(b => {
      (b.rows || []).forEach(r => {
        if (r.day.toLowerCase().includes(d.toLowerCase())) {
          daySessions.push({
            batch: b.name,
            group: b.group,
            dept: b.dept,
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
      return `📅 **Schedule for ${d}:**\n\nNo classes are scheduled on this day.`;
    }

    let res = `📅 **Master Schedule for ${d} (${daySessions.length} Active Sessions):**\n\n`;
    daySessions.forEach((s, idx) => {
      res += `${idx + 1}. **${s.subject}** — **${s.batch}** (${s.group}${s.dept ? ` · ${s.dept}` : ''})\n`;
      res += `   ⏰ **Time:** ${s.time} (Slot ${s.slot})\n`;
      res += `   🏛️ **Venue:** ${s.venue || 'TBA'} · 👨‍🏫 **Trainer:** **${s.trainer}**\n\n`;
    });
    return res;
  }

  // ── 12. RAG SEMANTIC RETRIEVAL FALLBACK ──
  const kb = buildKnowledgeBase(scheduleData);
  const searchWords = cq.split(' ').filter(w => w.length >= 3);

  if (searchWords.length > 0) {
    const scoredFacts = kb.map(f => {
      const fText = norm(f.text);
      let score = 0;
      searchWords.forEach(w => {
        if (fText.includes(w)) score += 2;
      });
      return { fact: f, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

    if (scoredFacts.length > 0) {
      const topFacts = scoredFacts.slice(0, 4);
      let res = `🔍 **Here is what I found in the schedule database for "${rawQ}":**\n\n`;
      topFacts.forEach(({ fact }, i) => {
        res += `${i + 1}. ${fact.text}\n\n`;
      });
      return res;
    }
  }

  // ── 13. FALLBACK PROMPT ──
  return `I searched the live schedule database for **"${rawQ}"**, but couldn't find an exact match.\n\n**Try asking:**\n- 🟢 **Availability:** *"Who is free today?"* or *"Who is free at slot 2?"*\n- 👨‍🏫 **Trainer schedule:** *"What is Sudhir's Friday schedule?"* or *"Who teaches Python?"*\n- 🎓 **Batch schedule:** *"Show Batch-1 timetable"* or *"Where is Final Year class?"*\n- 🏢 **Halls:** *"Which halls are free on Wednesday?"*\n- 📅 **Day timetable:** *"Show Monday timetable"* or *"When is lunch break?"*`;
}
