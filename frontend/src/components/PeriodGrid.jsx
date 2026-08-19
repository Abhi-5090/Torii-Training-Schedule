const DAY_SHORT = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
  Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN',
};

export const dayShort = d => DAY_SHORT[d] || d.slice(0, 3).toUpperCase();

/* The lunch slot carries the placeholder "Lunch Break" wherever no class was
   booked over it. Only a real batch name counts as a class — First Year's
   slot 3–4 sessions legitimately run through 11:50–12:50. */
const isClass = v => !!v && !/^lunch\b/i.test(v.trim());

/*
 * The 8 × 5 timetable shown on every trainer and hall card. `entity` is one
 * of the derived trainer/venue views: { grid, roles? }.
 */
export default function PeriodGrid({ entity, slots, days, lunchIndex }) {
  return (
    <div className="tt-scroll">
      <div className="ttgrid" style={{ '--daycols': days.length }}>
        <div />
        {days.map(d => <div className="tt-dh" key={d}>{dayShort(d)}</div>)}

        {slots.map((label, i) => (
          <Row key={i} i={i} label={label} entity={entity} days={days} lunchIndex={lunchIndex} />
        ))}
      </div>
    </div>
  );
}

function Row({ i, label, entity, days, lunchIndex }) {
  return (
    <>
      <div className="tt-time">{label}</div>
      {days.map(d => {
        const v = entity.grid[d]?.[i] || '';
        const role = entity.roles ? entity.roles[d]?.[i] || '' : '';

        if (i === lunchIndex && !isClass(v)) return <div className="cell lunch" key={d}>Lunch</div>;
        if (!v) return <div className="cell free" key={d}>Free</div>;
        if (role === 'support') {
          return (
            <div className="cell occ support" key={d} title={`${v} — Support mentor`}>
              {v}<span className="rl">SUPPORT</span>
            </div>
          );
        }
        return (
          <div className="cell occ" key={d} title={role ? `${v} — Main mentor` : v}>
            {v}{role && <span className="rl">MAIN</span>}
          </div>
        );
      })}
    </>
  );
}

export function Counts({ entity }) {
  const split = entity.mainCount !== undefined ? (
    <>
      <div className="count occ"><span className="big">{entity.mainCount}</span><small>Main</small></div>
      <div className="count supp"><span className="big">{entity.supportCount}</span><small>Support</small></div>
    </>
  ) : (
    <div className="count occ"><span className="big">{entity.totalBusy}</span><small>Occupied</small></div>
  );

  return (
    <div className="counts">
      <div className="count free"><span className="big">{entity.totalFree}</span><small>Free</small></div>
      {split}
    </div>
  );
}

/* "Free all day" means every period except lunch is open. */
export function freeAllDay(entity, days, slotCount) {
  return days.filter(d => (entity.free[d] || []).length === slotCount - 1);
}
