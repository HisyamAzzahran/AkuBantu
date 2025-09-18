export function Card({ children, className }) {
  return <div className={`card shadow ${className}`}>{children}</div>;
}

export function CardContent({ children }) {
  return <div className="card-body">{children}</div>;
}
