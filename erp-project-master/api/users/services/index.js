import i18n from "i18next";
import ICU from "i18next-icu";
import systemEn from "../../i18n/en/system.json";
import systemVi from "../../i18n/vi/system.json";
import commonEn from "./i18n/en/common.json";
import commonVi from "./i18n/vi/common.json";

i18n.init({
  lng: "vi", // language to use
  fallbackLng: "en",

  namespaces: ["system", "common"],
  defaultNS: "common",
  fallbackNS: "system",

  resources: {
    en: {
      system: systemEn,
      common: commonEn,
    },
    vi: {
      system: systemVi,
      common: commonVi,
    },
  },
});

export default i18n;
