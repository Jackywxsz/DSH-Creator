import { useEffect, useRef } from "react";
import { JACKY_CREATOR_LOOP_VIDEO_SRC } from "../assets/jackyCreatorLoopVideo.ts";
import { JACKY_CREATOR_MASCOT_FULL_SRC } from "../assets/jackyCreatorMascotFull.ts";

export interface JackyConversationHeroProps {
  className?: string;
  size?: number;
}

export function JackyConversationHero({
  className,
}: JackyConversationHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      const video = videoRef.current;
      if (!video) return;
      if (reduceMotion.matches) {
        video.pause();
        video.currentTime = 0;
        return;
      }
      void video.play().catch(() => undefined);
    };

    syncPlayback();
    reduceMotion.addEventListener("change", syncPlayback);
    return () => reduceMotion.removeEventListener("change", syncPlayback);
  }, []);

  return (
    <section
      className={["jackyConversationHero", className].filter(Boolean).join(" ")}
      data-jacky-conversation-hero=""
      aria-label="Jacky Creator，AI 无限生长星球"
      lang="zh-CN"
    >
      <span className="jackyConversationHeroMark" aria-hidden="true">
        <video
          ref={videoRef}
          src={JACKY_CREATOR_LOOP_VIDEO_SRC}
          poster={JACKY_CREATOR_MASCOT_FULL_SRC}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
        />
      </span>
      <h1>
        <strong lang="en">AI</strong>
        <span>无限生长星球</span>
      </h1>
    </section>
  );
}
