/* =====================================
   PAP — PICK A PLATE
   Main Application
===================================== */

const $ = (selector) => document.querySelector(selector);

const loadingScreen = $("#loading-screen");
const spinButton = $("#spin-button");
const popup = $("#restaurant-popup");
const filterButton = $("#filter-button");
const filterModal = $("#filter-modal");
const noMatchModal = $("#no-match-modal");

const symbols = [
    $("#slot-one"),
    $("#slot-two"),
    $("#slot-three")
];

/* =====================================
   FILTER SETTINGS
===================================== */

const DEFAULT_FILTERS = {
    distances: [],
    ratings: [],
    types: [],
    cuisines: [],
};

const CUISINE_TYPES = {
    chinese: ["chinese_restaurant"],
    japanese: [
        "japanese_restaurant",
        "sushi_restaurant",
        "ramen_restaurant"
    ],
    korean: ["korean_restaurant"],
    thai: ["thai_restaurant"],
    indian: ["indian_restaurant"],
    italian: [
        "italian_restaurant",
        "pizza_restaurant"
    ],
    vietnamese: ["vietnamese_restaurant"],
    mexican: ["mexican_restaurant"],
    french: ["french_restaurant"],
    american: [
        "american_restaurant",
        "hamburger_restaurant"
    ],
    seafood: ["seafood_restaurant"],
    mediterranean: ["mediterranean_restaurant"],
};

let filters = {
    ...DEFAULT_FILTERS,
    distances: [],
    ratings: [],
    types: [],
    cuisines: [],
};

let isSpinning = false;
let placesLibraryPromise = null;
let lastLocation = null;


/* =====================================
   INITIALIZATION
===================================== */

window.addEventListener("load", () => {
    initializeEvents();
    initializeFilters();

    setTimeout(() => {
        loadingScreen?.classList.add("hidden");

        // Open the filter popup automatically after loading.
        openFilterModal();
    }, 1200);
});


/* =====================================
   EVENTS
===================================== */

function initializeEvents() {
    spinButton?.addEventListener("click", spin);

    $("#close-popup")?.addEventListener(
        "click",
        closeRestaurantPopup
    );

    $("#spin-again-button")?.addEventListener("click", () => {
        closeRestaurantPopup();
        spin();
    });

    filterButton?.addEventListener("click", openFilterModal);

    $("#close-filter")?.addEventListener(
        "click",
        closeFilterModal
    );

    $("#apply-filters")?.addEventListener(
        "click",
        applyFilters
    );

    $("#reset-filters")?.addEventListener(
        "click",
        resetFilters
    );

    $("#close-no-match")?.addEventListener(
        "click",
        closeNoMatchModal
    );

    $("#edit-filters")?.addEventListener("click", () => {
        closeNoMatchModal();
        openFilterModal();
    });

    $("#clear-from-no-match")?.addEventListener("click", () => {
        resetFilters();
        closeNoMatchModal();
        spin();
    });

    document.querySelectorAll(".popup-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                overlay.classList.remove("active");
                overlay.setAttribute("aria-hidden", "true");
                updateBodyModalState();
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeRestaurantPopup();
            closeFilterModal();
            closeNoMatchModal();
        }
    });

    $("#more-button")?.addEventListener("click", () => {
    });
}


/* =====================================
   FILTERS
===================================== */

function initializeFilters() {
    document.querySelectorAll(
        'input[name="distance"], ' +
        'input[name="rating"], ' +
        'input[name="types"], ' +
        'input[name="cuisine"]'
    ).forEach((input) => {
        input.addEventListener("change", () => {
            input.closest(".check-option")?.classList.toggle(
                "is-checked",
                input.checked
            );
        });
    });

    syncFilterUI();
}


function readFiltersFromUI() {
    filters.distances = Array.from(
        document.querySelectorAll(
            'input[name="distance"]:checked'
        )
    ).map((input) => Number(input.value));

    filters.ratings = Array.from(
        document.querySelectorAll(
            'input[name="rating"]:checked'
        )
    ).map((input) => Number(input.value));

    filters.types = Array.from(
        document.querySelectorAll(
            'input[name="types"]:checked'
        )
    ).map((input) => input.value);

    filters.cuisines = Array.from(
        document.querySelectorAll(
            'input[name="cuisine"]:checked'
        )
    ).map((input) => input.value);
}


function syncFilterUI() {
    document.querySelectorAll(
        'input[name="distance"], ' +
        'input[name="rating"], ' +
        'input[name="types"], ' +
        'input[name="cuisine"]'
    ).forEach((input) => {
        input.checked = false;

        input.closest(".check-option")?.classList.remove(
            "is-checked"
        );
    });

    filters = {
        distances: [],
        ratings: [],
        types: [],
        cuisines: [],
    };
}


function openFilterModal() {
    if (!filterModal) return;

    filterModal.classList.add("active");
    filterModal.setAttribute("aria-hidden", "false");

    updateBodyModalState();
}


function closeFilterModal() {
    filterModal?.classList.remove("active");
    filterModal?.setAttribute("aria-hidden", "true");

    updateBodyModalState();
}


function closeRestaurantPopup() {
    popup?.classList.remove("active");
    popup?.setAttribute("aria-hidden", "true");

    updateBodyModalState();
}


function closeNoMatchModal() {
    noMatchModal?.classList.remove("active");
    noMatchModal?.setAttribute("aria-hidden", "true");

    updateBodyModalState();
}


function updateBodyModalState() {
    document.body.classList.toggle(
        "modal-open",
        Boolean(document.querySelector(".popup-overlay.active"))
    );
}


function resetFilters() {
    syncFilterUI();
}


function applyFilters() {
    readFiltersFromUI();
    closeFilterModal();
    spin();
}


/* =====================================
   GOOGLE PLACES
===================================== */

async function getPlacesLibrary() {
    if (!window.google?.maps?.importLibrary) {
        throw new Error(
            "Google Maps did not load. Check your API key and API settings."
        );
    }

    if (!placesLibraryPromise) {
        placesLibraryPromise = google.maps.importLibrary("places");
    }

    return placesLibraryPromise;
}


function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                lastLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                resolve(lastLocation);
            },

            () => resolve(null),

            {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 300000
            }
        );
    });
}


/* =====================================
   SEARCH RESTAURANTS
===================================== */

async function searchRestaurants() {
    const { Place } = await getPlacesLibrary();

    const userLocation = await getUserLocation();

    const center = userLocation || {
        lat: 1.3521,
        lng: 103.8198
    };

    /*
     * Cuisine search:
     * Use specific Google Places restaurant types
     * when the user selects one or more cuisines.
     */

    const selectedCuisineTypes = [
        ...new Set(
            filters.cuisines.flatMap(
                (cuisine) => CUISINE_TYPES[cuisine] || []
            )
        )
    ];

    /*
     * Type search:
     * If no Cuisine is selected, search using Type.
     * If Cuisine is selected, Type is checked locally
     * so the two filters can work together.
     */

    const selectedTypes = filters.types.length
        ? filters.types
        : ["restaurant", "cafe", "bar", "food_court"];

    const includedTypes = selectedCuisineTypes.length
        ? selectedCuisineTypes
        : selectedTypes;

    const { places } = await Place.searchNearby({
        fields: [
            "id",
            "displayName",
            "formattedAddress",
            "location",
            "rating",
            "userRatingCount",
            "photos",
            "types",
            "primaryType",
            "googleMapsURI",
            "regularOpeningHours"
        ],

        locationRestriction: {
            center,
            radius: 50000
        },

        includedTypes,

        maxResultCount: 20,

        rankPreference: "POPULARITY"
    });

    if (!places?.length) return [];

    const results = places.map((place) => {
        const location = place.location
            ? {
                lat: place.location.lat(),
                lng: place.location.lng()
            }
            : null;

        const distance = userLocation && location
            ? haversineDistance(userLocation, location)
            : null;

        return {
            id: place.id,

            name: place.displayName || "Unnamed restaurant",

            address: place.formattedAddress || "",

            rating: typeof place.rating === "number"
                ? place.rating
                : null,

            reviews: place.userRatingCount || 0,

            types: place.types || [],

            primaryType: place.primaryType || "",

            distance,

            maps: place.googleMapsURI ||
                `https://www.google.com/maps/search/?api=1&query=${
                    encodeURIComponent(
                        place.displayName || "restaurant"
                    )
                }`,

            photo: place.photos?.[0] || null,

            openingHours: place.regularOpeningHours || null,
        };
    });

    return results.filter(matchesFilters);
}


/* =====================================
   FILTER MATCHING
===================================== */

function matchesFilters(place) {
    const placeTypes = [
        ...(place.types || []),
        place.primaryType || ""
    ].map((type) => type.toLowerCase());

    /* DISTANCE */

    if (filters.distances.length > 0) {
        if (place.distance === null) return false;

        const maximumSelectedDistance = Math.max(
            ...filters.distances
        );

        if (place.distance > maximumSelectedDistance) {
            return false;
        }
    }

    /* RATING */

    if (filters.ratings.length > 0) {
        if (place.rating === null) return false;

        const minimumSelectedRating = Math.min(
            ...filters.ratings
        );

        if (place.rating < minimumSelectedRating) {
            return false;
        }
    }

    /* TYPE */

    if (filters.types.length > 0) {
        const isFoodCourt = placeTypes.includes("food_court");
        const isCafe = placeTypes.includes("cafe");
        const isBar = placeTypes.includes("bar");

        const isRestaurant =
            !isFoodCourt &&
            !isCafe &&
            !isBar &&
            (
                placeTypes.includes("restaurant") ||
                placeTypes.some(
                    (type) => type.endsWith("_restaurant")
                )
            );

        const typeMatches = filters.types.some((type) => {
            if (type === "food_court") return isFoodCourt;
            if (type === "cafe") return isCafe;
            if (type === "bar") return isBar;
            if (type === "restaurant") return isRestaurant;

            return false;
        });

        if (!typeMatches) return false;
    }

    /* CUISINE */

    if (filters.cuisines.length > 0) {
        const cuisineMatches = filters.cuisines.some(
            (cuisine) => {
                const supportedTypes = CUISINE_TYPES[cuisine] || [];

                return supportedTypes.some(
                    (type) => placeTypes.includes(type)
                );
            }
        );

        if (!cuisineMatches) return false;
    }

    return true;
}


/* =====================================
   SPIN ANIMATION
===================================== */

async function spin() {
    if (isSpinning) return;

    isSpinning = true;

    closeRestaurantPopup();
    closeNoMatchModal();

    if (spinButton) {
        spinButton.disabled = true;
        spinButton.textContent = "SPINNING...";
    }

    const spinSymbols = [
        "!", "?", "#", "@", "&",
        "P", "A", "★", "❤︎", "꩜", "𐂐"
    ];

    const totalSpins = 25;
    const spinSpeed = 100;

    let currentSpin = 0;
    let animationInterval;

    symbols.forEach((symbol) => {
        symbol?.classList.add("spinning");
    });

    const animationPromise = new Promise((resolve) => {
        animationInterval = setInterval(() => {
            symbols.forEach((symbol) => {
                if (!symbol) return;

                symbol.textContent =
                    spinSymbols[
                        Math.floor(Math.random() * spinSymbols.length)
                    ];
            });

            currentSpin++;

            if (currentSpin >= totalSpins) {
                clearInterval(animationInterval);

                symbols.forEach((symbol, index) => {
                    if (!symbol) return;

                    symbol.textContent = ["P", "A", "P"][index];

                    symbol.classList.remove("spinning");
                });

                resolve();
            }
        }, spinSpeed);
    });

    try {
        const restaurantPromise = searchRestaurants();

        await animationPromise;

        const restaurants = await restaurantPromise;

        await wait(300);

        if (!restaurants.length) {
            showNoMatch();
            return;
        }

        const selectedRestaurant = restaurants[
            Math.floor(Math.random() * restaurants.length)
        ];

        showRestaurant(selectedRestaurant);

    } catch (error) {
        console.error("PAP error:", error);

        alert(
            "PAP couldn't load restaurants from Google Places.\n\n" +
            (
                error?.message ||
                "Please check your connection and API settings."
            )
        );

    } finally {
        if (animationInterval) {
            clearInterval(animationInterval);
        }

        symbols.forEach((symbol, index) => {
            if (!symbol) return;

            symbol.textContent = ["P", "A", "P"][index];

            symbol.classList.remove("spinning");
        });

        if (spinButton) {
            spinButton.disabled = false;
            spinButton.textContent = "SPIN";
        }

        isSpinning = false;
    }
}


/* =====================================
   RESTAURANT RESULT
===================================== */

function showRestaurant(place) {
    if (!popup) return;

    $("#restaurant-name").textContent = place.name;

    const placeTypes = [
        ...(place.types || []),
        place.primaryType || ""
    ].map((type) => type.toLowerCase());

    const type = getRestaurantType(placeTypes);
    const cuisine = getCuisine(placeTypes);

    /*
     * Display format:
     * Restaurant / Italian
     * Cafe / -
     * - / -
     */

    const typeCuisine = `${type} / ${cuisine}`;
    const openingHours = getOpeningHoursText(place.openingHours);

    $("#restaurant-cuisine").textContent = openingHours
        ? `${typeCuisine} | ${openingHours}`
        : typeCuisine;

    $("#restaurant-rating").textContent = place.rating === null
        ? "No rating"
        : place.rating.toFixed(1);

    $("#restaurant-reviews").textContent = place.reviews
        ? `(${place.reviews.toLocaleString()} reviews)`
        : "(No reviews)";

    $("#restaurant-distance").textContent = place.distance === null
        ? "Distance unavailable"
        : `Distance: ${place.distance.toFixed(1)} km`;

    $("#google-maps-link").href = place.maps;

    const image = $("#restaurant-photo");
    const placeholder = $("#image-placeholder");

    image.classList.remove("loaded");
    image.removeAttribute("src");

    placeholder.style.display = "flex";

    if (place.photo) {
        try {
            image.src = place.photo.getURI({
                maxWidth: 900,
                maxHeight: 700
            });

            image.onload = () => {
                image.classList.add("loaded");
                placeholder.style.display = "none";
            };

            image.onerror = () => {
                image.classList.remove("loaded");
                placeholder.style.display = "flex";
            };

        } catch (error) {
            console.warn(
                "Could not load restaurant photo:",
                error
            );
        }
    }

    popup.classList.add("active");
    popup.setAttribute("aria-hidden", "false");

    updateBodyModalState();
}


/* =====================================
   NO MATCH FOUND
===================================== */

function showNoMatch() {
    if (!noMatchModal) {
        alert(
            "NO MATCH FOUND\n\n" +
            "We couldn’t find a restaurant that matches your selected preferences.\n" +
            "Please adjust your filters and try again."
        );

        return;
    }

    noMatchModal.classList.add("active");
    noMatchModal.setAttribute("aria-hidden", "false");

    updateBodyModalState();
}


/* =====================================
   RESTAURANT TYPE
===================================== */

function getOpeningHoursText(openingHours) {
    const periods = openingHours?.periods;

    if (!periods || periods.length === 0) {
        return "";
    }

    const formatTime = (hour, minute) => {
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    };

    const formatPeriod = (period) => {
        if (!period.open) return "";

        const openTime = formatTime(
            period.open.hour,
            period.open.minute
        );

        if (!period.close) {
            return "24 hours";
        }

        const closeTime = formatTime(
            period.close.hour,
            period.close.minute
        );

        return `${openTime} - ${closeTime}`;
    };

    const times = [
        ...new Set(
            periods
                .map(formatPeriod)
                .filter(Boolean)
        )
    ];

    if (times.includes("24 hours")) {
        return "24 hours";
    }

    return times.join(", ");
}

function getRestaurantType(types = []) {
    if (types.includes("food_court")) {
        return "Food Court";
    }

    if (types.includes("cafe")) {
        return "Cafe";
    }

    if (types.includes("bar")) {
        return "Bar";
    }

    if (
        types.includes("restaurant") ||
        types.some((type) => type.endsWith("_restaurant"))
    ) {
        return "Restaurant";
    }

    return "-";
}


/* =====================================
   CUISINE LABEL
===================================== */

function getCuisine(types = []) {
    const cuisineMap = {
        japanese_restaurant: "Japanese",
        chinese_restaurant: "Chinese",
        korean_restaurant: "Korean",
        thai_restaurant: "Thai",
        vietnamese_restaurant: "Vietnamese",
        indian_restaurant: "Indian",
        italian_restaurant: "Italian",
        french_restaurant: "French",
        mexican_restaurant: "Mexican",
        american_restaurant: "American",
        mediterranean_restaurant: "Mediterranean",
        seafood_restaurant: "Seafood",
        steak_house: "Steakhouse",
        pizza_restaurant: "Pizza",
        hamburger_restaurant: "Burgers",
        sushi_restaurant: "Sushi",
        ramen_restaurant: "Ramen"
    };

    const priorityTypes = [
        "japanese_restaurant",
        "chinese_restaurant",
        "korean_restaurant",
        "thai_restaurant",
        "vietnamese_restaurant",
        "indian_restaurant",
        "italian_restaurant",
        "french_restaurant",
        "mexican_restaurant",
        "american_restaurant",
        "mediterranean_restaurant",
        "seafood_restaurant",
        "steak_house",
        "pizza_restaurant",
        "hamburger_restaurant",
        "sushi_restaurant",
        "ramen_restaurant"
    ];

    for (const type of priorityTypes) {
        if (types.includes(type)) {
            return cuisineMap[type];
        }
    }

    return "-";
}


/* =====================================
   DISTANCE CALCULATION
===================================== */

function haversineDistance(pointA, pointB) {
    const earthRadiusKm = 6371;

    const lat1 = toRadians(pointA.lat);
    const lat2 = toRadians(pointB.lat);

    const deltaLat = toRadians(
        pointB.lat - pointA.lat
    );

    const deltaLng = toRadians(
        pointB.lng - pointA.lng
    );

    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) ** 2;

    return earthRadiusKm * 2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );
}


function toRadians(degrees) {
    return degrees * Math.PI / 180;
}


/* =====================================
   WAIT HELPER
===================================== */

function wait(milliseconds) {
    return new Promise(
        (resolve) => setTimeout(resolve, milliseconds)
    );
}

/* ========================================
   PAP — MORE SIDEBAR FUNCTIONALITY
======================================== */

const moreButton = document.querySelector("#more-button");
const moreOverlay = document.querySelector("#more-overlay");
const closeMoreButton = document.querySelector("#close-more");

function openMoreSidebar() {
    if (!moreOverlay) return;

    moreOverlay.classList.add("active");
    moreOverlay.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");
}

function closeMoreSidebar() {
    if (!moreOverlay) return;

    moreOverlay.classList.remove("active");
    moreOverlay.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");
}

moreButton?.addEventListener("click", openMoreSidebar);

closeMoreButton?.addEventListener("click", closeMoreSidebar);

moreOverlay?.addEventListener("click", (event) => {
    if (event.target === moreOverlay) {
        closeMoreSidebar();
    }
});

document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        moreOverlay?.classList.contains("active")
    ) {
        closeMoreSidebar();
    }
});

// ========================================
// RESTAURANT RECOMMENDATION PAGE
// ========================================

const recommendationPage = document.querySelector(
  "#restaurant-recommendation-page"
);

const recommendationButton = document.querySelector(
  "#restaurant-recommendations-button"
);

const closeRecommendationButton = document.querySelector(
  "#close-recommendation-page"
);

const recommendationForm = document.querySelector(
  "#restaurant-recommendation-form"
);

const open24HoursCheckbox = document.querySelector(
  "#open-24-hours"
);

const hoursFields = document.querySelector(
  "#recommendation-hours-fields"
);

const openingTimeInput = document.querySelector(
  "#recommendation-opening-time"
);

const closingTimeInput = document.querySelector(
  "#recommendation-closing-time"
);


// ========================================
// OPEN AND CLOSE PAGE
// ========================================

function openRecommendationPage() {
  closeMoreSidebar();

  if (!recommendationPage) return;

  recommendationPage.classList.add("active");
  recommendationPage.setAttribute("aria-hidden", "false");

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });
}

function closeRecommendationPage() {
  if (!recommendationPage) return;

  recommendationPage.classList.remove("active");
  recommendationPage.setAttribute("aria-hidden", "true");
}

recommendationButton?.addEventListener(
  "click",
  openRecommendationPage
);

closeRecommendationButton?.addEventListener(
  "click",
  closeRecommendationPage
);


// ========================================
// OPEN 24 HOURS
// ========================================

function updateRecommendationHours() {
  if (
    !open24HoursCheckbox ||
    !hoursFields ||
    !openingTimeInput ||
    !closingTimeInput
  ) {
    return;
  }

  if (open24HoursCheckbox.checked) {
    hoursFields.style.display = "none";

    openingTimeInput.required = false;
    closingTimeInput.required = false;

    openingTimeInput.value = "";
    closingTimeInput.value = "";
  } else {
    hoursFields.style.display = "grid";

    openingTimeInput.required = true;
    closingTimeInput.required = true;
  }
}

open24HoursCheckbox?.addEventListener(
  "change",
  updateRecommendationHours
);

updateRecommendationHours();


// ========================================
// FORM SUBMISSION
// ========================================

recommendationForm?.addEventListener("submit", async function (event) {
  event.preventDefault();

  const submitButton = document.querySelector("#submit-recommendation");

  const formData = {
    submitter: document.querySelector("#recommendation-submitter")?.value.trim(),
    restaurantName: document.querySelector("#recommendation-restaurant-name")?.value.trim(),
    restaurantType: document.querySelector("#recommendation-type")?.value,
    cuisine: document.querySelector("#recommendation-cuisine")?.value,
    open24Hours: open24HoursCheckbox?.checked ?? false,
    openingTime: open24HoursCheckbox?.checked ? "" : openingTimeInput?.value,
    closingTime: open24HoursCheckbox?.checked ? "" : closingTimeInput?.value,
    location: document.querySelector("#recommendation-location")?.value.trim(),
    details: document.querySelector("#recommendation-details")?.value.trim()
  };

  if (
    !formData.submitter ||
    !formData.restaurantName ||
    !formData.restaurantType ||
    !formData.cuisine ||
    !formData.location
  ) {
    alert("Please complete all required fields.");
    return;
  }

  if (
    !formData.open24Hours &&
    (!formData.openingTime || !formData.closingTime)
  ) {
    alert("Please enter the opening and closing times.");
    return;
  }

  const originalButtonText = submitButton?.textContent;

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    await fetch(
      "https://script.google.com/macros/s/AKfycbyvSEVq6f_b_4DDjRFiKyb2guYnFBYi60FzpNcgFqTKilVgcxzjtqJFHM-ehd7y69kv/exec",
      {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(formData)
      }
    );

    document
      .querySelector("#submission-success-popup")
      ?.classList.add("show");

    recommendationForm.reset();

    if (open24HoursCheckbox) {
      open24HoursCheckbox.checked = false;
      open24HoursCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    }

  } catch (error) {
    console.error("Restaurant recommendation submission error:", error);
    alert("Unable to send your recommendation. Please check your internet connection and try again.");

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText || "SUBMIT";
    }
  }
});


// ========================================
// CLOSE PAGE WITH ESCAPE KEY
// ========================================

document.addEventListener("keydown", function (event) {
  if (
    event.key === "Escape" &&
    recommendationPage?.classList.contains("active")
  ) {
    closeRecommendationPage();
  }
});


// ========================================
// FEEDBACK BUTTON
// ========================================

document.querySelector("#feedback-button")?.addEventListener(
  "click",
  function () {
    closeMoreSidebar();
  }
);

 // Close Submission Success Popup and return to Roulette
const successPopup = document.querySelector(
  "#submission-success-popup"
);

const closeSuccessPopup = document.querySelector(
  "#close-success-popup"
);

closeSuccessPopup?.addEventListener("click", function (event) {
  event.preventDefault();
  event.stopPropagation();

  // Close the success popup
  successPopup?.classList.remove("show");
  successPopup?.setAttribute("aria-hidden", "true");

  // Close the recommendation form
  recommendationPage?.classList.remove("active");
  recommendationPage?.setAttribute("aria-hidden", "true");

  // Restore the roulette page
  document.body.classList.remove("modal-open");

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });
});


/* ========================================
   PAP — SUCCESS POPUP CLOSE FIX
======================================== */

(() => {
    const successPopup = document.querySelector("#submission-success-popup");
    const closeSuccessButton = document.querySelector("#close-success-popup");
    const recommendationPage = document.querySelector("#recommendation-page");

    function closeSuccessPopupAndReturnToWheel(event) {
        event?.preventDefault();
        event?.stopPropagation();

        // ปิด Success Popup
        if (successPopup) {
            successPopup.classList.remove("show");
            successPopup.setAttribute("aria-hidden", "true");
        }

        // กลับไปหน้าหมุนวงล้อ
        if (recommendationPage) {
            recommendationPage.hidden = true;
        }

        // ปลดล็อกการเลื่อนหน้าจอ
        document.body.classList.remove("modal-open");

        // กลับไปด้านบนของหน้า
        window.scrollTo({
            top: 0,
            behavior: "auto"
        });
    }

    // ปุ่ม Close ใน Success Popup
    closeSuccessButton?.addEventListener(
        "click",
        closeSuccessPopupAndReturnToWheel
    );
})();


/* ========================================
   PAP — FEEDBACK FORM
======================================== */

(() => {
    const feedbackPage = document.querySelector("#feedback-page");
    const feedbackButton = document.querySelector("#feedback-button");
    const closeFeedbackButton = document.querySelector("#close-feedback-page");
    const feedbackForm = document.querySelector("#feedback-form");
    const feedbackSuccessPopup = document.querySelector("#feedback-success-popup");
    const closeFeedbackSuccessButton = document.querySelector("#close-feedback-success-popup");

    const feedbackEndpoint =
        "https://script.google.com/macros/s/AKfycbyvSEVq6f_b_4DDjRFiKyb2guYnFBYi60FzpNcgFqTKilVgcxzjtqJFHM-ehd7y69kv/exec";

    function openFeedbackPage() {
        closeMoreSidebar();

        if (!feedbackPage) return;

        feedbackPage.classList.add("active");
        feedbackPage.setAttribute("aria-hidden", "false");

        window.scrollTo({
            top: 0,
            behavior: "auto"
        });
    }

    function closeFeedbackPage() {
        if (!feedbackPage) return;

        feedbackPage.classList.remove("active");
        feedbackPage.setAttribute("aria-hidden", "true");

        window.scrollTo({
            top: 0,
            behavior: "auto"
        });
    }

    function closeFeedbackSuccessPopup() {
        feedbackSuccessPopup?.classList.remove("show");
        feedbackSuccessPopup?.setAttribute("aria-hidden", "true");

        closeFeedbackPage();

        document.body.classList.remove("modal-open");

        window.scrollTo({
            top: 0,
            behavior: "auto"
        });
    }

    feedbackButton?.addEventListener("click", openFeedbackPage);

    closeFeedbackButton?.addEventListener(
        "click",
        closeFeedbackPage
    );

    closeFeedbackSuccessButton?.addEventListener(
        "click",
        closeFeedbackSuccessPopup
    );

    feedbackForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitButton = document.querySelector("#submit-feedback");
        const nameInput = document.querySelector("#feedback-name");
        const emailInput = document.querySelector("#feedback-email");
        const problemInput = document.querySelector("#feedback-problem");

        const name = nameInput?.value.trim() || "";
        const email = emailInput?.value.trim() || "";
        const problem = problemInput?.value.trim() || "";

        if (!name || !email || !problem) {
            alert("Please complete all required fields.");
            return;
        }

        if (!emailInput.checkValidity()) {
            emailInput.reportValidity();
            return;
        }

        const originalButtonText = submitButton?.textContent;

        const formData = {
            formType: "feedback",
            name,
            email,
            problem
        };

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Submitting...";
            }

            await fetch(feedbackEndpoint, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(formData)
            });

            feedbackForm.reset();

            feedbackSuccessPopup?.classList.add("show");
            feedbackSuccessPopup?.setAttribute("aria-hidden", "false");

        } catch (error) {
            console.error("Feedback submission error:", error);

            alert(
                "Unable to send your feedback. Please check your internet connection and try again."
            );

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText || "SUBMIT";
            }
        }
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            feedbackPage?.classList.contains("active") &&
            !feedbackSuccessPopup?.classList.contains("show")
        ) {
            closeFeedbackPage();
        }

        if (
            event.key === "Escape" &&
            feedbackSuccessPopup?.classList.contains("show")
        ) {
            closeFeedbackSuccessPopup();
        }
    });
})();
