import React from "react";
import { createRoot } from "react-dom/client";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import PlaceCard from "./PlaceCard";
import { useWidgetProps } from "../use-widget-props";
import {
  defaultStructuredContent,
  defaultDirectoryUi,
} from "../directory-defaults";
import { normalizeDirectoryItems, themeStyleVars } from "../directory-utils";
import LoadingPlaceholder from "../directory-loading/LoadingPlaceholder";

function App() {
  const fallbackContent = React.useMemo(
    () => ({
      ...defaultStructuredContent,
      items: [],
      _directoryFallback: true,
    }),
    []
  );
  const widgetProps = useWidgetProps(() => fallbackContent);
  const isLoading =
    !widgetProps || (widgetProps && widgetProps._directoryFallback);
  const ui = widgetProps?.ui ?? defaultDirectoryUi;
  const themeVars = themeStyleVars(ui.theme);
  const containerStyle = React.useMemo(
    () => ({
      ...themeVars,
      backgroundColor: ui.theme?.background ?? "#F8FAFC"
    }),
    [themeVars, ui.theme]
  );
  const items = React.useMemo(
    () => (isLoading ? [] : widgetProps?.items ?? []),
    [isLoading, widgetProps]
  );
  const places = React.useMemo(
    () => normalizeDirectoryItems(items, ui),
    [items, ui]
  );
  const logoUrl = ui.branding?.logoUrl ?? null;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: false,
    containScroll: "trimSnaps",
    slidesToScroll: "auto",
    dragFree: false,
  });
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  React.useEffect(() => {
    if (!emblaApi) return;
    const updateButtons = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    updateButtons();
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    return () => {
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi]);

  return (
    <div
      className="antialiased relative w-full text-black py-5"
      style={containerStyle}
    >
      <div className="flex items-center justify-between px-4 pb-3">
        <div>
          <div className="text-lg font-semibold">
            {ui.copy?.listTitle ?? ui.copy?.appTitle ?? "Highlights"}
          </div>
      <div className="text-sm text-black/60">
        {ui.copy?.listSubtitle ?? null}
      </div>
    </div>
    {logoUrl && (
          <div className="h-10 w-10 rounded-lg overflow-hidden border border-black/10 flex-shrink-0">
            <img
              src={logoUrl}
              alt={ui.copy?.appTitle ?? "Directory logo"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
        </div>
      )}
    </div>
      <div className="overflow-hidden" ref={emblaRef}>
        {isLoading ? (
          <LoadingPlaceholder
            theme={ui.theme}
            message="Scooping up standout spots…"
            subMessage="One second. The carousel crew is doing their stretches."
            className="min-h-[220px]"
          />
        ) : (
          <div className="flex gap-4 max-sm:mx-5 items-stretch">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} ui={ui} />
            ))}
          </div>
        )}
      </div>
      {!isLoading && (
        <>
          {/* Edge gradients */}
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 left-0 w-3 z-[5] transition-opacity duration-200 " +
              (canPrev ? "opacity-100" : "opacity-0")
            }
          >
            <div
              className="h-full w-full border-l border-black/15 bg-gradient-to-r from-black/10 to-transparent"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
              }}
            />
          </div>
          <div
            aria-hidden
            className={
              "pointer-events-none absolute inset-y-0 right-0 w-3 z-[5] transition-opacity duration-200 " +
              (canNext ? "opacity-100" : "opacity-0")
            }
          >
            <div
              className="h-full w-full border-r border-black/15 bg-gradient-to-l from-black/10 to-transparent"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
              }}
            />
          </div>
        </>
      )}
      {!isLoading && canPrev && (
        <button
          aria-label="Previous"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full text-black shadow-lg ring ring-black/5"
          style={{ backgroundColor: "var(--directory-background, #F8FAFC)" }}
          onClick={() => emblaApi && emblaApi.scrollPrev()}
          type="button"
        >
          <ArrowLeft
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          />
        </button>
      )}
      {!isLoading && canNext && (
        <button
          aria-label="Next"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full text-black shadow-lg ring ring-black/5"
          style={{ backgroundColor: "var(--directory-background, #F8FAFC)" }}
          onClick={() => emblaApi && emblaApi.scrollNext()}
          type="button"
        >
          <ArrowRight
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}

createRoot(document.getElementById("directory-carousel-root")).render(<App />);
