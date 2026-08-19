/* The board's inline icons, kept as components so the markup stays readable. */
export const CalendarIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);

export const PersonIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
  </svg>
);

export const BuildingIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" />
  </svg>
);

export const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const ClockIcon = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7.4V12l3 1.8" /></svg>
);

export const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
  </svg>
);

export const LockIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8.2 10.5V7.6a3.8 3.8 0 017.6 0v2.9" />
  </svg>
);
