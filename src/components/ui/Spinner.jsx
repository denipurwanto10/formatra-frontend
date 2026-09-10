import { Loader2 } from "lucide-react";
import clsx from "clsx";

export default function Spinner({ className, size = "size-5" }) {
  return <Loader2 className={clsx(size, "animate-spin text-accent", className)} />;
}
