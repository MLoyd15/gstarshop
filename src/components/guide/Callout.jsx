function Callout({ n, children }) {
  return (
    <span className="guide-callout-anchor">
      {children}
      <span className="guide-callout-badge" aria-hidden="true">{n}</span>
    </span>
  );
}

export default Callout;
