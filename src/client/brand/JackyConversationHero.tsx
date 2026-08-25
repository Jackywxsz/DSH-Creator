import { JACKY_GROWTH_PLANET_SRC } from "../assets/jackyGrowthPlanet.ts";

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
      <div className="jackyConversationHeroArt" aria-hidden="true">
        <img
          src={JACKY_GROWTH_PLANET_SRC}
          width={1200}
          height={800}
          alt=""
        />
      </div>
      <div className="jackyConversationHeroCopy">
        <span className="jackyConversationHeroEyebrow">
          AI 无限生长星球
        </span>
        <h1>
          让每一个灵感，
          <strong>长成作品</strong>
        </h1>
        <p>对话、创作、运营，在同一张纸上持续生长。</p>
        <span className="jackyConversationHeroMotto" lang="en">
          THE UNIVERSE EXPANDS. SO DO WE.
        </span>
      </div>
    </section>
  );
}
