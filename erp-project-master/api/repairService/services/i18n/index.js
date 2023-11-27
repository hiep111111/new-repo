import i18n from 'i18next';
import ICU from 'i18next-icu';
import vi from 'i18next-icu/locale-data/vi';
import en from 'i18next-icu/locale-data/en';
import systemEn from '../../i18n/en/system.json';
import systemVi from '../../i18n/vi/system.json';
import commonEn from './en/common.json';
import commonVi from './vi/common.json';

i18n.use(
    new ICU({
      localeData: [vi, en], // you also can pass in array of localeData
    }))
  .init({
    lng: 'vi', // language to use
    fallbackLng: 'en',

    namespaces: ['system', 'common'],
    defaultNS: 'common',
    fallbackNS: 'system',

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
