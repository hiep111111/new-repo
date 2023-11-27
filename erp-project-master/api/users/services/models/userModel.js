import { DATA_TYPE } from "../../constants/dataTypeConstant";

import roleRefModel from "../refModels/roleRefModel";
import functionWithParentRefModel from "../refModels/functionWithParentRefModel";
import moduleRefModel from "../refModels/moduleRefModel";

import apiList from "../controllers/userController";
import eventHandlerList from "../eventHandlers/commonEventHandler";

const model = {
  modelName: "users",

  data: {
    userName: {
      type: DATA_TYPE.STRING,
      unique: true,
      required: true,
    },

    fullName: { type: DATA_TYPE.STRING, required: true },

    password: {
      type: DATA_TYPE.STRING,
      virtual: true,
    },

    hash: {
      type: DATA_TYPE.STRING,
      picked: false, // [..] prevent client query & return to client
    },

    salt: {
      type: DATA_TYPE.STRING,
      picked: false, // [..] prevent client query & return to client
    },

    email: { type: DATA_TYPE.STRING, required: true },
    phone: { type: DATA_TYPE.STRING },
    biography: { type: DATA_TYPE.STRING },
    avatarFileId: { type: DATA_TYPE.ID },

    roleList: [
      {
        ...roleRefModel,
      },
    ],

    functionList: [
      {
        ...functionWithParentRefModel,
      },
    ],

    defaultFunctionId: {
      type: DATA_TYPE.ID,
      refModelName: "functions",
      refKeyField: "_id",
      relatedFields: [
        { fromField: "functionUrl", toField: "defaultFunctionUrl" },
        { fromField: "functionName", toField: "defaultFunctionName" },
        { fromField: "moduleId", toField: "defaultModuleId" },
        { fromField: "moduleCode", toField: "defaultModuleCode" },
        { fromField: "moduleName", toField: "defaultModuleName" },
      ],
    },

    defaultFunctionUrl: { type: DATA_TYPE.STRING },
    defaultFunctionName: { type: DATA_TYPE.STRING },

    defaultModuleId: {
      type: DATA_TYPE.ID,
      refModelName: "modules",
      refKeyField: "_id",
      relatedFields: [
        { fromField: "moduleCode", toField: "defaultModuleCode" },
        { fromField: "moduleName", toField: "defaultModuleName" },
      ],
    },

    defaultModuleCode: { type: DATA_TYPE.STRING },
    defaultModuleName: { type: DATA_TYPE.STRING },

    moduleList: [
      {
        ...moduleRefModel,
      },
    ],

    isAdmin: { type: DATA_TYPE.BOOLEAN, default: false },
  },

  apiList,
  eventHandlerList,
};

export default model;
