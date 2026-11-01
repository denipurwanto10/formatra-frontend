export default function Skeleton({ className = "", ...props }) {
  return <span aria-hidden="true" className={`skeleton block rounded-lg ${className}`} {...props} />;
}
