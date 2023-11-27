import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

const model = {
  modelName: "sysServiceBusEvents",

  data: {
    origin: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    type: { type: DATA_TYPE.STRING, required: true },
    correlationId: { type: DATA_TYPE.STRING, required: true },
    payload: { type: DATA_TYPE.OBJECT, required: true },

    consumerList: [
      {
        name: { type: DATA_TYPE.STRING, required: true },
        handled: { type: DATA_TYPE.BOOLEAN },
        description: { type: DATA_TYPE.STRING },
        updatedAt: { type: DATA_TYPE.DATE_TIME },
      },
    ],
  },

  apiList: API_LIST.R,
};

export default model;
