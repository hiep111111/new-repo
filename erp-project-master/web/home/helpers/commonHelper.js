/* eslint-disable no-useless-escape */
/* eslint-disable no-control-regex */
import { isArray, isDate, isString, isUndefined } from "lodash";
import validator from "validator";
import i18n from "../i18n";

import { SEPARATE_STRING } from "../constants/config";
import { DATA_TYPE } from "../constants/dataType";
import BosError, { BOS_ERROR } from "./errorHelper";

const SESSION_JWT_KEY = "jwtToken";
const SESSION_USER_ID_KEY = "userId";
const SESSION_USER_NAME_KEY = "userName";
const SESSION_FULL_NAME_KEY = "fullName";
const SESSION_EMPLOYEE_NO_KEY = "employeeNo";
const SESSION_FUNCTION_ID_KEY = "functionId";
const SESSION_FUNCTION_NAME_KEY = "functionName";
const SESSION_MODULE_ID_KEY = "moduleId";
const SESSION_MODULE_CODE_KEY = "moduleCode";
const SESSION_CURRENT_LANGUAGE_KEY = "currentLanguage";

export const EMPTY_OPTION_TEXT = i18n.t ? i18n.t("selection.chooseOne", { ns: "system" }) : "-";
export const INSTANT_SEARCH_TEXT = i18n.t ? i18n.t("selection.searchOne", { ns: "system" }) : "...";
export const toNumericString = (number) => (number ? number.toLocaleString("de-DE") : "");
export const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0));

export function getDefaultValue(dataType, defaultValue) {
  let value;

  if (!isUndefined(defaultValue)) {
    value = defaultValue;
  } else {
    switch (dataType) {
      case DATA_TYPE.COMPANY_ID:
      case DATA_TYPE.ID: {
        value = null;
        break;
      }

      case DATA_TYPE.BOOLEAN:
      case DATA_TYPE.BOOL: {
        value = null;
        break;
      }

      case DATA_TYPE.ARRAY: {
        value = [];
        break;
      }

      case DATA_TYPE.OBJECT: {
        value = {};
        break;
      }

      case DATA_TYPE.GL_DATE:
      case DATA_TYPE.DATE:
      case DATA_TYPE.DATE_TIME: {
        value = null;
        break;
      }

      case DATA_TYPE.DESC_STRING:
      case DATA_TYPE.STRING: {
        value = "";
        break;
      }

      default: {
        value = "";
        break;
      }
    }
  }

  return value;
}

export const convertDataText = (code, name) => {
  return `${code}${SEPARATE_STRING}${name}`;
};

export const convertCodeAndName = (dataText) => {
  if (!dataText) {
    throw new BosError("code is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const separatePosition = dataText.indexOf(SEPARATE_STRING);

  if (separatePosition < 0) {
    throw new BosError("dataText is invalid", BOS_ERROR.INVALID_ARG_VALUE);
  }

  let code = "";
  let name = "";

  if (separatePosition > 0) {
    code = dataText.substring(0, separatePosition);
    name = dataText.substring(separatePosition + SEPARATE_STRING.length);
  }

  return { code, name };
};

export const getDataSelectedText = (selectedValue, options) => {
  if (!selectedValue) {
    throw new BosError("selectedValue is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isArray(options)) {
    throw new BosError("selectedValue is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  for (let i = 0; i < options.length; i += 1) {
    const option = options[i];
    if (option.value === selectedValue) {
      return option.text;
    }
  }

  return null;
};

export const convertDataListOptionList = (objectList, keyField, codeField, nameField) => {
  if (!isArray(objectList)) {
    throw new BosError("objectList is not an array", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!keyField) {
    throw new BosError("keyField is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!codeField) {
    throw new BosError("codeField is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const optionList = [];

  objectList.forEach((obj) => {
    const item = {};

    item.key = obj[keyField];
    item.value = obj[keyField];
    item.text = nameField ? convertDataText(obj[codeField], obj[nameField]) : obj[codeField];

    optionList.push(item);
  });

  const item = {};

  item.key = "";
  item.value = null;
  item.text = EMPTY_OPTION_TEXT;

  optionList.push(item);

  return optionList;
};

export const convertDataListInstantSearchOptionList = (objectList, valueField = "_id", codeField = "", nameField = "") => {
  if (!isArray(objectList)) {
    return [];
  }

  const optionList = [];

  objectList.forEach((obj) => {
    const item = {};
    const shownText = nameField ? convertDataText(obj[codeField], obj[nameField]) : obj[codeField];

    item.value = obj[valueField];
    item.text = shownText;
    item.title = shownText;

    optionList.push(item);
  });

  const item = {};

  item.key = "";
  item.value = null;
  item.title = INSTANT_SEARCH_TEXT;

  optionList.push(item);

  return optionList;
};

export const isSerial = (serial) => {
  const regularExpression = /[A-Za-z0-9\-]{5,50}/;

  return regularExpression.test(serial);
};

export const isEmail = (email) => validator.isEmail(email);

export const isPhone = (phone) => validator.isMobilePhone(phone);

export const isObjectId = (id) => {
  // follow https://klequis.io/whats-a-valid-mongodb-id/
  try {
    if (!id) {
      return false;
    }

    const objectIdPattern = new RegExp("^[0-9a-fA-F]{24}$");
    return objectIdPattern.test(id.toString());
  } catch (e) {
    return false;
  }
};

export const setToken = (token) => localStorage.setItem(SESSION_JWT_KEY, token);

export const getToken = () => (localStorage ? localStorage.getItem(SESSION_JWT_KEY) : null);

export const removeToken = () => (localStorage ? localStorage.removeItem(SESSION_JWT_KEY) : null);

export const setUserId = (userId) => localStorage.setItem(SESSION_USER_ID_KEY, userId);

export const getUserId = () => (localStorage ? localStorage.getItem(SESSION_USER_ID_KEY) : null);

export const setUserName = (userName) => localStorage.setItem(SESSION_USER_NAME_KEY, userName);

export const getUserName = () => (localStorage ? localStorage.getItem(SESSION_USER_NAME_KEY) : null);

export const setFullName = (fullName) => localStorage.setItem(SESSION_FULL_NAME_KEY, fullName);

export const getFullName = () => (localStorage ? localStorage.getItem(SESSION_FULL_NAME_KEY) : null);

export const setEmployeeNo = (employeeNo) => localStorage.setItem(SESSION_EMPLOYEE_NO_KEY, employeeNo);

export const getEmployeeNo = () => (localStorage ? localStorage.getItem(SESSION_EMPLOYEE_NO_KEY) : null);

export const setFunctionId = (functionId) => localStorage.setItem(SESSION_FUNCTION_ID_KEY, functionId);

export const getFunctionId = () => (localStorage ? localStorage.getItem(SESSION_FUNCTION_ID_KEY) : null);

export const setFunctionName = (functionId) => localStorage.setItem(SESSION_FUNCTION_NAME_KEY, functionId);

export const getFunctionName = () => (localStorage ? localStorage.getItem(SESSION_FUNCTION_NAME_KEY) : null);

export const setModuleId = (moduleId) => localStorage.setItem(SESSION_MODULE_ID_KEY, moduleId);

export const getModuleId = () => localStorage.getItem(SESSION_MODULE_ID_KEY);

export const setModuleCode = (moduleName) => localStorage.setItem(SESSION_MODULE_CODE_KEY, moduleName);

export const getModuleCode = () => localStorage.getItem(SESSION_MODULE_CODE_KEY);

export const setCurrentLanguage = (currentLanguage) => localStorage.setItem(SESSION_CURRENT_LANGUAGE_KEY, currentLanguage);

export const getCurrentLanguage = () => localStorage.getItem(SESSION_CURRENT_LANGUAGE_KEY);

export const getInputValue = (data) => {
  if (!data) {
    throw new BosError("data is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const { type, name, value, checked, options } = data;

  return {
    name,
    options,
    value: type === "radio" || type === "checkbox" ? checked : value,
  };
};

export const equalToId = (id, otherId) => {
  if (!id || !otherId) {
    return false;
  }

  return id.toString() === otherId.toString();
};

export const containsId = (objectList, lookUpId) => {
  if (!isArray(objectList)) {
    throw new BosError("objectList is not an array", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isObjectId(lookUpId)) {
    throw new BosError("lookUpId is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return objectList.findIndex((f) => equalToId(f, lookUpId)) > -1;
};

export const getFieldAttribute = (self, name) => {
  if (!self) {
    throw new BosError("self is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!name) {
    throw new BosError("name is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const splittedNameList = name.split("."); // fieldName.index.subFieldName
  const { model, query, object } = self.state;

  let fieldType;
  let fieldValue;

  if (splittedNameList.length < 3) {
    // single field or field with '$gt' / '$lt'
    fieldType = model[name];
    fieldValue = query ? query[name] : object[name];
  } else {
    const fieldName = splittedNameList[0];
    const index = splittedNameList[1];
    const subFieldName = splittedNameList[2];

    fieldType = model[fieldName].subModel[subFieldName];

    fieldValue = query ? query[fieldName][index][subFieldName] : object[fieldName][index][subFieldName];
  }

  return {
    fieldType,
    fieldValue,
  };
};

export const getDaysBetweenDate = (date1, date2) => {
  if (!isDate(date1)) {
    throw new BosError("date1 is a date", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(date2)) {
    throw new BosError("self is a date", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 3600 * 24));
};

export const convertStringToArray = (text, separator = ",") => {
  if (!isString(text)) {
    throw new BosError(`text parram ${text} is not a string`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  return text.replace(/\s/g, "").split(separator);
};

export const removeAccents = (text) => {
  if (!isString(text)) {
    throw new BosError(`text parram ${text} is not a string`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

export const convertToOptionList = (valueList) => {
  let arrayValueList = isArray(valueList) ? valueList : Object.values(valueList); // [..] valueList can be an object
  const optionList = [];

  arrayValueList.forEach((value) => {
    const item = {
      key: value,
      value: value,
      text: value,
    };

    optionList.push(item);
  });

  optionList.push({
    key: "",
    value: null,
    text: EMPTY_OPTION_TEXT,
  });

  return optionList;
};

export const convertToI18nOptionList = (i18nInstant, valueList) => {
  if (!i18nInstant || !i18nInstant.t) {
    throw new BosError("i18nInstant is incorrect", BOS_ERROR.INVALID_ARG_VALUE);
  }

  let arrayValueList = isArray(valueList) ? valueList : Object.values(valueList); // [..] valueList can be an object

  const optionList = [];

  arrayValueList.forEach((value) => {
    const item = {
      key: value,
      value: value,
      text: i18nInstant ? i18nInstant.t(value, { ns: "common" }) : value,
    };

    optionList.push(item);
  });

  optionList.push({
    key: "",
    value: null,
    text: EMPTY_OPTION_TEXT,
  });

  return optionList;
};

export const equalToDate = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();

  return year1 === year2 && month1 === month2 && day1 === day2;
};

export const greaterThanDate = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();

  if (year1 > year2) {
    return true;
  }

  if (year1 < year2) {
    return false;
  }

  if (month1 > month2) {
    return true;
  }

  if (month1 < month2) {
    return false;
  }

  if (day1 > day2) {
    return true;
  }

  if (day1 < day2) {
    return false;
  }

  return false;
};

export const greaterThanOrEqualToDate = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();

  if (year1 > year2) {
    return true;
  }

  if (year1 < year2) {
    return false;
  }

  if (month1 > month2) {
    return true;
  }

  if (month1 < month2) {
    return false;
  }

  if (day1 > day2) {
    return true;
  }

  if (day1 < day2) {
    return false;
  }

  return true;
};

export const lessThanDate = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();

  if (year1 < year2) {
    return true;
  }

  if (year1 > year2) {
    return false;
  }

  if (month1 < month2) {
    return true;
  }

  if (month1 > month2) {
    return false;
  }

  if (day1 < day2) {
    return true;
  }

  if (day1 > day2) {
    return false;
  }

  return false;
};

export const lessThanOrEqualToDate = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();

  if (year1 < year2) {
    return true;
  }

  if (year1 > year2) {
    return false;
  }

  if (month1 < month2) {
    return true;
  }

  if (month1 > month2) {
    return false;
  }

  if (day1 < day2) {
    return true;
  }

  if (day1 > day2) {
    return false;
  }

  return true;
};

export const equalToDateTime = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const mon1 = d1.getMonth();
  const day1 = d1.getDate();
  const hour1 = d1.getHours();
  const min1 = d1.getMinutes();
  const sec1 = d1.getSeconds();

  const year2 = d2.getFullYear();
  const mon2 = d2.getMonth();
  const day2 = d2.getDate();
  const hour2 = d2.getHours();
  const min2 = d2.getMinutes();
  const sec2 = d2.getSeconds();

  return year1 === year2 && mon1 === mon2 && day1 === day2 && hour1 === hour2 && min1 === min2 && sec1 === sec2;
};

export const greaterThanDateTime = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();
  const hour1 = d1.getHours();
  const min1 = d1.getMinutes();
  const sec1 = d1.getSeconds();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();
  const hour2 = d2.getHours();
  const min2 = d2.getMinutes();
  const sec2 = d2.getSeconds();

  if (year1 > year2) {
    return true;
  }

  if (year1 < year2) {
    return false;
  }

  if (month1 > month2) {
    return true;
  }

  if (month1 < month2) {
    return false;
  }

  if (day1 > day2) {
    return true;
  }

  if (day1 < day2) {
    return false;
  }

  if (hour1 > hour2) {
    return true;
  }

  if (hour1 < hour2) {
    return false;
  }

  if (min1 > min2) {
    return true;
  }

  if (min1 < min2) {
    return false;
  }

  if (sec1 > sec2) {
    return true;
  }

  if (sec1 < sec2) {
    return false;
  }

  return false;
};

export const greaterThanOrEqualToDateTime = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();
  const hour1 = d1.getHours();
  const min1 = d1.getMinutes();
  const sec1 = d1.getSeconds();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();
  const hour2 = d2.getHours();
  const min2 = d2.getMinutes();
  const sec2 = d2.getSeconds();

  if (year1 > year2) {
    return true;
  }

  if (year1 < year2) {
    return false;
  }

  if (month1 > month2) {
    return true;
  }

  if (month1 < month2) {
    return false;
  }

  if (day1 > day2) {
    return true;
  }

  if (day1 < day2) {
    return false;
  }

  if (hour1 > hour2) {
    return true;
  }

  if (hour1 < hour2) {
    return false;
  }

  if (min1 > min2) {
    return true;
  }

  if (min1 < min2) {
    return false;
  }

  if (sec1 > sec2) {
    return true;
  }

  if (sec1 < sec2) {
    return false;
  }

  return true;
};

export const lessThanDateTime = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();
  const hour1 = d1.getHours();
  const min1 = d1.getMinutes();
  const sec1 = d1.getSeconds();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();
  const hour2 = d2.getHours();
  const min2 = d2.getMinutes();
  const sec2 = d2.getSeconds();

  if (year1 < year2) {
    return true;
  }

  if (year1 > year2) {
    return false;
  }

  if (month1 < month2) {
    return true;
  }

  if (month1 > month2) {
    return false;
  }

  if (day1 < day2) {
    return true;
  }

  if (day1 > day2) {
    return false;
  }

  if (hour1 < hour2) {
    return true;
  }

  if (hour1 > hour2) {
    return false;
  }

  if (min1 < min2) {
    return true;
  }

  if (min1 > min2) {
    return false;
  }

  if (sec1 < sec2) {
    return true;
  }

  if (sec1 > sec2) {
    return false;
  }

  return false;
};

export const lessThanOrEqualToDateTime = (d1, d2) => {
  if (!isDate(d1)) {
    throw new BosError(`d1 has invalid type: ${d1}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isDate(d2)) {
    throw new BosError(`d2 has invalid type: ${d2}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const year1 = d1.getFullYear();
  const month1 = d1.getMonth();
  const day1 = d1.getDate();
  const hour1 = d1.getHours();
  const min1 = d1.getMinutes();
  const sec1 = d1.getSeconds();

  const year2 = d2.getFullYear();
  const month2 = d2.getMonth();
  const day2 = d2.getDate();
  const hour2 = d2.getHours();
  const min2 = d2.getMinutes();
  const sec2 = d2.getSeconds();

  if (year1 < year2) {
    return true;
  }

  if (year1 > year2) {
    return false;
  }

  if (month1 < month2) {
    return true;
  }

  if (month1 > month2) {
    return false;
  }

  if (day1 < day2) {
    return true;
  }

  if (day1 > day2) {
    return false;
  }

  if (hour1 < hour2) {
    return true;
  }

  if (hour1 > hour2) {
    return false;
  }

  if (min1 < min2) {
    return true;
  }

  if (min1 > min2) {
    return false;
  }

  if (sec1 < sec2) {
    return true;
  }

  if (sec1 > sec2) {
    return false;
  }

  return true;
};
