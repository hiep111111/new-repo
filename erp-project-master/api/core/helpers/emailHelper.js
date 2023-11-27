import mongoose from "mongoose";
import nodemailer from "nodemailer";
import config from "config";
import { isArray, concat } from "lodash";
import debug from "debug";

import apm from "./apmHelper";
import { isObjectId, isEmail } from "./commonHelper";
import { checkRecordPermission } from "./policyHelper";
import { WORKFLOW_ACTION_CODE_PARAM } from "./controllerHelper";
import { equalToId } from "./commonHelper";

const appBizDebugger = debug("app:biz");
export const EMAIL_LIST_SEPARATOR = ";";

export const getUserIdByField = (dataObject, fieldName) => {
  const splittedField = fieldName.split(".");
  const nestedLevel = splittedField.length;
  const userSet = new Set();

  // TODO: throw exception if can not get value??

  appBizDebugger(`getUserIdByField`);
  appBizDebugger(`fieldName: ${fieldName}`);
  appBizDebugger(`nestedLevel: ${nestedLevel}`);

  switch (nestedLevel) {
    case 1: {
      const fieldValue = dataObject[fieldName];

      if (isArray(fieldValue)) {
        fieldValue.forEach((userId) => {
          if (isObjectId(userId)) {
            userSet.add(userId);
          }
        });
      } else {
        if (isObjectId(fieldValue)) {
          userSet.add(fieldValue);
        }
      }

      break;
    }

    case 2: {
      const parentField = dataObject[splittedField[0]];

      if (!parentField) {
        break;
      }

      parentField
        .map((e) => e[splittedField[1]])
        .forEach((userId) => {
          if (isObjectId(userId)) {
            userSet.add(userId);
          }
        });

      break;
    }

    case 3: {
      const grandParentField = dataObject[splittedField[0]];

      if (!grandParentField) {
        break;
      }

      const parentField = grandParentField.map((e) => e[splittedField[1]]);

      if (!parentField.length) {
        break;
      }

      return parentField
        .map((e) => e[splittedField[2]])
        .forEach((userId) => {
          if (isObjectId(userId)) {
            userSet.add(userId);
          }
        });
    }

    default: {
      break;
    }
  }

  return [...userSet];
};

export const getEmailByField = async (informToByField, dataObject) => {
  appBizDebugger("start getInformToEmailList");

  const UserFeatureModel = mongoose.model("sysUserFeatures");
  const informToList = new Set();
  let userIdList = [];

  if (isArray(informToByField)) {
    // if isArray => get email from userFeature by userId (in fieldName)
    appBizDebugger("informToByField is an array");

    informToByField.forEach((fieldName) => {
      userIdList = concat(userIdList, getUserIdByField(dataObject, fieldName));
    });
  } else {
    appBizDebugger("informToByField is an string");

    userIdList = concat(userIdList, getUserIdByField(dataObject, informToByField));
  }

  appBizDebugger(`userIdList: ${JSON.stringify(userIdList)}`);

  for (const userId of userIdList) {
    const userFeature = await UserFeatureModel.findOne({ userId }, { email: 1 }).lean();
    const userEmail = userFeature ? userFeature.email : "";

    appBizDebugger(`userId: ${userId} => email: ${userEmail}`);

    if (isEmail(userEmail)) {
      informToList.add(userEmail);
    } else {
      appBizDebugger(`userEmail: ${userEmail} is not correct email`);
    }
  }

  appBizDebugger(`informToList: ${JSON.stringify(informToList)}`);

  return [...informToList];
};

export const getNextStateUserList = async (context, dataObject, nextWorkflowActionCodeList) => {
  appBizDebugger("getNextStateUserList");

  const associatedUserSet = new Set();
  const AccessListModel = mongoose.model("sysAccessLists");
  const UserFeatureModel = mongoose.model("sysUserFeatures");

  const { serviceCode, apiActionCode } = context;

  const span = apm.startSpan("getNextStateUserList");

  const accessList = await AccessListModel.find({
    serviceCode,
    actionCode: apiActionCode, // API_ACTION_CODE.TRIGGER_WORKFLOW
    // functionId, // [..] don't care whatever client
  }).lean();

  const accessListCount = accessList.length;

  span &&
    span.addLabels({
      serviceCode,
      apiActionCode,
    });

  appBizDebugger(`accessListCount: ${accessListCount}`);

  if (!accessListCount) {
    span && span.end();
    return [];
  }

  const userSet = new Set();
  for (const perm of accessList) {
    userSet.add(perm.userId);
  }

  appBizDebugger(`userSet: ${JSON.stringify([...userSet])}`);

  const associatedUserFeatureList = await UserFeatureModel.find(
    {
      userId: {
        $in: [...userSet],
      },
    },
    {
      userId: 1,
      userName: 1,
      fullName: 1,
      email: 1,
      userFeatureList: 1,
    }
  ).lean();

  appBizDebugger(`associatedUserFeatureList: ${JSON.stringify(associatedUserFeatureList)}`);

  for (const workflowActionCode of nextWorkflowActionCodeList) {
    for (const perm of accessList) {
      const { _id, policyName, userId, recordFeatureList, apiFeatureList } = perm;

      appBizDebugger("accessList._id", _id);
      appBizDebugger("policyName", policyName);

      const userFeature = associatedUserFeatureList.find((u) => equalToId(u.userId, userId));
      const userFeatureList = userFeature ? userFeature.userFeatureList : [];

      const recordIsOk = checkRecordPermission(dataObject, userFeatureList, recordFeatureList);
      const apiParamIsOk = checkRecordPermission({ [WORKFLOW_ACTION_CODE_PARAM]: workflowActionCode }, userFeatureList, apiFeatureList || []);

      appBizDebugger("recordIsOk", recordIsOk);
      appBizDebugger("apiParamIsOk", apiParamIsOk);

      if (recordIsOk && apiParamIsOk) {
        const { email } = userFeature;

        if (isEmail(email)) {
          associatedUserSet.add(email);
        }
      }
    }
  }

  span && span.end();

  return [...associatedUserSet];
};

export const sendEmail = (to, cc, subject, content, callback) => {
  appBizDebugger("sendEmail");
  appBizDebugger(`To: ${to}`);
  appBizDebugger(`CC: ${cc}`);

  let smtpTransport = config.get("smtpTransport");
  if (process.env.RELEASE == "PRODUCTION") {
    smtpTransport.secure = false;
    smtpTransport.requireTLS = true;
    smtpTransport.tls = { rejectUnauthorized: false };
  }
  const transporter = nodemailer.createTransport(smtpTransport);

  // TODO: verify SMTP configuration

  const mailOptions = {
    from: smtpTransport.from,
    to: String(to),
    cc: String(cc),
    subject: subject,
    html: content,
  };

  transporter.sendMail(mailOptions, callback);
};
