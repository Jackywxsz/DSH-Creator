import { JACKY_CREATOR_LOOP_VIDEO_SRC } from "../assets/jackyCreatorLoopVideo.ts";

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
        <span
          className="jackyConversationHeroSprite"
          style={{ backgroundImage: `url("${JACKY_CREATOR_LOOP_VIDEO_SRC}")` }}
        />
      </span>
      <h1>
        <strong lang="en">AI</strong>
        <span>无限生长星球</span>
      </h1>
    </section>
  );
}
