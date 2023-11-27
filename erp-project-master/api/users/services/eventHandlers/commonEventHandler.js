import mongoose from "mongoose";
import { omit, isArray, concat } from "lodash";

import { getUserAccessList } from "../../helpers/policyHelper";
import { equalToId, isObjectId } from "../../helpers/commonHelper";
import { COMMON_EVENT } from "../../helpers/eventHelper";
import { MODEL_RESERVED_FIELDS } from "../../helpers/modelHelper";
import { USER_FEATURE } from "../../constants/policyConstant";

import { getUserRelatedAccessList, getUserFeature, getUniqueResource } from "../helpers/userHelper";

const ADMIN_ROLE_CODE = "admin";

export const functionCreatedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserModel = mongoose.model("users");
    const RoleModel = mongoose.model("roles");

    const func = event.payload.newData;

    const newFunction = {
      ...omit(func, MODEL_RESERVED_FIELDS),
      functionId: func._id,
    };

    // push new function to "admin" role
    await RoleModel.updateOne(
      {
        roleCode: ADMIN_ROLE_CODE,
      },
      {
        $push: {
          functionList: newFunction,
        },
      }
    );

    // TODO: missing parentFunctionId bug
    await UserModel.updateOne(
      {
        isAdmin: true,
      },
      {
        $push: {
          functionList: newFunction,

          roleList: {
            functionList: newFunction,
          },
        },
      }
    );

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const functionDeletedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserModel = mongoose.model("users");
    const AccessListModel = mongoose.model("sysAccessLists");
    const RoleModel = mongoose.model("roles");
    const PolicyModel = mongoose.model("sysPolicies");
    const functionId = event.payload.oldData._id;

    await RoleModel.updateMany(
      {},
      {
        $pull: {
          functionList: {
            functionId,
          },
        },
      }
    );

    await RoleModel.updateMany(
      {},
      {
        $pull: {
          functionList: {
            functionParentId: functionId,
          },
        },
      }
    );

    await UserModel.updateMany(
      {},
      {
        $pull: {
          functionList: {
            functionId,
          },

          roleList: {
            functionList: {
              $elemMatch: {
                functionId,
              },
            },
          },
        },
      }
    );

    await UserModel.updateMany(
      {},
      {
        $pull: {
          functionList: {
            functionParentId: functionId,
          },

          roleList: {
            functionList: {
              $elemMatch: {
                functionParentId: functionId,
              },
            },
          },
        },
      }
    );

    await PolicyModel.deleteMany({
      functionId,
    });

    await AccessListModel.deleteMany({
      functionId,
    });

    // TODO: remove functionId from userFeature

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const userCreatedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserFeatureModel = mongoose.model("sysUserFeatures");
    const AccessListModel = mongoose.model("sysAccessLists");
    const PolicyModel = mongoose.model("sysPolicies");
    const UserModel = mongoose.model("users");
    const user = event.payload.newData;
    const userFeature = getUserFeature(user);

    const dataObject = new UserFeatureModel({
      ...userFeature,
    });

    await dataObject.save();

    const { active, isAdmin } = user;
    if (active && !isAdmin) {
      // admin => not limited by accessList
      const mergedFunctionIdSet = new Set(user.functionList ? user.functionList.map((f) => f.functionId.toString()) : []); // old & new function list
      const userList = await UserModel.find({ _id: userId }).lean();

      // merge old user function list
      if (isArray(userList)) {
        for (const user of userList) {
          const { functionList } = user;

          if (isArray(functionList)) {
            for (const func of functionList) {
              const { functionId } = func;

              if (isObjectId(functionId)) {
                mergedFunctionIdSet.add(functionId.toString());
              }
            }
          }
        }
      }

      // TODO: begin transaction
      const policyList = await PolicyModel.find({
        // [..] cache related policy => reduce db query
        functionId: {
          $in: [...mergedFunctionIdSet],
        },

        deleted: {
          $ne: true,
        },
      }).lean();
      const accessList = await getUserRelatedAccessList(userFeature, policyList);

      await AccessListModel.insertMany(accessList);
    }

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const userUpdatedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserFeatureModel = mongoose.model("sysUserFeatures");
    const AccessListModel = mongoose.model("sysAccessLists");
    const PolicyModel = mongoose.model("sysPolicies");
    const UserModel = mongoose.model("users");

    const user = event.payload.newData;
    const userFeature = getUserFeature(user);
    const userId = user._id;

    await UserFeatureModel.deleteMany({ userId });
    await AccessListModel.deleteMany({ userId });

    const dataObject = new UserFeatureModel({
      ...userFeature,
    });

    await dataObject.save();

    if (!user.isAdmin) {
      const mergedFunctionIdSet = new Set(user.functionList ? user.functionList.map((f) => f.functionId.toString()) : []); // old & new function list
      const userList = await UserModel.find({ _id: userId }).lean();

      // merge old user function list
      if (isArray(userList)) {
        for (const user of userList) {
          const { functionList } = user;

          if (isArray(functionList)) {
            for (const func of functionList) {
              const { functionId } = func;

              if (isObjectId(functionId)) {
                mergedFunctionIdSet.add(functionId.toString());
              }
            }
          }
        }
      }

      // TODO: begin transaction
      const policyList = await PolicyModel.find({
        // [..] cache related policy => reduce db query
        functionId: {
          $in: [...mergedFunctionIdSet],
        },

        deleted: {
          $ne: true,
        },
      }).lean();
      const accessList = await getUserRelatedAccessList(userFeature, policyList);

      await AccessListModel.insertMany(accessList);
    }

    eventHandleCallBack(null);
  } catch (error) {
    console.log("error:", error);
    eventHandleCallBack(error);
  }
};

export const userDeletedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserFeatureModel = mongoose.model("sysUserFeatures");
    const AccessListModel = mongoose.model("sysAccessLists");
    const userId = event.payload.oldData._id;

    await UserFeatureModel.deleteMany({ userId });
    await AccessListModel.deleteMany({ userId });

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const serviceUpdatedHandler = async (event, eventHandleCallBack) => {
  try {
    const AccessListModel = mongoose.model("sysAccessLists");
    const PolicyModel = mongoose.model("sysPolicies");
    const { _id, serviceName, actionList, fieldList } = event.payload.newData;

    for (const action of actionList) {
      const { actionCode, requestFieldList, responseFieldList } = action;

      const fullRequestFieldList = requestFieldList.map((field) => field.name);
      const fullResponseFieldList = responseFieldList.map((field) => field.name);

      await PolicyModel.updateMany(
        {
          serviceId: _id,
          actionCode,
        },
        {
          serviceName,
          actionList,
          fieldList,

          requestFieldList: [], // default = select all
          requestExceptFieldList: [], // default = none
          fullRequestFieldList,
          allowedRequestFieldList: fullRequestFieldList,

          responseFieldList: [], // default = select all
          responseExceptFieldList: [], // default = none
          fullResponseFieldList,
          allowedResponseFieldList: fullResponseFieldList,
        }
      );

      await AccessListModel.updateMany(
        {
          serviceId: _id,
          actionCode,
        },
        {
          serviceName,
          actionList,
          fieldList,

          allowedRequestFieldList: fullRequestFieldList,
          allowedResponseFieldList: fullResponseFieldList,
        }
      );
    }

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const policyCreatedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserFeatureModel = mongoose.model("sysUserFeatures");
    const AccessListModel = mongoose.model("sysAccessLists");
    let accessList = [];
    const policy = event.payload.newData;
    const functionId = policy.functionId.toString();

    const userList = await UserFeatureModel.find({
      userFeatureList: {
        $elemMatch: {
          featureName: USER_FEATURE.FUNCTION_LIST,
          value: functionId,
        },
      },
    }).lean();

    if (isArray(userList)) {
      for (const user of userList) {
        accessList = concat(accessList, getUserAccessList(user, policy));
      }
    }

    await AccessListModel.insertMany(accessList);

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const policyUpdatedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserFeatureModel = mongoose.model("sysUserFeatures");
    const AccessListModel = mongoose.model("sysAccessLists");
    const taskList = [];
    let accessList = [];
    const policy = event.payload.newData;
    const functionId = policy.functionId.toString();
    const policyId = policy._id;

    await AccessListModel.deleteMany({ policyId });

    const userList = await UserFeatureModel.find({
      userFeatureList: {
        $elemMatch: {
          featureName: USER_FEATURE.FUNCTION_LIST,
          value: functionId,
        },
      },
    }).lean();

    if (isArray(userList)) {
      for (const user of userList) {
        const currentUserAccessList = getUserAccessList(user, policy);

        if (currentUserAccessList) {
          // [..] prevent null returned case
          accessList = concat(accessList, currentUserAccessList);
        }
      }
    }

    await AccessListModel.insertMany(accessList);

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const policyDeletedHandler = async (event, eventHandleCallBack) => {
  try {
    const AccessListModel = mongoose.model("sysAccessLists");
    const policyId = event.payload.oldData._id;

    if (policyId) {
      await AccessListModel.deleteMany({ policyId });
    }

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

export const roleUpdatedHandler = async (event, eventHandleCallBack) => {
  try {
    const UserModel = mongoose.model("users");
    const UserFeatureModel = mongoose.model("sysUserFeatures");
    const PolicyModel = mongoose.model("sysPolicies");
    const AccessListModel = mongoose.model("sysAccessLists");
    const { newData } = event.payload;
    const roleId = newData._id.toString();

    const role = {
      // convert _id => roleId
      ...newData,
      _id: undefined,
      roleId,
    };

    const mergedFunctionIdSet = new Set(newData.functionList ? newData.functionList.map((f) => f.functionId.toString()) : []); // old & new function list
    const userList = await UserModel.find({ "roleList.roleId": roleId }).lean();

    // merge old user function list
    if (isArray(userList)) {
      for (const user of userList) {
        const { functionList } = user;

        if (isArray(functionList)) {
          for (const func of functionList) {
            const { functionId } = func;

            if (isObjectId(functionId)) {
              mergedFunctionIdSet.add(functionId.toString());
            }
          }
        }
      }
    }

    // TODO: begin transaction

    const policyList = await PolicyModel.find({
      // [..] cache related policy => reduce db query
      functionId: {
        $in: [...mergedFunctionIdSet],
      },

      deleted: {
        $ne: true,
      },
    }).lean();

    // TODO: parallel running

    for (const user of userList) {
      // [!] forEach make async issue
      const { _id: userId, roleList: fullRoleList } = user;

      const newRoleList = [];

      fullRoleList.forEach((oldRole) => {
        if (equalToId(oldRole.roleId, roleId)) {
          newRoleList.push({ ...role });
        } else {
          newRoleList.push({ ...oldRole });
        }
      });

      const { roleIdList, moduleList, functionList, functionIdList } = getUniqueResource(newRoleList);

      await UserModel.updateOne(
        { _id: userId },
        {
          roleList: newRoleList,
          moduleList,
          functionList,
        }
      );

      // update ROLE_LIST user features
      await UserFeatureModel.updateOne(
        {
          userFeatureList: {
            $elemMatch: {
              featureName: USER_FEATURE.ROLE_LIST,
            },
          },

          userId,
        },
        {
          $set: {
            "userFeatureList.$.value": roleIdList,
          },
        }
      );

      // update FUNCTION_LIST user features
      await UserFeatureModel.updateOne(
        {
          userFeatureList: {
            $elemMatch: {
              featureName: USER_FEATURE.FUNCTION_LIST,
            },
          },

          userId,
        },
        {
          $set: {
            "userFeatureList.$.value": functionIdList,
          },
        }
      );

      const userFeature = getUserFeature({
        // get user feature by old data + updated role / function info
        ...user,

        roleList: newRoleList,
        moduleList,
        functionList,
      });

      // TODO: batch accessList insert (for all user)
      const userAccessList = await getUserRelatedAccessList(userFeature, policyList);
      await AccessListModel.deleteMany({ userId }); // [!] delete many user's accessList make missing other perm while re-updating duration
      await AccessListModel.insertMany(userAccessList);
    } // userList.for

    // TODO: end transaction

    eventHandleCallBack(null);
  } catch (error) {
    eventHandleCallBack(error);
  }
};

const eventHandlerList = [
  {
    refModelName: "functions",
    eventType: COMMON_EVENT.CREATED,
    handler: functionCreatedHandler,
  },
  {
    refModelName: "functions",
    eventType: COMMON_EVENT.DELETED,
    handler: functionDeletedHandler,
  },
  {
    refModelName: "users",
    eventType: COMMON_EVENT.CREATED,
    handler: userCreatedHandler,
  },
  {
    refModelName: "users",
    eventType: COMMON_EVENT.UPDATED,
    handler: userUpdatedHandler,
  },
  {
    refModelName: "users",
    eventType: COMMON_EVENT.DELETED,
    handler: userDeletedHandler,
  },
  {
    refModelName: "services",
    eventType: COMMON_EVENT.UPDATED,
    handler: serviceUpdatedHandler,
  },
  {
    refModelName: "sysPolicies",
    eventType: COMMON_EVENT.CREATED,
    handler: policyCreatedHandler,
  },
  {
    refModelName: "sysPolicies",
    eventType: COMMON_EVENT.UPDATED,
    handler: policyUpdatedHandler,
  },
  {
    refModelName: "sysPolicies",
    eventType: COMMON_EVENT.DELETED,
    handler: policyDeletedHandler,
  },
  {
    refModelName: "roles",
    eventType: COMMON_EVENT.UPDATED,
    handler: roleUpdatedHandler,
  },
];

export default eventHandlerList;
