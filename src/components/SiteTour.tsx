import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_KEY = "hasSeenTour";

export const SiteTour = () => {
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;

    const t = setTimeout(() => {
      const d = driver({
        showProgress: true,
        allowClose: true,
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Let's go!",
        steps: [
          {
            element: "#tour-search",
            popover: {
              title: "🔎 Find any Spanish song",
              description:
                "Search YouTube for a track. We'll auto-build the lyrics, translations and chorus markings.",
            },
          },
          {
            popover: {
              title: "👆 Click any word",
              description:
                "Inside the lyrics, click a word to see its English translation and a phonetic pronunciation.",
            },
          },
          {
            popover: {
              title: "🏆 Test yourself",
              description:
                "Open the Quiz tab on a song page to fill-in-the-blank chorus & verse lines and earn XP.",
            },
          },
          {
            element: "#tour-review",
            popover: {
              title: "🔁 Review Room",
              description:
                "Words you miss are sent here automatically so you can drill them with flashcards.",
            },
          },
        ],
        onDestroyed: () => localStorage.setItem(TOUR_KEY, "1"),
      });
      d.drive();
    }, 600);

    return () => clearTimeout(t);
  }, []);

  return null;
};
