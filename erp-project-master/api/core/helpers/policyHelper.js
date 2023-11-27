import { isObject, intersection, isArray, difference, isUndefined, isString, uniqWith, isEqual } from "lodash";
import mongoose from "mongoose";
import debug from "debug";

import {
  isObjectId,
  equalToDate,
  greaterThanDate,
  greaterThanOrEqualToDate,
  lessThanDate,
  lessThanOrEqualToDate,
  equalToDateTime,
  greaterThanDateTime,
  greaterThanOrEqualToDateTime,
  lessThanDateTime,
  lessThanOrEqualToDateTime,
  convertString2Array,
} from "./commonHelper";
import BosError, { BOS_ERROR } from "./errorHelper";
import { DATA_TYPE } from "../constants/dataTypeConstant";
import { OPERATOR } from "../constants/mathOperator";

const appBizDebugger = debug("app:biz");

export const getUserAccessList = (userFeature, policy) => {
  if (!isObject(userFeature)) {
    throw new BosError("userFeature is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isObject(policy)) {
    throw new BosError("policy is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  let related = true;

  const {
    _id: policyId, // data received via Rabbit MQ so Object become Text => have to restore data type
    policyName,
    functionId,
    functionUrl,
    functionName,
    context,
    serviceId,
    serviceCode,
    serviceName,
    actionCode,
    path,
    method,
    allowedRequestFieldList,
    allowedResponseFieldList,
    recordFeatureList,
    apiFeatureList,
    userFeatureList,
  } = policy;

  if (userFeatureList.length) {
    // effect to ALL USER
    for (let i = 0; i < userFeatureList.length && related; i += 1) {
      const { featureName, selectedOperator, selectedValueList } = userFeatureList[i]; // policy's userFeatureList

      const feature = userFeature.userFeatureList.find((f) => f.featureName === featureName); // user's userFeature
      const featureValue = feature.value;

      if (feature) {
        switch (selectedOperator) {
          case OPERATOR.IN: {
            related = intersection(featureValue, selectedValueList).length > 0;
            break;
          }

          case OPERATOR.NOT_IN: {
            related = intersection(featureValue, selectedValueList).length === 0;
            break;
          }

          case OPERATOR.EQ: {
            related = String(featureValue) === String(selectedValueList); // objectId, array,.. compare
            break;
          }

          case OPERATOR.NE: {
            related = String(featureValue) !== String(selectedValueList); // objectId, array,.. compare
            break;
          }

          default: {
            break;
          }
        }
      } else {
        related = false;
      }
    } // for (let i = 0; i < userFeatureList.length && related; i +=1)
  }

  if (!related) {
    return null;
  }

  const { userId, userName, fullName } = userFeature;

  return {
    userId,
    userName,
    fullName,
    active: true,
    deleted: false,

    // userFeatureList: userFeature.userFeatureList,

    policyId: mongoose.Types.ObjectId(policyId), // data received via Rabbit MQ so Object become Text => have to restore data type
    policyName,

    functionId: mongoose.Types.ObjectId(functionId), // data received via Rabbit MQ so Object become Text => have to restore data type
    functionUrl,
    functionName,

    context,

    serviceId: mongoose.Types.ObjectId(serviceId), // data received via Rabbit MQ so Object become Text => have to restore data type
    serviceCode,
    serviceName,

    actionCode,
    path,
    method,

    allowedRequestFieldList,
    allowedResponseFieldList,

    recordFeatureList,
    apiFeatureList: apiFeatureList || [],
  };
};

export const checkFieldPermission = (requestFieldList, allowedFieldList) => {
  appBizDebugger("checkFieldPermission");

  if (!isArray(requestFieldList)) {
    throw new BosError("requestFieldList  is not an array.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (!isArray(allowedFieldList)) {
    throw new BosError("allowedFieldList is not an array.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (requestFieldList.length === 0) {
    appBizDebugger("requestFieldList is empty => return true.");
    return true;
  }

  if (allowedFieldList.length === 0) {
    appBizDebugger("allowedFieldList is empty => return false.");
    return false;
  }

  const differenceFields = difference(requestFieldList, allowedFieldList);

  appBizDebugger("requestFieldList: ", JSON.stringify(requestFieldList));
  appBizDebugger("allowedFieldList: ", JSON.stringify(allowedFieldList));
  appBizDebugger("checkFieldPermission => not allowed fields: ", JSON.stringify(differenceFields));

  return differenceFields.length == 0;
};

export const checkRecordPermission = (record, userFeatureList, recordFeatureList) => {
  appBizDebugger("checkRecordPermission starts...");

  if (!isObject(record)) {
    throw new BosError(`record is not an object (${record}).`, BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (!isArray(userFeatureList)) {
    throw new BosError("userFeatureList is not an array.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (!isArray(recordFeatureList)) {
    throw new BosError("recordFeatureList is not an array.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (recordFeatureList.length === 0) {
    appBizDebugger("recordFeatureList is empty => return true.");
    return true;
  }

  let i = 0;
  const featureCount = recordFeatureList.length;

  for (i = 0; i < featureCount; i += 1) {
    const { featureName, type, selectedOperator, isUserFeature, selectedValueList } = recordFeatureList[i];

    appBizDebugger(`featureName: ${featureName}`);
    appBizDebugger(`record: ${record}`);

    const splittedNameList = featureName.split(".");
    const isNestedField = splittedNameList.length > 1;

    const fieldValue = isNestedField ? record[splittedNameList[0]] : record[featureName];

    if (isUndefined(fieldValue)) {
      appBizDebugger("fieldValue is undefined => skip."); // [..] cause of check permission of list (not based on object) case
      continue;
    }

    let operatedByValue;

    if (isUserFeature) {
      if (!selectedValueList || selectedValueList.length === 0) {
        // compatibility with ARRAY & STRING
        appBizDebugger("selectedValueList is empty => return false.");
        return false;
      }

      const featureName = isArray(selectedValueList) ? selectedValueList[0] : selectedValueList;
      appBizDebugger(`find userFeatureList by featureName: ${featureName}`);

      const userFeature = userFeatureList.find((f) => f.featureName === featureName);

      if (isUndefined(userFeature)) {
        appBizDebugger("userFeature is undefined => return false.");
        return false;
      } else {
        operatedByValue = userFeature.value;
        appBizDebugger(`userFeature existed => operatedByValue = userFeature.value: ${operatedByValue}`);
      }
    } else {
      // if (isUserFeature)
      operatedByValue = isArray(selectedValueList) ? selectedValueList : convertString2Array(selectedValueList);
    } // if (isUserFeature)

    const operatedByFirstValue = operatedByValue[0];

    if (isUndefined(operatedByFirstValue)) {
      appBizDebugger("operatedByFirstValue is undefined => return false.");
      return false;
    }

    if (isNestedField) {
      const nestedFieldName = splitedNameList[1];

      return checkNestedFieldPermission(fieldValue, nestedFieldName, operatedByValue, selectedOperator, type);
    }

    const fieldValueInArrayFormat = isArray(fieldValue) ? fieldValue : [fieldValue.toString()];

    switch (selectedOperator) {
      case OPERATOR.EQ: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (fieldValue !== Number(operatedByFirstValue)) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (!equalToDate(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (!equalToDateTime(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          default: {
            if (fieldValue.toString() !== operatedByFirstValue.toString()) {
              return false;
            }

            break;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.NE: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (fieldValue === Number(operatedByFirstValue)) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (equalToDate(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (equalToDateTime(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          default: {
            if (fieldValue.toString() === operatedByFirstValue.toString()) {
              return false;
            }
            break;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.GT: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (fieldValue <= Number(operatedByFirstValue)) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (!greaterThanDate(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (!greaterThanDateTime(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          default: {
            return false;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.GTE: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (fieldValue < Number(operatedByFirstValue)) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (!greaterThanOrEqualToDate(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (!greaterThanOrEqualToDateTime(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          default: {
            return false;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.LT: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (fieldValue >= Number(operatedByFirstValue)) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (!lessThanDate(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (!lessThanDateTime(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          default: {
            return false;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.LTE: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (fieldValue > Number(operatedByFirstValue)) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (!lessThanOrEqualToDate(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (!lessThanOrEqualToDateTime(fieldValue, new Date(operatedByFirstValue))) {
              return false;
            }

            break;
          }

          default: {
            return false;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.EXISTS: {
        if (intersection(fieldValueInArrayFormat, operatedByValue).length === 0) {
          return false;
        }

        break;
      }

      case OPERATOR.IN: {
        appBizDebugger(`operatedByValue: ${operatedByValue}`);
        appBizDebugger(`fieldValue: ${fieldValue}`);

        if (!operatedByValue.find((v) => String(v) === String(fieldValue))) {
          // [!] indexOf NOT working
          appBizDebugger(`fieldValue NOT IN operatedByValue => return false`);
          return false;
        }

        break;
      }

      case OPERATOR.NOT_IN: {
        appBizDebugger(`operatedByValue: ${operatedByValue}`);
        appBizDebugger(`fieldValue: ${fieldValue}`);

        if (operatedByValue.find((v) => String(v) === String(fieldValue))) {
          // [!] indexOf NOT working
          appBizDebugger(`fieldValue IN operatedByValue => return true`);
          return false;
        }

        break;
      }
    } // switch (selectedOperator)
  } // for (i = 0; i < featureCount; i += 1)

  appBizDebugger("checkRecordPermission ends.");

  return i >= featureCount; // check all field
};

const checkNestedFieldPermission = (fieldValue, nestedFieldName, operatedByValue, selectedOperator, type) => {
  if (!isArray(fieldValue)) {
    return false;
  }

  const operatedByFirstValue = operatedByValue[0];
  let valid = false;

  // only one valid is true
  for (let i = 0; i < fieldValue.length; i++) {
    const nestedFieldValue = fieldValue[i][nestedFieldName];

    if (isUndefined(nestedFieldValue)) {
      continue;
    }

    switch (selectedOperator) {
      case OPERATOR.EQ: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (nestedFieldValue === Number(operatedByFirstValue)) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (equalToDate(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (equalToDateTime(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          default: {
            if (nestedFieldValue.toString() === operatedByFirstValue.toString()) {
              valid = true;
            }

            break;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.NE: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (nestedFieldValue !== Number(operatedByFirstValue)) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (!equalToDate(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (!equalToDateTime(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          default: {
            if (nestedFieldValue.toString() !== operatedByFirstValue.toString()) {
              valid = true;
            }

            break;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.GT: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (nestedFieldValue > Number(operatedByFirstValue)) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (greaterThanDate(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (greaterThanDateTime(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.GTE: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (nestedFieldValue >= Number(operatedByFirstValue)) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (greaterThanOrEqualToDate(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (greaterThanOrEqualToDateTime(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.LT: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (nestedFieldValue < Number(operatedByFirstValue)) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (lessThanDate(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (lessThanDateTime(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = false;
            }

            break;
          }
        } // switch (type)

        break;
      }

      case OPERATOR.LTE: {
        switch (type) {
          case DATA_TYPE.NUMBER: {
            if (nestedFieldValue <= Number(operatedByFirstValue)) {
              valid = false;
            }

            break;
          }

          case DATA_TYPE.DATE: {
            if (lessThanOrEqualToDate(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }

          case DATA_TYPE.DATE_TIME: {
            if (lessThanOrEqualToDateTime(nestedFieldValue, new Date(operatedByFirstValue))) {
              valid = true;
            }

            break;
          }
        } // switch (type)

        break;
      }

      // case OPERATOR.EXISTS: {
      //   if (intersection(nestedFieldValueInArrayFormat, operatedByValue).length === 0) {
      //     return false;
      //   }

      //   break;
      // }

      case OPERATOR.IN: {
        if (operatedByValue.find((v) => String(v) === String(nestedFieldValue))) {
          // [!] indexOf NOT working
          valid = true;
        }

        break;
      }

      case OPERATOR.NOT_IN: {
        if (!operatedByValue.find((v) => String(v) === String(nestedFieldValue))) {
          // [!] indexOf NOT working
          valid = true;
        }

        break;
      }
    }

    if (valid) {
      break;
    }
  }

  return valid;
};

export const mergeUserPermissionListAndHisQuery = (permissionList, dataQuery) => {
  if (!isArray(permissionList)) {
    throw new BosError("permissionList is not an array.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  if (!dataQuery) {
    throw new BosError("dataQuery is missing.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  const finalQuery = [];
  const dataQueryInArray = [];

  Object.entries(dataQuery).forEach(([key, value]) => {
    // merge dataQuery into tmpQuery
    dataQueryInArray.push({
      [key]: value,
    });
  });

  permissionList.forEach((perm, index) => {
    const { userFeatureList, recordFeatureList } = perm;
    const tmpQuery = [].concat(dataQueryInArray);

    appBizDebugger(`permissionList index: ${index}`);
    appBizDebugger(`userFeatureList: ${JSON.stringify(userFeatureList)}`);
    appBizDebugger(`recordFeatureList: ${JSON.stringify(recordFeatureList)}`);

    if (isArray(recordFeatureList)) {
      for (let i = 0; i < recordFeatureList.length; i += 1) {
        let operatedByValue;

        const { featureName, selectedOperator, type, isUserFeature, selectedValueList } = recordFeatureList[i];

        appBizDebugger(`recordFeatureList: ${JSON.stringify(recordFeatureList)}`);

        if (String(isUserFeature) === "true") {
          // isUserFeature type = STRING (not BOOL)??
          if (!selectedValueList || !selectedValueList.length) {
            appBizDebugger("!selectedValueList");
            continue;
          }

          appBizDebugger(`selectedValueList: ${selectedValueList}, ${typeof selectedValueList}`);

          const featureName = isString(selectedValueList) ? selectedValueList : selectedValueList[0]; // selectedValueList[0] contains userFeatureName
          const userFeature = userFeatureList.find((f) => f.featureName === featureName);

          if (isUndefined(userFeature)) {
            appBizDebugger(`userFeature can\'t be found by featureName "${featureName}"`);
            continue;
          } else {
            operatedByValue = userFeature.value.map((val) => mongoose.Types.ObjectId(val)); // [..] user Feature value is always ID list
          }
        } else {
          // if (isUserFeature)
          operatedByValue = [];

          const splittedValueList = isString(selectedValueList) ? selectedValueList.split(",") : selectedValueList;

          splittedValueList.forEach((val) => {
            // cast value into correct data type
            if (isObjectId(val)) {
              // [!] cause of missing "ID" data type of swagger (using "string" instead)
              operatedByValue.push(mongoose.Types.ObjectId(val));
            } else {
              switch (type) {
                case DATA_TYPE.DATE:
                case DATA_TYPE.DATE_TIME: {
                  operatedByValue.push(new Date(val));
                  break;
                }

                case DATA_TYPE.ID: {
                  operatedByValue.push(mongoose.Types.ObjectId(val));
                  break;
                }

                default: {
                  // number / boolean / string
                  operatedByValue.push(val);
                  break;
                }
              } // switch (type)
            }
          });
        } // if (isUserFeature)

        if (isUndefined(operatedByValue)) {
          appBizDebugger("!operatedByValue");
          continue;
        }

        switch (selectedOperator) {
          case OPERATOR.EQ:
          case OPERATOR.NE:
          case OPERATOR.GT:
          case OPERATOR.GTE:
          case OPERATOR.LT:
          case OPERATOR.LTE: {
            // single value comparison
            tmpQuery.push({
              [featureName]: {
                [selectedOperator]: operatedByValue[0],
              },
            });

            break;
          }

          default: {
            // array value comparison
            tmpQuery.push({
              [featureName]: {
                [selectedOperator]: operatedByValue,
              },
            });

            break;
          }
        } // switch (selectedOperator)

        appBizDebugger(`tmpQuery: ${JSON.stringify(tmpQuery)}`);
      }
    } // if (isArray(recordFeatureList))

    if (tmpQuery.length) {
      const uniqueQuery = uniqWith(tmpQuery, isEqual);

      switch (uniqueQuery.length) {
        case 0: {
          break;
        }

        case 1: {
          finalQuery.push(uniqueQuery[0]);
          break;
        }

        default: {
          finalQuery.push({
            // nest tmpQuery into $and condition
            $and: uniqueQuery,
          });

          break;
        }
      }
    }
  });

  return uniqWith(finalQuery, isEqual);
};
