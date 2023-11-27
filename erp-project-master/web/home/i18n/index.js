import i18next from "i18next";
import ICU from "i18next-icu";
import systemEn from "./en/system.json";
import systemVi from "./vi/system.json";

i18next.use(new ICU()).init({
  interpolation: { escapeValue: false }, // React already does escaping

  lng: "vi", // language to use
  fallbackLng: "en",

  namespaces: ["system"],
  defaultNS: "system",
  fallbackNS: "system",

  resources: {
    en: {
      system: systemEn,
    },
    vi: {
      system: systemVi,
    },
  },
});

export default i18next;
