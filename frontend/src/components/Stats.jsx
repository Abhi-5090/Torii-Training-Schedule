export default function Stats({ data }) {
  const students = data.batches.reduce((s, b) => s + (b.count || 0), 0);
  const cells = [
    ['', data.trainers.length, 'Trainers'],
    ['dark', data.batches.length, 'Active Batches'],
    ['', data.venues.length, 'Training Halls'],
    ['dark', students.toLocaleString(), 'Students'],
    ['', data.days.length, 'Teaching Days'],
  ];
  return (
    <div className="stats">
      {cells.map(([c, n, l]) => (
        <div className={`stat ${c}`} key={l}>
          <div className="n">{n}</div><div className="l">{l}</div>
        </div>
      ))}
    </div>
  );
}
