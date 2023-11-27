import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

import { MESSAGE_STATE_LIST } from "../constants/messageConstant";

const model = {
  modelName: "messages",

  data: {
    subject: { type: DATA_TYPE.STRING },
    content: { type: DATA_TYPE.STRING },
    relatedModel: { type: DATA_TYPE.STRING },
    relatedDocumentId: { type: DATA_TYPE.ID },
    refUrl: { type: DATA_TYPE.STRING },

    state: {
      type: DATA_TYPE.STRING,
      required: true,
      oneOf: MESSAGE_STATE_LIST,
    },

    recipient: { type: DATA_TYPE.ID },
    recipientUserName: { type: DATA_TYPE.STRING },
    recipientFullName: { type: DATA_TYPE.STRING },

    fileList: [
      {
        index: { type: DATA_TYPE.NUMBER },
        fileId: { type: DATA_TYPE.ID },
        fileName: { type: DATA_TYPE.STRING },
        originalName: { type: DATA_TYPE.STRING },
        contentType: { type: DATA_TYPE.STRING },
        size: { type: DATA_TYPE.NUMBER },
        bucketName: { type: DATA_TYPE.STRING },
        uploadDate: { type: DATA_TYPE.DATE },
      },
    ],
  },

  apiList: API_LIST.R,
};

export default model;
