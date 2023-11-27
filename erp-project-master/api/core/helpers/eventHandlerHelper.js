import mongoose from "mongoose";
import { take } from "lodash";
import async from "async";

import serviceModelList from "./modelHelper";
import { getServiceCode } from "./commonHelper";
import { FIELD_SEPARATOR, POSITIONAL_OPERATOR } from "./modelHelper";
import sb from "./serviceBusHelper";
import { COMMON_EVENT } from "./eventHelper";

import { NOTIFICATION_STATE } from "../constants/notificationConstant";
import { ADMIN } from "../constants/userConstant";
import { DATA_TYPE } from "../constants/dataTypeConstant";

export const getUpdatedHandlerInstance = (modelName, version, constraint) => {
  const handler = (event, eventHandleCallBack) => {
    try {
      const DataModel = mongoose.model(modelName);

      const taskList = [];
      const { newData } = event.payload;
      const { fieldName, refKeyField, relatedFields } = constraint;
      const updateConditionList = {};
      const updatedFieldSet = {};

      const splittedFieldName = fieldName.split(FIELD_SEPARATOR);
      const fieldLevel = splittedFieldName.length;

      if (fieldLevel === 1) {
        // root fields
        updateConditionList[fieldName] = newData[refKeyField];

        relatedFields.forEach((f) => {
          const { fromField, toField } = f;

          updatedFieldSet[toField] = newData[fromField];
        });

        taskList.push((cb) => {
          DataModel.updateMany(
            updateConditionList,

            {
              $set: updatedFieldSet,
            },

            cb
          );
        });
      } else {
        // nested document fields
        const fieldPath = fieldLevel > 1 ? take(splittedFieldName, fieldLevel - 1).join(POSITIONAL_OPERATOR) : "";
        const identifierSuffix = "Item";
        const toFieldPrefix = `${fieldPath}.$[${splittedFieldName[fieldLevel - 2]}${identifierSuffix}]`;
        const identifier = `${splittedFieldName[fieldLevel - 2]}${identifierSuffix}.${splittedFieldName[fieldLevel - 1]}`;

        relatedFields.forEach((f) => {
          const { fromField, toField } = f;
          const splittedToField = toField.split(FIELD_SEPARATOR);

          // [..] prevent CHILD error "The path '...' must exist in the document in order to apply array updates."
          updateConditionList[toField] = {
            $exists: true,
          };

          const formattedToField = `${toFieldPrefix}.${splittedToField[fieldLevel - 1]}`;

          updatedFieldSet[formattedToField] = newData[fromField];
        });

        taskList.push((cb) => {
          DataModel.updateMany(
            updateConditionList,

            {
              $set: updatedFieldSet,
            },

            {
              arrayFilters: [
                {
                  [identifier]: mongoose.Types.ObjectId(newData[refKeyField]),
                },
              ],
            }, // [!] without cast to Object Id => query not working

            (err) => {
              cb(err);
            }
          );
        });
      }

      if (taskList.length > 0) {
        async.series(taskList, eventHandleCallBack);
      } else {
        eventHandleCallBack(null);
      }
    } catch (error) {
      console.error(error);
      eventHandleCallBack(error);
    }
  };

  return handler;
};

export const getDeletedHandlerInstance = (modelName, version, constraint) => {
  const handler = async (event, eventHandleCallBack) => {
    try {
      if (constraint) {
        const DataModel = mongoose.model(modelName);
        const { fieldName, refKeyField } = constraint;
        const { origin, payload } = event;
        const { oldData } = payload;

        const { [refKeyField]: keyValue, deletedBy, deletedByUserName, deletedByFullName } = oldData;

        if (keyValue) {
          const obj = await DataModel.findOne({
            [fieldName]: keyValue,
          }).lean();

          if (obj) {
            sb.publish(
              `v${version}/${modelName}`,
              `${origin.replace("/", ".")}.${COMMON_EVENT.DELETE_REJECTED}`, // response to origin
              {
                modelName,
                version,
                _id: keyValue,
                reason: `Model ${modelName} has record with id: ${obj._id}, has "${fieldName}" field is referenced.`,
                deletedBy,
                deletedByUserName,
                deletedByFullName,
              },
              "",
              (err) => {
                console.log("getDeletedHandlerInstance.err", err);
                eventHandleCallBack(err);
              }
            );
          }
        }
      }
    } catch (error) {
      console.log("khoi.getDeletedHandlerInstance", error);
      eventHandleCallBack(error);
    }
  };

  return handler;
};

export const getDeletedRejectedHandlerInstance = (modelName, version) => {
  const handler = async (event, eventHandleCallBack) => {
    try {
      const DataModel = mongoose.model(modelName);
      const { origin, payload } = event;

      const { _id, reason, deletedBy, deletedByUserName, deletedByFullName } = payload;

      const dataObject = await DataModel.findOne({
        _id,
        deleted: true,
      });

      if (dataObject) {
        const serviceCode = getServiceCode(modelName, version);
        const { data: dataModel } = serviceModelList[serviceCode];

        Object.entries(dataModel).forEach(([fieldName, def]) => {
          // fix duplicated sequence code
          if ([DATA_TYPE.STRING, DATA_TYPE.SEQUENCE].includes(def.type) && def.unique) {
            dataObject[fieldName] = dataObject[fieldName].replace(String(dataObject._id).substr(18) + "-", ""); // follow syntax defined in deleteController
          }
        });

        dataObject.deleted = false;
        dataObject.deleteRejectTimeOut = null;
        dataObject.deletedAt = null;

        dataObject.deletedBy = null;
        dataObject.deletedByUserName = "";
        dataObject.deletedByFullName = "";

        await dataObject.save();

        const MessageModel = mongoose.model("messages");

        const notification = MessageModel({
          subject: `Object (id: ${_id}) can't be deleted`,
          content: reason,
          relatedModel: origin,
          relatedDocumentId: _id,
          refUrl: "",
          state: NOTIFICATION_STATE.SENT,

          recipient: deletedBy,
          recipientUserName: deletedByUserName,
          recipientFullName: deletedByFullName,

          createdBy: ADMIN.USER_ID,
          createdByUserName: ADMIN.USER_NAME,
          createdByFullName: ADMIN.FULL_NAME,
        });

        await notification.save();
      }

      eventHandleCallBack(null);
    } catch (error) {
      console.log("khoi.getDeletedRejectedHandlerInstance", error);
      eventHandleCallBack(error);
    }
  };

  return handler;
};

export const normalizeConsumeEvent = (origin, type, payload, correlationId) => ({ origin, type, payload, correlationId });
