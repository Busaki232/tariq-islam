const tariqIslamLogo = "/tariq-logo.png";

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#14532d_0%,_#020617_50%,_#000_100%)]" />

      <div className="relative animate-[logoReveal_2.5s_ease-in-out_forwards] text-center">
        <img
          src={tariqIslamLogo}
          alt="Tariq Islam"
          className="mx-auto h-28 w-28 rounded-3xl object-cover shadow-[0_0_45px_rgba(34,197,94,0.55)]"
        />
        <p className="mt-4 text-xl font-bold text-white">Tariq Islam</p>
      </div>

      <style>{`
        @keyframes logoReveal {
          0% {
            transform: scale(0.85);
            opacity: 0;
            filter: blur(8px);
          }
          45% {
            opacity: 1;
            filter: blur(0);
          }
          80% {
            transform: scale(1.12);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;