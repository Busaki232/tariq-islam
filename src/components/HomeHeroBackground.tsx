import islamicPatternBg from "@/assets/islamic-pattern-bg.png";

type HomeHeroBackgroundProps = {
  children: React.ReactNode;
};

export default function HomeHeroBackground({ children }: HomeHeroBackgroundProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={islamicPatternBg}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-hero/90" />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="relative z-10">{children}</div>
    </section>
  );
}