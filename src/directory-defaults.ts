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
    inspectorLocationLabel: "San Francisco Bay Area",
    filterLabel: "Filter",
    detailFallback: "Explore the neighborhood highlights curated for your day.",
    reviewsTitle: "Visitor notes",
    learnMoreLabel: "Learn more"
  },
  fields: {
    title: "name",
    subtitle: "neighborhood",
    description: "description",
    rating: "rating",
    price: "price",
    thumbnail: "thumbnail",
    address: "address",
    city: "city",
    region: "region",
    neighborhood: "neighborhood"
  },
  map: {
    latitudeField: "coords.1",
    longitudeField: "coords.0",
    defaultZoom: 12
  },
  branding: {
    logoUrl: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=180&q=80"
  }
};

export const defaultStructuredContent = {
  resultsTitle: "City highlights",
  items: markers.places ?? [],
  ui: defaultDirectoryUi
};
