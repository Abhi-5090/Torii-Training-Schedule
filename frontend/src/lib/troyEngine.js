/**
 * Troy AI Intelligence & Schedule Reasoning Engine
 * Accurately answers trainer, batch, venue, day, and time queries
 * directly from live database schedule data.
 */

// Normalize string and strip punctuation
function norm(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ');
}

// Strip common honorifics and filler words
function cleanQuery(str) {
  let q = norm(str);
  // Strip honorifics
  q = q.replace(/\b(sir|madam|mam|maam|miss|mr|mrs|dr|prof|professor|mentor|trainer|teacher|faculty)\b/g, ' ');
  // Strip common query fillers
  q = q.replace(/\b(please|can you|tell me|what is|whats|show me|give me|check|find|who is|where is|when is|schedule of|timetable of|schedule for|timetable for|details of|classes of|class of|on|at|in|the)\b/g, ' ');
  return q.replace(/\s+/g, ' ').trim();
}

// Find day mentioned in user query with typo tolerance
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

  if (/\b(today|todays)\b/i.test(nq)) {
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
      const regex = new RegExp(`\\b${pat}\\b`, 'i');
      if (regex.test(nq)) {
        const found = days.find(x => x.toLowerCase() === d.standard.toLowerCase());
        return found || d.standard;
      }
    }
  }

  return null;
}

// Extract slot/period from query
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

// Helper to check keyword presence
function hasAny(q, ...keywords) {
  const nq = norm(q);
  return keywords.some(k => {
    const nk = norm(k);
    if (!nk) return false;
    const regex = new RegExp(`\\b${nk}\\b`, 'i');
    return regex.test(nq) || nq.includes(nk);
  });
}

/**
 * Answer any schedule query accurately
 */
export function answerScheduleQuery(userQuery, scheduleData) {
  if (!scheduleData) {
    return "I'm currently connecting to the master timetable database. Please ask me again in a moment!";
  }

  const rawQ = String(userQuery || '').trim();
  if (!rawQ) {
    return "How can I help you today? You can ask me about any trainer, batch, hall, subject, or daily timetable!";
  }

  // Support both top-level and config-nested properties
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

  // ── 1. GREETINGS & WHO ARE YOU ────────────────────────────────────
  if (/^(hi|hello|hey|greetings|hola|namaste|yo|good\s*(morning|afternoon|evening))\b/i.test(nq)) {
    return `Hello! 👋 I'm **Troy**, your AI schedule assistant for **Torii Training Management**.\n\nI'm trained live on our complete database containing **${batches.length} batches**, **${trainers.length} trainers**, and **${venues.length} training halls**.\n\n**Quick things you can ask me:**\n- 👨‍🏫 *"What is Sudhir's Friday schedule?"* or *"Who teaches Python?"*\n- 🎓 *"When is Batch 1 class on Tuesday?"*\n- 🏢 *"Which halls are free right now?"*\n- 📅 *"Show Monday timetable"* or *"When is lunch break?"*\n- 📊 *"Show overall schedule summary"*`;
  }

  if (hasAny(nq, 'who are you', 'what are you', 'your name', 'about you', 'who is troy')) {
    return `I am **Troy**, the intelligent assistant for the **Torii Training Schedule Board** at NCET.\n\nI monitor the live database to provide real-time, accurate answers on:\n- 📅 **Batch timetables & halls**\n- 👨‍🏫 **Trainer schedules & free periods**\n- 🏛️ **Venue & hall occupancy**\n- ⏰ **Class timings & lunch breaks**\n\nAsk me anything!`;
  }

  // ── 2. LUNCH BREAK & TIME SLOTS ───────────────────────────────────
  if (hasAny(nq, 'lunch', 'lunch break', 'recess', 'interval', 'break time')) {
    const lunchSlotName = slots[lunchIndex] || '11:50 – 12:40';
    return `🍽️ **Lunch Break Details:**\n\n- **Period:** Slot ${lunchIndex + 1} (\`${lunchSlotName}\`)\n- **Description:** Campus-wide training break for all trainers and students.\n\n*(Sessions scheduled before lunch resume in Slot ${lunchIndex + 2} at the regular start time).*`;
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

  // ── 3. SCHEDULE CONFLICTS ─────────────────────────────────────────
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

  // ── 4. OVERALL STATS & SUMMARY ───────────────────────────────────
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

  // ── 5. TRAINER SCHEDULE & AVAILABILITY (HIGH PRIORITY) ─────────────
  const queryTokens = nq.split(' ').filter(w => w.length >= 2);
  const cleanedTokens = cq.split(' ').filter(w => w.length >= 2);

  const matchedTrainer = trainers.find(t => {
    const tn = norm(t.name);
    const parts = tn.split(' ');
    // Exact name in query
    if (nq.includes(tn) || cq.includes(tn)) return true;
    // Any distinct name part matches a token
    return parts.some(p => p.length >= 3 && (queryTokens.includes(p) || cleanedTokens.includes(p)));
  });

  if (matchedTrainer) {
    // 1) Querying Trainer for a specific DAY (e.g. "sudhir sir friday schedule")
    if (targetDay) {
      const d = targetDay;
      const gridDay = matchedTrainer.grid?.[d] || [];
      const rolesDay = matchedTrainer.roles?.[d] || [];
      const venuesDay = matchedTrainer.venues?.[d] || [];

      // If querying specific slot
      if (targetSlot) {
        const slotVal = gridDay[targetSlot.index];
        const roleVal = rolesDay[targetSlot.index];
        const hallVal = venuesDay[targetSlot.index];

        if (!slotVal || slotVal === 'Lunch Break' || slotVal === 'Free') {
          return `🟢 **${matchedTrainer.name} is FREE on ${d} at Slot ${targetSlot.number} (${targetSlot.label})**.\n\nNo training session is booked for this period.`;
        }
        return `🔴 **${matchedTrainer.name} is BUSY on ${d} at Slot ${targetSlot.number} (${targetSlot.label})**:\n\n- **Batch/Task:** **${slotVal}**\n- **Role:** ${roleVal === 'main' ? 'Lead Trainer' : roleVal === 'support' ? 'Support Trainer' : 'Assigned'}\n${hallVal ? `- **Venue:** *${hallVal}*` : ''}`;
      }

      // Find all batch sessions on that day taught by this trainer
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

        // Add lunch break timing
        const lunchSlot = slots[lunchIndex] || '11:50 – 12:40';
        dayRes += `🍱 *Lunch Break:* Slot ${lunchIndex + 1} (\`${lunchSlot}\`)\n`;

        // Free slots count
        const freeSlots = matchedTrainer.free?.[d] || [];
        if (freeSlots.length > 0) {
          dayRes += `🟢 *Free Periods:* ${freeSlots.length} slot(s) available on this day.`;
        }
      } else {
        // Fallback check on grid
        let hasGridClass = false;
        slots.forEach((s, idx) => {
          const item = gridDay[idx];
          if (item && item !== 'Lunch Break') {
            hasGridClass = true;
            dayRes += `- **Slot ${idx + 1} (${s}):** **${item}** (${rolesDay[idx] || 'assigned'})${venuesDay[idx] ? ` @ *${venuesDay[idx]}*` : ''}\n`;
          }
        });

        if (!hasGridClass) {
          dayRes += `🟢 *${matchedTrainer.name} has no scheduled classes on ${d} and is fully free for appointments, preparations, or student mentoring.*`;
        }
      }

      return dayRes;
    }

    // 2) Full Trainer Weekly Profile & Timetable
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

  // Check general trainer listing
  if (hasAny(nq, 'trainers', 'trainer list', 'who are the trainers', 'all trainers', 'faculty', 'teachers', 'mentors', 'show trainers')) {
    let res = `👨‍🏫 **Registered Trainers (${trainers.length} Total):**\n\n`;
    trainers.forEach((t, idx) => {
      res += `${idx + 1}. **${t.name}** — ${t.totalTrainings || 0} sessions/week ${t.email ? `(${t.email})` : ''}\n`;
    });
    res += `\n*Ask me about any trainer (e.g. "Sudhir's Friday schedule") to see their exact periods!*`;
    return res;
  }

  // ── 6. BATCH SCHEDULE & INFORMATION (HIGH PRIORITY) ───────────────
  const genericBatchWords = new Set(['batch', 'batches', 'class', 'classes', 'year', 'group', 'the', 'a', 'all']);
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

  // Check general batch listing
  if (hasAny(nq, 'batches', 'batch list', 'all batches', 'classes', 'show batches', 'list batches')) {
    let res = `🎓 **Active Batches (${batches.length} Total):**\n\n`;
    groups.forEach(g => {
      res += `**📂 ${g.group} (${g.batches.length} batches):**\n`;
      g.batches.forEach((b, i) => {
        res += `  ${i + 1}. **${b.name}** ${b.dept ? `[${b.dept}]` : ''} · ${(b.rows || []).length} sessions ${b.venues?.length ? `(@ ${b.venues.join(', ')})` : ''}\n`;
      });
      res += `\n`;
    });
    return res;
  }

  // ── 7. SUBJECT SEARCH (HIGH PRIORITY) ─────────────────────────────
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

  // ── 8. VENUE / HALL OCCUPANCY & AVAILABILITY ──────────────────────
  // Check which halls are free query first
  if (hasAny(nq, 'free hall', 'free halls', 'free venue', 'free venues', 'empty room', 'available hall', 'available room', 'free rooms', 'which halls are free', 'which rooms are free')) {
    const d = targetDay || days[0];
    let res = `🏢 **Hall Availability for ${d}:**\n\n`;

    venues.forEach(v => {
      const freeSlots = v.free?.[d] || [];
      if (freeSlots.length >= slots.length - 1) {
        res += `- 🟢 **${v.name}**: Fully Free all day (${v.capacity || 60} seats)\n`;
      } else if (freeSlots.length > 0) {
        res += `- 🟡 **${v.name}**: Free during ${freeSlots.length} periods\n`;
      } else {
        res += `- 🔴 **${v.name}**: Fully Occupied\n`;
      }
    });

    res += `\n*Ask me about a specific hall name to view its exact schedule!*`;
    return res;
  }

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

  if (hasAny(nq, 'venues', 'halls', 'all venues', 'all halls', 'rooms', 'seminar hall', 'show halls', 'list halls')) {
    let res = `🏛️ **Registered Training Halls (${venues.length} Total):**\n\n`;
    venues.forEach((v, idx) => {
      res += `${idx + 1}. **${v.name}** ${v.capacity ? `(${v.capacity} seats)` : ''}\n`;
    });
    return res;
  }

  // ── 9. DAY-WISE SCHEDULE / TIMETABLE QUERY ────────────────────────
  if (targetDay) {
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
  return `I searched the live schedule database for **"${rawQ}"**, but couldn't find an exact match.\n\n**Try asking:**\n- 👨‍🏫 **Trainer schedule:** *"What is Sudhir's Friday schedule?"* or *"Who is teaching Python?"*\n- 🎓 **Batch schedule:** *"Show Batch-1 timetable"* or *"Where is Final Year class?"*\n- 🏢 **Halls:** *"Which halls are free on Wednesday?"*\n- 📅 **Day timetable:** *"Show Monday timetable"* or *"When is lunch break?"*\n- 📊 **Summary:** *"Show overall schedule summary"*`;
}
