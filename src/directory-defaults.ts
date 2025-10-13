import markers from "./pizzaz/markers.json";

export const defaultDirectoryUi = {
  theme: {
    primary: "#F46C21",
    accent: "#0B6CF6",
    background: "#FFFFFF"
  },
  copy: {
    appTitle: "Pizzaz",
    listTitle: "National Best Pizza List",
    listSubtitle: "A ranking of the best pizzerias in the world",
    emptyState: "No spots found.",
    primaryCtaLabel: "Save List",
    secondaryCtaLabel: "Add to favorites",
    contactCtaLabel: "Contact",
    inspectorLocationLabel: "San Francisco",
    filterLabel: "Filter",
    detailFallback: "Enjoy a slice at one of SF's favorites.",
    reviewsTitle: "Reviews",
    learnMoreLabel: "Learn more",
    sampleReviewOne: "Fantastic crust and balanced toppings. The marinara is spot on!",
    sampleReviewTwo: "Cozy vibe and friendly staff. Quick service on a Friday night.",
    sampleReviewThree: "Great for sharing. Will definitely come back with friends."
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
  items: markers.places ?? [],
  ui: defaultDirectoryUi
};
