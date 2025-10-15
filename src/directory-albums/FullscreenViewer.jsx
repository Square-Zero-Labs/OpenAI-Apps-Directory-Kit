import React from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useMaxHeight } from "../use-max-height";

export default function FullscreenViewer({
  album,
  onClose,
  fullscreen = false,
  logoUrl = null
}) {
  const maxHeight = useMaxHeight() ?? undefined;
  const slides = album?.photos ?? [];

  const [viewportRef, emblaApi] = useEmblaCarousel({ align: "center", loop: slides.length > 1 });
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  React.useEffect(() => {
    setSelectedIndex(0);
    emblaApi?.scrollTo(0, false);
  }, [album?.id, emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  if (!album) return null;

  const baseClass =
    "absolute inset-0 z-30 flex w-full h-full " +
    (fullscreen ? "" : "backdrop-blur");

  const backgroundColor = "var(--directory-background, #F8FAFC)";

  const containerStyle = fullscreen
    ? { maxHeight, height: maxHeight, backgroundColor }
    : { height: "100%", backgroundColor };

  const slidesCount = slides.length;

  return (
    <div className={baseClass} style={containerStyle}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full text-black shadow-lg ring ring-black/10"
          style={{ backgroundColor: "var(--directory-background, #F8FAFC)" }}
        >
          <span className="sr-only">Close album</span>
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      )}

      <div className="flex h-full w-full flex-col gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{album.title}</div>
            {slidesCount > 0 ? (
              <div className="text-sm text-black/50">
                {selectedIndex + 1} / {slidesCount}
              </div>
            ) : (
              <div className="text-sm text-black/50">No photos yet</div>
            )}
          </div>
          {logoUrl ? (
            <div className="h-10 w-10 rounded-lg overflow-hidden border border-black/10 flex-shrink-0">
              <img
                src={logoUrl}
                alt={album.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>

        <div className="relative flex-1 min-h-[320px]">
          <div
            className="h-full w-full overflow-hidden rounded-3xl bg-black/5"
            ref={viewportRef}
          >
            <div className="flex h-full">
              {slides.length > 0 ? (
                slides.map((photo) => (
                  <div
                    className="relative flex-[0_0_100%] h-full px-1 sm:px-3"
                    key={photo.id}
                  >
                    <img
                      src={photo.url}
                      alt={photo.title || album.title}
                      className="h-full w-full object-contain md:object-cover rounded-3xl shadow-sm border border-black/10"
                      loading="lazy"
                    />
                  </div>
                ))
              ) : (
                <div className="flex h-full w-full items-center justify-center text-black/50">
                  No photos available yet.
                </div>
              )}
            </div>
          </div>

          {slidesCount > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full text-black shadow-lg ring ring-black/5"
                style={{ backgroundColor: "var(--directory-background, #F8FAFC)" }}
                onClick={() => emblaApi?.scrollPrev()}
                aria-label="Previous photo"
              >
                <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full text-black shadow-lg ring ring-black/5"
                style={{ backgroundColor: "var(--directory-background, #F8FAFC)" }}
                onClick={() => emblaApi?.scrollNext()}
                aria-label="Next photo"
              >
                <ArrowRight className="h-4.5 w-4.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {slidesCount > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((photo, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => emblaApi?.scrollTo(idx)}
                  className={
                    "relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border transition " +
                    (isActive
                      ? "border-[var(--directory-primary,#2563EB)]"
                      : "border-transparent opacity-60 hover:opacity-100")
                  }
                  aria-label={`View photo ${idx + 1}`}
                >
                  <img
                    src={photo.url}
                    alt={photo.title || album.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
