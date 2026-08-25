import { JACKY_CREATOR_MASCOT_FULL_SRC } from "../assets/jackyCreatorMascotFull.ts";

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
          src={JACKY_CREATOR_MASCOT_FULL_SRC}
          alt=""
          draggable={false}
        />
      </span>
      <h1>
        <strong lang="en">AI</strong>
        <span>无限生长星球</span>
      </h1>
    </section>
  );
}
