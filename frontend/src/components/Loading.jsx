/* The skeleton + spinner the original board showed while a view settled. */
export default function Loading({ msg, n = 3 }) {
  return (
    <div className="loading">
      <div className="spin-wrap">
        <div className="ldr" />
        <span className="msg">{msg}</span>
      </div>
      <div className="sk-wrap">
        {Array.from({ length: n }, (_, i) => (
          <div className="sk" key={i}>
            <b />{[0, 1, 2, 3, 4].map(j => <i key={j} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
