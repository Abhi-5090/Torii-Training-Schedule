import { ClockIcon } from './Icons.jsx';

export default function SoonCard({ group, note }) {
  return (
    <div className="soon-card rv">
      <div className="sc-ico"><ClockIcon /></div>
      <div className="sc-txt">
        <h3>{group} · Schedule in preparation</h3>
        <p>{note}</p>
      </div>
      <span className="soon-pill"><span className="dot" />Will be updated soon</span>
    </div>
  );
}
