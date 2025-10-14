import markers from "./directory-map/markers.json";

export const defaultDirectoryUi = {
  theme: {
    primary: "#2563EB",
    accent: "#10B981",
    background: "#F8FAFC"
  },
  copy: {
    appTitle: "Directory Demo",
    listTitle: "City Highlights",
    listSubtitle: "A shortlist of places locals love",
    emptyState: "No places match yet.",
    primaryCtaLabel: "Save Collection",
    secondaryCtaLabel: "Bookmark",
    contactCtaLabel: "Contact",
    inspectorLocationLabel: "San Francisco Bay Area",
    filterLabel: "Filter",
    detailFallback: "Explore the neighborhood highlights curated for your day.",
    reviewsTitle: "Visitor notes",
    learnMoreLabel: "Learn more",
    sampleReviewOne:
      "Welcoming hosts and thoughtful details throughout the experience.",
    sampleReviewTwo: "Lots of small touches that make this spot a standout.",
    sampleReviewThree:
      "Easy to spend an afternoon here—I'll be bringing friends back."
  },
  fields: {
    title: "name",
    subtitle: "city",
    description: "description",
    rating: "rating",
    price: "price",
    thumbnail: "thumbnail"
  },
  map: {
    latitudeField: "coords.1",
    longitudeField: "coords.0",
    defaultZoom: 12
  }
};

export const defaultStructuredContent = {
  headline: "City highlights",
  items: markers.places ?? [],
  ui: defaultDirectoryUi
};
