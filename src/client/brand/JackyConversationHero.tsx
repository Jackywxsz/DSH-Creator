import { JACKY_CREATOR_MASCOT_PORTHOLE_SRC } from "../assets/jackyCreatorMascotPorthole.ts";

export interface JackyConversationHeroProps {
  className?: string;
  size?: number;
}

export function JackyConversationHero({
  className,
}: JackyConversationHeroProps) {
  return (
    <section
      className={["jackyConversationHero", className].filter(Boolean).join(" ")}
      data-jacky-conversation-hero=""
      aria-label="Jacky Creator，AI 无限生长星球"
      lang="zh-CN"
    >
      <span className="jackyConversationHeroMark" aria-hidden="true">
        <img
          src={JACKY_CREATOR_MASCOT_PORTHOLE_SRC}
          width={256}
          height={256}
          alt=""
        />
      </span>
      <h1>
        <strong lang="en">AI</strong>
        <span>无限生长星球</span>
      </h1>
    </section>
  );
}
