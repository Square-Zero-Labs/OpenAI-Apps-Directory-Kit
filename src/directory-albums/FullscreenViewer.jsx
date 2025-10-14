import React from "react";
import { X } from "lucide-react";
import { useMaxHeight } from "../use-max-height";
import FilmStrip from "./FilmStrip";

export default function FullscreenViewer({
  album,
  onClose,
  fullscreen = false
}) {
  const maxHeight = useMaxHeight() ?? undefined;
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    setIndex(0);
  }, [album?.id]);

  if (!album) return null;

  const photo = album.photos?.[index];

  const baseClass = "absolute inset-0 z-30 flex w-full h-full " +
    (fullscreen ? "bg-white" : "bg-white/95 backdrop-blur");

  const containerStyle = fullscreen
    ? { maxHeight, height: maxHeight }
    : { height: "100%" };

  return (
    <div className={baseClass} style={containerStyle}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg ring ring-black/10 hover:bg-white"
        >
          <span className="sr-only">Close album</span>
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      )}

      <div className="relative inset-0 flex flex-row overflow-hidden">
        <div className="hidden md:block absolute z-10 left-0 top-0 bottom-0 w-40 pointer-events-auto">
          <FilmStrip album={album} selectedIndex={index} onSelect={setIndex} />
        </div>

        <div className="flex-1 min-w-0 px-6 sm:px-16 lg:px-40 py-10 relative flex items-center justify-center flex-auto">
          <div className="relative w-full h-full">
            {photo ? (
              <img
                src={photo.url}
                alt={photo.title || album.title}
                className="absolute inset-0 m-auto rounded-3xl shadow-sm border border-black/10 max-w-full max-h-full object-contain"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
