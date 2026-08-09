import { MessageCircle, Phone } from "lucide-react";

export type Channel = "phone" | "whatsapp";

export function normaliseChannel(value: string | null | undefined): Channel {
  return value === "whatsapp" ? "whatsapp" : "phone";
}

export function channelLabel(channel: Channel) {
  return channel === "whatsapp" ? "WhatsApp" : "Phone";
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  const Icon = channel === "whatsapp" ? MessageCircle : Phone;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-brand-tint px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-accent-foreground">
      <Icon className="size-3" aria-hidden />
      {channelLabel(channel)}
    </span>
  );
}