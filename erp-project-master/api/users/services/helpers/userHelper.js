import { uniq, orderBy, isArray, isString } from "lodash";
import mongoose from "mongoose";

import { equalToId, isObjectId } from "../../helpers/commonHelper";
import { getUserAccessList } from "../../helpers/policyHelper";
import BosError, { BOS_ERROR } from "../../helpers/errorHelper";

import { USER_FEATURE_LIST, USER_FEATURE } from "../../constants/policyConstant";

export const getTokenFromHeader = (req) => {
  if (req.headers.authorization && req.headers.authorization.split(" ")[0] === "Bearer") {
    return req.headers.authorization.split(" ")[1];
  }

  return null;
};

export const getUniqueResource = (roleList) => {
  let uniqueFunctionList = [];
  const roleIdList = [];
  const functionIdList = [];
  const moduleList = [];
  const moduleIdList = [];

  roleList.forEach((role) => {
    const { roleId, functionList } = role;

    roleIdList.push(String(roleId));

    functionList.forEach((func) => {
      const { functionId, functionActionList, moduleId, moduleCode, moduleName, moduleOrder } = func;

      const funcIndex = uniqueFunctionList.findIndex((f) => equalToId(f.functionId, functionId) && f.functionActionList.toString() === functionActionList);

      if (funcIndex < 0) {
        const oldFunc = uniqueFunctionList.find((f) => equalToId(f.functionId, functionId));

        if (oldFunc) {
          // if function already existed => merge function action list
          let oldActionList = oldFunc.functionActionList.split(",");
          let newActionList = func.functionActionList.split(",");

          let mergedActionList = oldActionList.concat(newActionList);
          let functionActionList = uniq(mergedActionList).join(",");

          uniqueFunctionList = uniqueFunctionList.filter((f) => !equalToId(f.functionId, functionId)); // [T.T] crazy biz => re-check
          func.functionActionList = functionActionList;
        }

        uniqueFunctionList.push(func);
        functionIdList.push(String(functionId));

        const modIndex = moduleList.findIndex((f) => equalToId(f.moduleId, moduleId));

        if (modIndex < 0) {
          moduleList.push({
            moduleId,
            moduleCode,
            moduleName,
            moduleOrder,
          });

          moduleIdList.push(String(moduleId));
        }
      }
    });
  });

  return {
    roleIdList,

    functionList: orderBy(uniqueFunctionList, ["moduleOrder", "functionOrder"], ["asc", "asc"]),
    functionIdList,

    moduleList: orderBy(moduleList, ["moduleOrder"], ["asc"]),
    moduleIdList,
  };
};

export const getModuleFunctionList = (functionList, moduleCode) => {
  const list = [];

  if (functionList) {
    functionList.forEach((func) => {
      if (func.moduleCode === moduleCode) {
        list.push(func);
      }
    });
  }

  return orderBy(list, ["functionOrder"], ["asc"]);
};

export const getUserRelatedAccessList = async (userFeature, refPolicyList) => {
  const PolicyModel = mongoose.model("sysPolicies");
  let accessList = [];
  const functionListFeature = userFeature && userFeature.userFeatureList ? userFeature.userFeatureList.find((feature) => feature.featureName === USER_FEATURE.FUNCTION_LIST) : [];

  if (functionListFeature) {
    const { value: functionIdList } = functionListFeature;

    if (isArray(functionIdList)) {
      if (functionIdList.length > 0) {
        let policyList;

        if (!refPolicyList) {
          policyList = await PolicyModel.find({
            functionId: {
              $in: functionIdList, // [..] get related policy
            },

            deleted: {
              $ne: true,
            },
          }).lean();
        } else {
          policyList = refPolicyList.filter((p) => functionIdList.includes(p.functionId.toString())); // remove other (user/old) function list
        }

        if (isArray(policyList)) {
          policyList.forEach((policy) => {
            const perm = getUserAccessList(userFeature, policy);

            if (perm) {
              accessList.push(perm);
            }
          });
        }
      }
    }
  }

  return accessList;
};

const exactFeatureIdList = (user, listName, idFieldName) => {
  const valueList = user[listName];

  if (!valueList) {
    return [];
  }

  if (!isArray(valueList)) {
    throw new BosError(`user[${listName}] is not an array (${valueList}).`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  const idList = [];

  valueList.forEach((v) => {
    const idValue = String(v[idFieldName]);

    if (isObjectId(idValue)) {
      idList.push(idValue);
    }
  });

  return uniq(idList);
};

export const exactCustomerList = (user, businessSegmentCodeList) => {
  const { managedCustomerGroupList } = user;
  const customerIdList = [];

  if (isArray(managedCustomerGroupList)) {
    for (const managedCustomerGroup of managedCustomerGroupList) {
      const { customerLayerList } = managedCustomerGroup;

      for (const customerLayer of customerLayerList) {
        const { customerId, businessSegmentCode } = customerLayer;

        if (isObjectId(customerId)) {
          let added = false;

          if (isArray(businessSegmentCodeList)) {
            if (businessSegmentCodeList.includes(businessSegmentCode)) {
              added = true;
            }
          } else if (isString(businessSegmentCodeList)) {
            if (businessSegmentCodeList === businessSegmentCode) {
              added = true;
            }
          }

          if (added) {
            customerIdList.push(String(customerId));
          }
        }
      }
    }
  }

  return uniq(customerIdList);
};

export const getUserFeature = (user) => {
  if (!user) {
    throw new BosError("user is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const userId = user._id ? user._id : user.userId;
  const { userName, fullName, email, phone } = user;

  if (!userId) {
    throw new BosError("userId is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!userName) {
    throw new BosError("userName is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!fullName) {
    throw new BosError("fullName is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const userFeatureList = [];

  USER_FEATURE_LIST.forEach((featureName) => {
    const feature = { featureName };
    let found = true;

    switch (featureName) {
      case USER_FEATURE.USER_ID: {
        feature.value = [String(userId)];
        break;
      }

      case USER_FEATURE.ROLE_LIST: {
        feature.value = exactFeatureIdList(user, "roleList", "roleId");
        break;
      }

      case USER_FEATURE.FUNCTION_LIST: {
        feature.value = exactFeatureIdList(user, "functionList", "functionId");
        break;
      }

      default: {
        found = false;
        break;
      }
    }

    if (found) {
      userFeatureList.push(feature);
    }
  });

  return {
    userId,
    userName,
    fullName,
    phone,
    email,

    userFeatureList,

    active: true,
    deleted: false,
    usedBySystem: true,
  };
};
