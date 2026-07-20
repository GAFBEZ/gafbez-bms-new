interface NotificationBadgeProps {
  count: number;
}

export function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-semibold leading-none text-white"
      aria-hidden="true"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
