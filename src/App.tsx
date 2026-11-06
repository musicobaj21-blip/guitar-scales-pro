import { useState, useEffect } from "react";
import ScaleDictionary from "./components/ScaleDictionary";
import LanguageSwitch from "./components/LanguageSwitch";
import { getAudioContext } from "./utils/audio";
import { useLanguage } from "./contexts/LanguageContext";
import { Sparkles, Volume2, VolumeX } from "lucide-react";
import { initBrowserShield, AppErrorBoundary } from "./utils/browserShield";

initBrowserShield();

export default function App() {
  const { language } = useLanguage();
  const [audioEnabled, setAudioEnabled] = useState(false);

  const initAudio = async () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      setAudioEnabled(ctx.state === "running");
    } catch (e) {
      console.warn("Could not start Audio Context:", e);
    }
  };

  useEffect(() => {
    const handleGesture = () => {
      initAudio();
    };

    window.addEventListener("click", handleGesture);
    window.addEventListener("keydown", handleGesture);

    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, []);

  const isEs = language === "es";

  return (
    <AppErrorBoundary>
      <div
        id="main-app"
        className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#090a0d] text-neutral-200 font-sans antialiased selection:bg-[#f25100] selection:text-white flex flex-col justify-between"
      >
        {/* Header Corporativo Rumie Guitar Scales Pro (Optimizado en móvil sin afectar desktop) */}
        <header className="w-full bg-[#090a0d] border-b border-[#1c1e28] px-3 sm:px-7 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 select-none shrink-0 print:hidden">
          {/* Izquierda: Logo Oficial Rumie */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-[#f25100] flex items-center justify-center shadow-[0_0_20px_rgba(242,81,0,0.4)] shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-base sm:text-3xl font-bold tracking-tight text-white flex items-baseline gap-1.5 sm:gap-2 leading-tight truncate">
                <span className="truncate">Rumie Guitar Scales</span>
                <span className="font-light text-zinc-400 shrink-0">Pro</span>
              </h1>
              <p className="text-[8.5px] sm:text-[11px] font-semibold tracking-[0.08em] sm:tracking-[0.16em] uppercase text-zinc-400 mt-0.5 sm:mt-1.5 leading-none truncate">
                {isEs
                  ? "APRENDE, COMPRENDE Y CREA MÚSICA"
                  : "LEARN, UNDERSTAND AND CREATE MUSIC"}
              </p>
            </div>
          </div>

          {/* Derecha: Consola minimalista de iconos (Audio + Idioma) siempre visible en móvil */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={initAudio}
              title={
                audioEnabled
                  ? isEs
                    ? "Motor de audio activo"
                    : "Audio engine active"
                  : isEs
                  ? "Activar audio de guitarra"
                  : "Enable guitar audio"
              }
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                audioEnabled
                  ? "bg-[#14151c] border-[#232634] text-[#f25100]"
                  : "bg-[#f25100]/15 border-[#f25100]/40 text-[#f25100] animate-pulse"
              }`}
            >
              {audioEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            <div className="shrink-0">
              <LanguageSwitch />
            </div>
          </div>
        </header>

        {/* Workspace Directo de Guitar Scales Pro */}
        <main className="flex-1 w-full max-w-[1750px] mx-auto px-2.5 sm:px-6 pt-2 sm:pt-3 pb-0 flex flex-col justify-between">
          <ScaleDictionary />
        </main>
      </div>
    </AppErrorBoundary>
  );
}