import clsx from "clsx";

export default function Card({ className, children, as: Component = "div", ...props }) {
  return (
    <Component className={clsx("rounded-xl border-hair bg-surface", className)} {...props}>
      {children}
    </Component>
  );
}
