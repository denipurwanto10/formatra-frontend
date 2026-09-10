import clsx from "clsx";

export default function Card({ className, children, as: Component = "div", ...props }) {
  return (
    <Component
      className={clsx("bg-surface border-hair rounded-xl", className)}
      {...props}
    >
      {children}
    </Component>
  );
}
