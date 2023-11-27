import date from "date-and-time";
import i18n from "../services/i18n";

export const HELPER_TYPE = {
  HANDLEBARS_HELPER: "handlebarsHelper",
  HANDLEBARS_PARTIAL: "handlebarsPartial",
};

export const dateFormat = (value) => (value ? date.format(new Date(value), "DD/MM/YYYY") : "...../...../..........");
export const dateTimeFormat = (value) => (value ? date.format(new Date(value), "DD/MM/YYYY HH:mm") : "...../...../.......... ..... / .....");
export const numberFormat = (value) => (value || value === 0 ? new Intl.NumberFormat("vi-VN").format(value) : "");
export const indexFormat = (index) => (index ? index + 1 : 1);
export const booleanFormat = (value) => (value ? "x" : "");
export const translateFormat = (value) => (value ? i18n.t(value) : "");
