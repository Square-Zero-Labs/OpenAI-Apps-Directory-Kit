import React from "react";
import { createRoot } from "react-dom/client";
import { Star } from "lucide-react";
import { useWidgetProps } from "../use-widget-props";
import {
  defaultStructuredContent,
  defaultDirectoryUi,
} from "../directory-defaults";
import { normalizeDirectoryItems, themeStyleVars } from "../directory-utils";

function App() {
  const widgetProps = useWidgetProps(() => defaultStructuredContent);
  const items = widgetProps?.items ?? defaultStructuredContent.items;
  const ui = widgetProps?.ui ?? defaultDirectoryUi;
  const themeVars = themeStyleVars(ui.theme);
  const places = normalizeDirectoryItems(items, ui);
  const listTitle = ui.copy?.listTitle ?? "Directory List";
  const listSubtitle = ui.copy?.listSubtitle ?? "Curated directory entries";
  const logoUrl = ui.branding?.logoUrl ?? null;
  const emptyState = ui.copy?.emptyState ?? "No locations found.";

  return (
    <div
      className="antialiased w-full text-black px-4 pb-2 border border-black/10 rounded-2xl sm:rounded-3xl overflow-hidden bg-white"
      style={themeVars}
    >
      <div className="max-w-full">
        <div className="flex flex-row items-center gap-4 sm:gap-4 border-b border-black/5 py-4">
          {logoUrl ? (
            <div className="sm:w-18 w-16 aspect-square rounded-xl overflow-hidden border border-black/10">
              <img
                src={logoUrl}
                alt={ui.copy?.appTitle ?? "Directory logo"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="sm:w-18 w-16 aspect-square rounded-xl bg-[var(--directory-primary, #2563EB)]/10 text-[var(--directory-primary, #2563EB)] flex items-center justify-center font-semibold">
              {(ui.copy?.appTitle ?? "Directory").charAt(0)}
            </div>
          )}
          <div>
            <div className="text-base sm:text-xl font-medium">{listTitle}</div>
            <div className="text-sm text-black/60">{listSubtitle}</div>
          </div>
          <div className="flex-auto hidden sm:flex justify-end pr-2" />
        </div>
        <div className="min-w-full text-sm flex flex-col">
          {places.slice(0, 7).map((place, i) => (
            <div
              key={place.id}
              className="px-3 -mx-2 rounded-2xl hover:bg-black/5"
            >
              <div
                style={{
                  borderBottom:
                    i === 7 - 1 ? "none" : "1px solid rgba(0, 0, 0, 0.05)",
                }}
                className="flex w-full items-center hover:border-black/0! gap-2"
              >
                <div className="py-3 pr-3 min-w-0 w-full sm:w-3/5">
                  <div className="flex items-center gap-3">
                    {place.thumbnail ? (
                      <img
                        src={place.thumbnail}
                        alt={place.title}
                        className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-cover ring ring-black/5"
                      />
                    ) : (
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-[var(--directory-primary, #2563EB)]/10 text-[var(--directory-primary, #2563EB)] flex items-center justify-center font-semibold">
                        {place.title?.charAt(0) ?? "?"}
                      </div>
                    )}
                    <div className="w-3 text-end sm:block hidden text-sm text-black/40">
                      {i + 1}
                    </div>
                    <div className="min-w-0 sm:pl-1 flex flex-col items-start h-full">
                      <div className="font-medium text-sm sm:text-md truncate max-w-[40ch]">
                        {place.title}
                      </div>
                      <div className="mt-1 sm:mt-0.25 flex items-center gap-3 text-black/70 text-sm">
                        {place.rating != null ? (
                          <div className="flex items-center gap-1">
                            <Star
                              strokeWidth={1.5}
                              className="h-3 w-3 text-black"
                            />
                            <span>
                              {place.rating?.toFixed
                                ? place.rating.toFixed(1)
                                : place.rating}
                            </span>
                          </div>
                        ) : null}
                        <div className="whitespace-nowrap sm:hidden">
                          {place.subtitle || "–"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:block text-end py-2 px-3 text-sm text-black/60 whitespace-nowrap flex-auto">
                  {place.subtitle || "–"}
                </div>
                <div className="py-2 whitespace-nowrap flex justify-end text-sm text-black/60">
                  {place.price ? <span>{place.price}</span> : <span>Details</span>}
                </div>
              </div>
            </div>
          ))}
          {places.length === 0 && (
            <div className="py-6 text-center text-black/60">
              {emptyState}
            </div>
          )}
        </div>
        <div className="sm:hidden px-0 pt-2 pb-2" />
      </div>
    </div>
  );
}

createRoot(document.getElementById("directory-list-root")).render(<App />);
