import React from "react";
import { motion } from "framer-motion";
import { Star, X } from "lucide-react";

export default function Inspector({ place, onClose, ui }) {
  if (!place) return null;
  const locationLabel =
    place.subtitle ?? ui?.copy?.inspectorLocationLabel ?? "";

  return (
    <motion.div
      key={place.id}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
      className="pizzaz-inspector absolute z-30 top-0 bottom-4 left-0 right-auto xl:left-auto xl:right-6 md:z-20 w-[340px] xl:w-[360px] xl:top-6 xl:bottom-8 pointer-events-auto"
    >
      <button
        aria-label="Close details"
        className="inline-flex absolute z-10 top-4 left-4 xl:top-4 xl:left-4 shadow-xl rounded-full p-2 bg-white ring ring-black/10 xl:shadow-2xl hover:bg-white"
        onClick={onClose}
      >
        <X className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      <div className="relative h-full overflow-y-auto rounded-none xl:rounded-3xl bg-white text-black xl:shadow-xl xl:ring ring-black/10">
        <div className="relative mt-2 xl:mt-0 px-2 xl:px-0">
          {place.thumbnail ? (
            <img
              src={place.thumbnail}
              alt={place.title}
              className="w-full rounded-3xl xl:rounded-none h-80 object-cover xl:rounded-t-2xl"
            />
          ) : (
            <div className="w-full h-80 flex items-center justify-center text-3xl font-semibold rounded-3xl bg-[var(--directory-primary, #F46C21)]/10 text-[var(--directory-primary, #F46C21)]">
              {place.title?.charAt(0) ?? "?"}
            </div>
          )}
        </div>

        <div className="h-[calc(100%-11rem)] sm:h-[calc(100%-14rem)]">
          <div className="p-4 sm:p-5">
            <div className="text-2xl font-medium truncate">{place.title}</div>
            <div className="text-sm mt-1 opacity-70 flex items-center gap-1 flex-wrap">
              {place.rating != null ? (
                <>
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  {place.rating?.toFixed
                    ? place.rating.toFixed(1)
                    : place.rating}
                </>
              ) : null}
              {place.price ? <span>· {place.price}</span> : null}
              {locationLabel ? <span>· {locationLabel}</span> : null}
            </div>
            <div className="mt-3 flex flex-row items-center gap-3 font-medium">
              <div className="rounded-full bg-[var(--directory-primary, #F46C21)] text-white cursor-pointer px-4 py-1.5">
                {ui?.copy?.secondaryCtaLabel ?? "Add to favorites"}
              </div>
              <div className="rounded-full border border-[var(--directory-primary, #F46C21)]/50 text-[var(--directory-primary, #F46C21)] cursor-pointer  px-4 py-1.5">
                {ui?.copy?.contactCtaLabel ?? "Contact"}
              </div>
            </div>
            <div className="text-sm mt-5">
              {place.description ??
                ui?.copy?.detailFallback ??
                "No description available yet."}
            </div>
          </div>

          <div className="px-4 sm:px-5 pb-4">
            <div className="text-lg font-medium mb-2">
              {ui?.copy?.reviewsTitle ?? "Reviews"}
            </div>
            <ul className="space-y-3 divide-y divide-black/5">
              {[
                {
                  user: "Leo M.",
                  avatar: "https://persistent.oaistatic.com/pizzaz/user1.png",
                  text:
                    ui?.copy?.sampleReviewOne ??
                    "Fantastic experience and welcoming staff!",
                },
                {
                  user: "Priya S.",
                  avatar: "https://persistent.oaistatic.com/pizzaz/user2.png",
                  text:
                    ui?.copy?.sampleReviewTwo ??
                    "Cozy vibe with thoughtful amenities.",
                },
                {
                  user: "Maya R.",
                  avatar: "https://persistent.oaistatic.com/pizzaz/user3.png",
                  text:
                    ui?.copy?.sampleReviewThree ??
                    "Great for sharing with friends—will return soon!",
                },
              ].map((review, idx) => (
                <li key={idx} className="py-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={review.avatar}
                      alt={`${review.user} avatar`}
                      className="h-8 w-8 ring ring-black/5 rounded-full object-cover flex-none"
                    />
                    <div className="min-w-0 gap-1 flex flex-col">
                      <div className="text-xs font-medium text-black/70">
                        {review.user}
                      </div>
                      <div className="text-sm">{review.text}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
