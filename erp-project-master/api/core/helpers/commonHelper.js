import mongoose from "mongoose";
import { isString, isArray, isDate } from "lodash";
import humps from "humps";
import pluralize from "pluralize";
import validator from "validator";
import rescode from "rescode";

import { HELPER_TYPE } from "./businessHelper";
import BosError, { BOS_ERROR } from "./errorHelper";

export const TOKEN = {
  YEAR: "{YY}",
  MONTH: "{MM}",
  DAY: "{DD}",
  SEPARATOR: "{SEPARATOR}",
  SEQUENCE: "{SEQUENCE}",
};

export const DEFAULT_SEQUENCE_PATTERN = `${TOKEN.YEAR}${TOKEN.MONTH}${TOKEN.SEQUENCE}`;

const MONGODB_ID_LENGTH = 24;
const BASE_URL_PATTERN = /^\/v[0-9]+\/[a-zA-Z]/;
const WITH_NAMESPACE_BASE_URL_PATTERN = /^\/[a-zA-Z0-9]+\/v[0-9]+\/[a-zA-Z]/;

export const getSequenceCodeByYear = async (codePattern, sequenceLength = 3, separator = "-") => {
  if (!isString(codePattern)) {
    throw new BosError(`codePattern is not a string`, BOS_ERROR.INVALID_ARG_TYPE);
  }
  const SequenceModel = mongoose.model("sysSequences");
  const now = new Date();

  const year = now.getFullYear() % 100;
  let sequenceModel = `${codePattern}${year}`;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const codeTemplate = `${sequenceModel}${month < 10 ? "0" + month : month}${day < 10 ? "0" + day : day}`;
  sequenceModel = sequenceModel.replace(TOKEN.SEQUENCE, ""); // get unique key pattern

  let sequenceValue;
  await SequenceModel.findOne({ model: sequenceModel }, { nextValue: 1 }).then(async (sequence) => {
    if (!sequence) {
      sequenceValue = "1";
      const newSequence = new SequenceModel({ model: sequenceModel, nextValue: 2 });
      await newSequence.save();
    } else {
      sequenceValue = sequence.nextValue.toString();
      sequence.nextValue += 1;
      await sequence.save();
    }
  });

  while (sequenceValue.length < sequenceLength) {
    sequenceValue = `0${sequenceValue}`;
  }

  return `${codeTemplate}${separator}${sequenceValue}`;
};

export const getSequenceCode = async (codePattern, sequenceLength = 3, separator = "-") => {
  if (!isString(codePattern)) {
    throw new BosError(`codePattern is not a string`, BOS_ERROR.INVALID_ARG_TYPE);
  }

  const SequenceModel = mongoose.model("sysSequences");
  let sequenceModel = codePattern;
  const now = new Date();
  const replacedToken = [];

  const year = now.getFullYear() % 100;

  if (year < 10) {
    replacedToken.push({ key: TOKEN.YEAR, value: `0${year}` });
  } else {
    replacedToken.push({ key: TOKEN.YEAR, value: `${year}` });
  }

  const month = now.getMonth() + 1;
  const day = now.getDate();

  replacedToken.push({ key: TOKEN.SEPARATOR, value: separator });

  replacedToken.forEach((token) => {
    // replace all supported token
    while (sequenceModel.indexOf(token.key) > -1) {
      sequenceModel = sequenceModel.replace(token.key, token.value);
    }
  });

  let codeTemplate = sequenceModel;
  sequenceModel = sequenceModel.replace(TOKEN.SEQUENCE, ""); // get unique key pattern

  let sequenceValue;
  await SequenceModel.findOne({ model: sequenceModel }, { nextValue: 1 }).then(async (sequence) => {
    if (!sequence) {
      sequenceValue = "1";
      const newSequence = new SequenceModel({ model: sequenceModel, nextValue: 2 });
      await newSequence.save();
    } else {
      sequenceValue = sequence.nextValue.toString();
      sequence.nextValue += 1;
      await sequence.save();
    }
  });

  const lengthOfSequence = codePattern.includes(TOKEN.MONTH) || codePattern.includes(TOKEN.DAY) ? sequenceLength + 1 : sequenceLength;
  while (sequenceValue.length < lengthOfSequence) {
    sequenceValue = `0${sequenceValue}`;
  }

  codeTemplate = codeTemplate.replace(TOKEN.MONTH, month < 10 ? "0" + month : month);
  codeTemplate = codeTemplate.replace(TOKEN.DAY, day < 10 ? "0" + day : day);

  return codeTemplate.replace(TOKEN.SEQUENCE, sequenceValue);
};

export const equalToId = (id, otherId) => {
  if (!id || !otherId) {
    return false;
  }

  return id.toString() === otherId.toString();
};

export const containId = (objectList, lookUpId) => {
  if (!isArray(objectList)) {
    throw new BosError(`objectList has invalid type: ${objectList}`, BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (!lookUpId) {
    throw new BosError(`lookUpId has invalid value: ${lookUpId}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  return objectList.findIndex((f) => equalToId(f, lookUpId)) > -1;
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

  if (year1 > year2) return true;
  if (year1 < year2) return false;
  if (month1 > month2) return true;
  if (month1 < month2) return false;
  if (day1 > day2) return true;
  if (day1 < day2) return false;

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

  if (year1 > year2) return true;
  if (year1 < year2) return false;
  if (month1 > month2) return true;
  if (month1 < month2) return false;
  if (day1 > day2) return true;
  if (day1 < day2) return false;

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

  if (year1 < year2) return true;
  if (year1 > year2) return false;
  if (month1 < month2) return true;
  if (month1 > month2) return false;
  if (day1 < day2) return true;
  if (day1 > day2) return false;

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

  if (year1 < year2) return true;
  if (year1 > year2) return false;
  if (month1 < month2) return true;
  if (month1 > month2) return false;
  if (day1 < day2) return true;
  if (day1 > day2) return false;

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

  if (year1 > year2) return true;
  if (year1 < year2) return false;
  if (month1 > month2) return true;
  if (month1 < month2) return false;
  if (day1 > day2) return true;
  if (day1 < day2) return false;
  if (hour1 > hour2) return true;
  if (hour1 < hour2) return false;
  if (min1 > min2) return true;
  if (min1 < min2) return false;
  if (sec1 > sec2) return true;
  if (sec1 < sec2) return false;

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

  if (year1 > year2) return true;
  if (year1 < year2) return false;
  if (month1 > month2) return true;
  if (month1 < month2) return false;
  if (day1 > day2) return true;
  if (day1 < day2) return false;
  if (hour1 > hour2) return true;
  if (hour1 < hour2) return false;
  if (min1 > min2) return true;
  if (min1 < min2) return false;
  if (sec1 > sec2) return true;
  if (sec1 < sec2) return false;

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

  if (year1 < year2) return true;
  if (year1 > year2) return false;
  if (month1 < month2) return true;
  if (month1 > month2) return false;
  if (day1 < day2) return true;
  if (day1 > day2) return false;
  if (hour1 < hour2) return true;
  if (hour1 > hour2) return false;
  if (min1 < min2) return true;
  if (min1 > min2) return false;
  if (sec1 < sec2) return true;
  if (sec1 > sec2) return false;

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

  if (year1 < year2) return true;
  if (year1 > year2) return false;
  if (month1 < month2) return true;
  if (month1 > month2) return false;
  if (day1 < day2) return true;
  if (day1 > day2) return false;
  if (hour1 < hour2) return true;
  if (hour1 > hour2) return false;
  if (min1 < min2) return true;
  if (min1 > min2) return false;
  if (sec1 < sec2) return true;
  if (sec1 > sec2) return false;

  return true;
};

export const isObjectId = (id) => id && String(id).length === MONGODB_ID_LENGTH;

export const isEmail = (email) => email && validator.isEmail(email);

export const isPhone = (phone) => phone && validator.isMobilePhone(phone);

export const isUpperCase = (text) => {
  if (!isString(text)) {
    throw new BosError("given value is not a character.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (text === text.toUpperCase()) {
    return true;
  }

  return false;
};

export const isLowerCase = (text) => {
  if (!isString(text)) {
    throw new BosError("given value is not a character.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (text === text.toLowerCase()) {
    return true;
  }

  return false;
};

export const parseBaseUrl = (baseUrl) => {
  const isNormalBaseUrl = BASE_URL_PATTERN.test(baseUrl);
  const isWithNamespaceBaseUrl = WITH_NAMESPACE_BASE_URL_PATTERN.test(baseUrl);

  if (!isNormalBaseUrl && !isWithNamespaceBaseUrl) {
    throw new BosError(`baseUrl '${baseUrl}' is not correct.`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  let startOfVersion;
  let endOfVersion;
  let startOfModelName;
  let endOfModelName;
  let modelName = "";
  let version = "";

  if (isNormalBaseUrl) {
    startOfVersion = 1;
  } else {
    startOfVersion = baseUrl.indexOf("/", 1) + 1;
  }

  endOfVersion = baseUrl.indexOf("/", startOfVersion);
  version = baseUrl.substring(startOfVersion, endOfVersion).replace(/[v\/]/g, "");

  startOfModelName = endOfVersion + 1;
  endOfModelName = baseUrl.indexOf("/", startOfModelName);
  modelName = baseUrl.substring(startOfModelName, endOfModelName > -1 ? endOfModelName : undefined).replace(/\//g, "");

  return { modelName, version };
};

export const pascalizeAndSingular = (modelName) => {
  return pluralize.singular(humps.pascalize(modelName));
};

export const getServiceCode = (modelName, version) => {
  if (!modelName) {
    throw new BosError("modelName is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return `v${version || "1"}/${modelName}`;
};

export const convertString2Array = (stringValue, separator = ",") => {
  if (isArray(stringValue)) {
    return stringValue;
  }

  if (!isString(stringValue)) {
    throw new BosError("stringValue is not a string.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return stringValue.replace(/\s/g, "").split(separator); // remove all space & split string
};

export const genQrCode = (poNumber) => {
  rescode.loadModules(["qrcode"]);
  const qrCode = rescode.create("qrcode", poNumber, { includetext: false }).toString("base64");
  return qrCode;
};

export const genBarCode = (poNumber) => {
  rescode.loadModules(["code128"], { includetext: true });
  const barCode = rescode.create("code128", poNumber, { includetext: true, scaleX: 1, scaleY: 0.45 }).toString("base64");
  return barCode;
};

export const getCreatedDateHelper = (createdAt) => {
  let strDateTime = "";

  const time = new Date(createdAt);
  const year = time.getFullYear();
  const month = time.getMonth() + 1;
  const day = time.getDate();

  strDateTime = "Ngày " + day + " tháng " + month + " năm " + year;

  return strDateTime;
};

// http://dotnet.edu.vn/ChuyenMuc/Ham-doc-number-bang-chu--Javascript-172.aspx
const NUMBER = new Array(" không ", " một ", " hai ", " ba ", " bốn ", " năm ", " sáu ", " bảy ", " tám ", " chín ");
const UNIT_MONEY = new Array("", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ");

//1. Hàm đọc số có ba chữ số;
const readThreeDigitNumber = (number) => {
  let hundreds;
  let tens;
  let units;
  let result = "";

  hundreds = parseInt(number / 100);
  tens = parseInt((number % 100) / 10);
  units = number % 10;

  if (hundreds == 0 && tens == 0 && units == 0) return "";

  if (hundreds != 0) {
    result += NUMBER[hundreds] + " trăm ";
    if (tens == 0 && units != 0) result += " linh ";
  }

  if (tens != 0 && tens != 1) {
    result += NUMBER[tens] + " mươi";
    if (tens == 0 && units != 0) result = result + " linh ";
  }

  if (tens == 1) result += " mười ";

  switch (units) {
    case 1:
      if (tens != 0 && tens != 1) {
        result += " mốt ";
      } else {
        result += NUMBER[units];
      }
      break;

    case 5:
      if (tens == 0) {
        result += NUMBER[units];
      } else {
        result += " lăm ";
      }
      break;

    default:
      if (units != 0) {
        result += NUMBER[units];
      }
      break;
  }

  return result;
};

//2. Hàm đọc số thành chữ (Sử dụng hàm đọc số có ba chữ số)
const readMoney = (amount) => {
  let count = 0;
  let i = 0;
  let number = 0;
  let result = "";
  let tmp = "";
  let pointer = new Array();

  if (amount < 0) return "Số tiền âm !";
  if (amount == 0) return "Không đồng !";

  number = amount > 0 ? amount : -amount;

  if (amount > 8999999999999999) {
    return "Số quá lớn!";
  }

  pointer[5] = Math.floor(number / 1000000000000000);

  if (isNaN(pointer[5])) pointer[5] = "0";

  number = number - parseFloat(pointer[5].toString()) * 1000000000000000;

  pointer[4] = Math.floor(number / 1000000000000);

  if (isNaN(pointer[4])) pointer[4] = "0";

  number = number - parseFloat(pointer[4].toString()) * 1000000000000;

  pointer[3] = Math.floor(number / 1000000000);

  if (isNaN(pointer[3])) pointer[3] = "0";

  number = number - parseFloat(pointer[3].toString()) * 1000000000;

  pointer[2] = parseInt(number / 1000000);

  if (isNaN(pointer[2])) pointer[2] = "0";

  pointer[1] = parseInt((number % 1000000) / 1000);

  if (isNaN(pointer[1])) pointer[1] = "0";

  pointer[0] = parseInt(number % 1000);

  if (isNaN(pointer[0])) pointer[0] = "0";

  if (pointer[5] > 0) {
    count = 5;
  } else if (pointer[4] > 0) {
    count = 4;
  } else if (pointer[3] > 0) {
    count = 3;
  } else if (pointer[2] > 0) {
    count = 2;
  } else if (pointer[1] > 0) {
    count = 1;
  } else {
    count = 0;
  }

  for (i = count; i >= 0; i--) {
    tmp = readThreeDigitNumber(pointer[i]);
    result += tmp;
    if (pointer[i] > 0) result += UNIT_MONEY[i];
    if (i > 0 && tmp.length > 0) result += ","; //&& (!string.IsNullOrEmpty(tmp))
  }

  if (result.substring(result.length - 1) == ",") {
    result = result.substring(0, result.length - 1);
  }

  result = result.substring(1, 2).toUpperCase() + result.substring(2) + " đồng";

  return result; //.substring(0, 1);//.toUpperCase();// + result.substring(1);
};

export const convertNumberToMoney = (totalAmount) => {
  return readMoney(totalAmount);
};

export const getEnv = (param) => {
  return process.env[param];
};

export const isAsyncFunction = (func) => {
  const string = func.toString().trim();

  return !!(
    // native
    (
      string.match(/^async /) ||
      // babel (this may change, but hey...)
      string.match(/return _ref[^\.]*\.apply/)
    )
    // insert your other dirty transpiler check

    // there are other more complex situations that maybe require you to check the return line for a *promise*
  );
};

const helperList = [
  {
    name: "QR_CODE",
    type: HELPER_TYPE.HANDLEBARS_HELPER,
    helper: genQrCode,
  },
  {
    name: "BAR_CODE",
    type: HELPER_TYPE.HANDLEBARS_HELPER,
    helper: genBarCode,
  },
  {
    name: "GET_CREATED_DATE",
    type: HELPER_TYPE.HANDLEBARS_HELPER,
    helper: getCreatedDateHelper,
  },
  {
    name: "CONVERT_NUMBER_TO_MONEY",
    type: HELPER_TYPE.HANDLEBARS_HELPER,
    helper: convertNumberToMoney,
  },
  {
    name: "ENV",
    type: HELPER_TYPE.HANDLEBARS_HELPER,
    helper: getEnv,
  },
];

export default helperList;
