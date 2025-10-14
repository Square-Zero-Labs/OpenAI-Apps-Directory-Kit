import React from "react";
import { Star } from "lucide-react";

export default function PlaceCard({ place, ui }) {
  if (!place) return null;
  return (
    <div className="min-w-[220px] select-none max-w-[220px] w-[65vw] sm:w-[220px] self-stretch flex flex-col">
      <div className="w-full">
        {place.thumbnail ? (
          <img
            src={place.thumbnail}
            alt={place.title}
            className="w-full aspect-square rounded-2xl object-cover ring ring-black/5 shadow-[0px_2px_6px_rgba(0,0,0,0.06)]"
          />
        ) : (
          <div className="w-full aspect-square rounded-2xl bg-[var(--directory-primary, #2563EB)]/10 text-[var(--directory-primary, #2563EB)] flex items-center justify-center text-3xl font-semibold">
            {place.title?.charAt(0) ?? "?"}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-col flex-1 flex-auto">
        <div className="text-base font-medium truncate line-clamp-1">{place.title}</div>
        <div className="text-xs mt-1 text-black/60 flex items-center gap-1 flex-wrap">
          {place.rating != null ? (
            <>
              <Star className="h-3 w-3" aria-hidden="true" />
              {place.rating?.toFixed ? place.rating.toFixed(1) : place.rating}
            </>
          ) : null}
          {place.price ? <span>· {place.price}</span> : null}
          {place.subtitle ? <span>· {place.subtitle}</span> : null}
        </div>
        {place.description ? (
          <div className="text-sm mt-2 text-black/80 flex-auto">
            {place.description}
          </div>
        ) : null}
        <div className="mt-5">
          <button
            type="button"
            className="cursor-pointer inline-flex items-center rounded-full bg-[var(--directory-primary, #2563EB)] text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 active:opacity-100"
          >
            {ui?.copy?.learnMoreLabel ?? "Learn more"}
          </button>
        </div>
      </div>
    </div>
  );
}
