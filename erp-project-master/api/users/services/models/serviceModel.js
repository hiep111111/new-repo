import { HTTP_METHOD_LIST } from "../../constants/httpConstant";
import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

const model = {
  modelName: "services",

  data: {
    serviceCode: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
      unique: true,
    },

    serviceName: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    actionList: [
      {
        actionCode: { type: DATA_TYPE.STRING },

        method: {
          type: DATA_TYPE.STRING,
          oneOf: HTTP_METHOD_LIST,
          required: true,
        },

        path: { type: DATA_TYPE.STRING, required: true },

        requestFieldList: [
          {
            name: { type: DATA_TYPE.STRING },
            type: { type: DATA_TYPE.STRING },
            required: { type: DATA_TYPE.BOOLEAN },
          },
        ],

        responseFieldList: [
          {
            name: { type: DATA_TYPE.STRING },
            type: { type: DATA_TYPE.STRING },
          },
        ],

        note: { type: DATA_TYPE.STRING },
      },
    ],

    fieldList: [
      {
        name: { type: DATA_TYPE.STRING },
        type: { type: DATA_TYPE.STRING },
        required: { type: DATA_TYPE.BOOLEAN },
        oneOf: { type: DATA_TYPE.ARRAY },
      },
    ],

    scheduleList: [
      {
        description: { type: DATA_TYPE.STRING },
        eventType: { type: DATA_TYPE.STRING },
      },
    ],
  },

  apiList: API_LIST.CRUD,
};

export default model;
