import React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useOpenAiGlobal } from "../use-openai-global";
import { Filter, Star } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

function PlaceListItem({ place, isSelected, onClick }) {
  return (
    <div
      className={
        "rounded-2xl px-3 select-none hover:bg-black/5 cursor-pointer" +
        (isSelected ? " bg-black/5" : "")
      }
    >
      <div
        className={`border-b ${
          isSelected ? "border-black/0" : "border-black/5"
        } hover:border-black/0`}
      >
        <button
          className="w-full text-left py-3 transition flex gap-3 items-center"
          onClick={onClick}
        >
          {place.thumbnail ? (
            <img
              src={place.thumbnail}
              alt={place.title}
              className="h-16 w-16 rounded-lg object-cover flex-none"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-[var(--directory-primary, #2563EB)]/10 flex items-center justify-center text-[var(--directory-primary, #2563EB)] font-semibold">
              {place.title?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium truncate">{place.title}</div>
            {place.description ? (
              <div className="text-xs text-black/50 truncate">
                {place.description}
              </div>
            ) : null}
            <div className="text-xs mt-1 text-black/50 flex items-center gap-1">
              {place.rating != null ? (
                <>
                  <Star className="h-3 w-3" aria-hidden="true" />
                  {place.rating?.toFixed
                    ? place.rating.toFixed(1)
                    : place.rating}
                </>
              ) : null}
              {place.price ? <span>· {place.price}</span> : null}
              {place.subtitle ? <span>· {place.subtitle}</span> : null}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ places, selectedId, onSelect, ui }) {
  const [emblaRef] = useEmblaCarousel({ dragFree: true, loop: false });
  const displayMode = useOpenAiGlobal("displayMode");
  const forceMobile = displayMode !== "fullscreen";
  const scrollRef = React.useRef(null);
  const [showBottomFade, setShowBottomFade] = React.useState(false);
  const headerTitle = ui?.copy?.listTitle ?? "Directory results";
  const backgroundColor = ui?.theme?.background ?? "#F8FAFC";

  const updateBottomFadeVisibility = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom =
      Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    setShowBottomFade(!atBottom);
  }, []);

  React.useEffect(() => {
    updateBottomFadeVisibility();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateBottomFadeVisibility();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateBottomFadeVisibility);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateBottomFadeVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  return (
    <>
      {/* Desktop/Tablet sidebar */}
      <div
        className={`${
          forceMobile ? "hidden" : ""
        } absolute inset-y-0 bottom-4 left-0 z-20 w-[340px] max-w-[75%] pointer-events-auto`}
      >
        <div
          ref={scrollRef}
          className="relative px-2 h-full overflow-y-auto text-black"
          style={{ backgroundColor }}
        >
          <div
            className="flex justify-between flex-row items-center px-3 sticky top-0 py-4 text-md font-medium"
            style={{ backgroundColor }}
          >
            <div>
              {headerTitle}
              <span className="text-sm text-black/50 ml-2">{places.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-black/60">
              <Filter className="h-4 w-4" aria-hidden="true" />
              {ui?.copy?.filterLabel ?? "Filter"}
            </div>
          </div>
          <div>
            {places.map((place) => (
              <PlaceListItem
                key={place.id}
                place={place}
                isSelected={
                  displayMode === "fullscreen" && selectedId === place.id
                }
                onClick={() => onSelect(place)}
              />
            ))}
          </div>
        </div>
        <AnimatePresence>
          {showBottomFade && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-9 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="w-full h-full bg-gradient-to-t border-b border-black/50 from-black/15 to-black/0"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 25%, rgba(0,0,0,0.25) 75%, rgba(0,0,0,0) 100%)",
                  maskImage:
                    "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 25%, rgba(0,0,0,0.25) 75%, rgba(0,0,0,0) 100%)",
                }}
                aria-hidden
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile bottom carousel */}
      <div
        className={`${
          forceMobile ? "" : "hidden"
        } absolute inset-x-0 bottom-0 z-20 pointer-events-auto`}
      >
        <div className="pt-2 text-black">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="px-3 py-3 flex gap-3">
              {places.map((place) => (
                <div
                  className="ring ring-black/10 max-w-[330px] w-full shadow-xl rounded-2xl"
                  style={{ backgroundColor }}
                  key={place.id}
                >
                  <PlaceListItem
                    key={place.id}
                    place={place}
                    isSelected={
                      displayMode === "fullscreen" && selectedId === place.id
                    }
                    onClick={() => onSelect(place)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
