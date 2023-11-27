/* eslint-disable no-shadow */
/* eslint-disable no-param-reassign */
import React, { createRef } from 'react';
import _ from 'lodash';
import async from 'async';
import { Redirect } from 'react-router-dom';
import FileSaver from 'file-saver';
import pluralize from 'pluralize';

import apm from './apmHelper';
import { VALIDATE_FAILURE, INSTANT_SEARCH_RETURNED_RESULT } from '../constants/config';
import { isObjectId } from './commonHelper';

import {
  apiGetList, apiGetById, apiCreate,
  apiDeleteById, apiUpload,
  apiPost, apiUpdateById, apiTriggerWorkflow,
  apiPrint, apiPatch
} from './apiHelper';

import { validateData, validatePost,
  getDefaultModelValue, nomalizeData, cloneObject 
} from './modelHelper';
import BosError, { apiError2Messages, BOS_ERROR } from './errorHelper';

import {
  LOADING_STATE,
  checkLogin, getLinkedObjects, getApiContextFromSelf,
  onChange, onAddSubDocument, onAppendSubDocument, onDeleteSubDocument,
  onDownloadFile,
  PLUGIN, onClickFunctionRegister,
  onClickOpenGuideline,
  onKeyDown,
} from './componentHelper';

export const COMMENT_SERVICE_CODE = 'v1/comments';
export const HASH_TAG_SERVICE_CODE = 'v1/tags';

export const COMMENT_MENTION_SIGN = '@';
export const COMMENT_TAG_SIGN = '#';
export const COMMENT_MENTION_SEPARTOR = ' - ';

const onClickNextObject = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const {
    apiEndpoint, model, objectFields,
    nextObjectId, objectList,
  } = self.state;

  const { handleSaveObjectSurffingState } = self.props;

  const objectId = nextObjectId;

  if (isObjectId(objectId)) {
    const clientContext = getApiContextFromSelf(self);
    const { error, data } = await apiGetById(apiEndpoint.read, objectId, objectFields, clientContext);

    if (error) {
      self.setState({
        error: true,
        messages: apiError2Messages(error),
        loading: false,
      });
    } else {
      const linkedObjects = getLinkedObjects(objectId, objectList.data || []);
      const { prevObjectId, nextObjectId } = linkedObjects;

      handleSaveObjectSurffingState(prevObjectId, objectId, nextObjectId); // dispatch saveQueryState action to save [query, objectList]

      self.setState({
        loading: false,
        object: nomalizeData(model, data.data),
        prevObjectId,
        objectId,
        nextObjectId,
      });
    }
  }
}

const onClickPrevObject = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const {
    apiEndpoint, model, objectFields,
    prevObjectId, objectList,
  } = self.state;

  const { handleSaveObjectSurffingState } = self.props;

  const objectId = prevObjectId;

  if (isObjectId(objectId)) {
    const clientContext = getApiContextFromSelf(self);
    const { error, data } = await apiGetById(apiEndpoint.read, objectId, objectFields, clientContext); // TODO: Only get model's field set

    if (error) {
      self.setState({
        error: true,
        loading: false,
        messages: apiError2Messages(error),
      });
    } else {
      const linkedObjects = getLinkedObjects(objectId, objectList.data || []);
      const { prevObjectId, nextObjectId } = linkedObjects;

      handleSaveObjectSurffingState(prevObjectId, objectId, nextObjectId); // dispatch saveQueryState action to save [query, objectList]

      self.setState({
        loading: false,
        object: nomalizeData(model, data.data),
        prevObjectId,
        objectId,
        nextObjectId,
      });
    }
  }
}

const onGoBack = async (self, event) => {
  event.preventDefault();

  self.setState({
    ...self.state,
    goToObjectList: true,
  });
}

const onCreate = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onCreate");

  const {
    apiEndpoint, model, object,
    gotoObjectListAfterSubmit, gotoNextAfterSubmit,
  } = state;

  let { error, data } = await validateData(model, object);

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });
    return;
  }

  const clientContext = getApiContextFromSelf(self);
  ({ error, data } = await apiCreate(apiEndpoint.create, data, clientContext));

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    const {
      data: createdObject,
      allowedApiActionList, allowedWorkflowActionList,
    } = data;

    const objectId = createdObject._id;

    self.setState({
      goToObjectList: gotoObjectListAfterSubmit || false,
      goToNextStep: gotoNextAfterSubmit || false,
      loading: false,
      success: true,
      messages: 'system:msg.update.success',

      objectId,
      object: nomalizeData(model, createdObject),

      allowedApiActionList,
      allowedWorkflowActionList,
    });
  }

  (transaction && transaction.end());
}

const onUpdate = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onUpdate");

  const {
    apiEndpoint, model, object,
    gotoObjectListAfterSubmit, gotoNextAfterSubmit,
  } = state;

  let { allowedApiActionList, allowedWorkflowActionList } = state;
  let { error, data } = await validateData(model, object);

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });
    return;
  }

  const clientContext = getApiContextFromSelf(self);
  ({ error, data } = await apiUpdateById(apiEndpoint.update, data, clientContext));

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    if (gotoObjectListAfterSubmit || gotoNextAfterSubmit) { // keep current page => update data
      ({ data, allowedApiActionList, allowedWorkflowActionList } = data);

      self.setState({
        object: nomalizeData(model, data),

        allowedApiActionList,
        allowedWorkflowActionList,

        goToObjectList: gotoObjectListAfterSubmit || false,
        goToNextStep: gotoNextAfterSubmit || false,
        loading: false,
        success: true,
        messages: 'system:msg.update.success',

        object: nomalizeData(model, data),
      });
    } else { // jump to another page => no need to update data
      self.setState({
        goToObjectList: gotoObjectListAfterSubmit || false,
        goToNextStep: gotoNextAfterSubmit || false,
        loading: false,
        success: true,
        messages: 'system:msg.update.success',
      });
    }
  }

  (transaction && transaction.end());
}

const onPrint = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onPrint");

  const {
    apiEndpoint, objectId, modelName,
  } = state;

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });
    return;
  }

  const nonVersionedModelName = modelName.split('/')[1];
  const voucherName = `${pluralize.singular(nonVersionedModelName)}Template`;
  const clientContext = getApiContextFromSelf(self);
  const { error, data } = await apiPrint(apiEndpoint.print, voucherName, { objectIdList: [objectId] }, clientContext);

  if (error) {
    self.setState({
      error: true,
      messages: apiError2Messages(error),
      loading: false,
    });
  } else {
    self.setState({
      loading: false,
    });

    // const blob = new Blob([data], { type: 'application/pdf' });
    // FileSaver.saveAs(blob, 'ticket.pdf');
    const blob = new Blob([data], { type: 'application/pdf' });
    var fileURL = window.URL.createObjectURL(blob);
    window.open(fileURL);
  }

  (transaction && transaction.end());
}

const onDelete = async (self, event) => {
  event.preventDefault();

  self.setState({ deleting: true });
}

const onDeleteCancel = async (self, event) => {
  event.preventDefault();

  self.setState({ deleting: false });
}

const onDeleteConfirm = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onDeleteConfirm");

  const { apiEndpoint, object } = state;
  const clientContext = getApiContextFromSelf(self);
  const { error } = await apiDeleteById(apiEndpoint.delete, object._id, clientContext);

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    self.setState({
      loading: false,
      goToObjectList: true,
      success: true,
      messages: 'system:msg.delete.inprocess',
    });
  }

  (transaction && transaction.end());
}

const onClickObjectList = async (self, event) => {
  event.preventDefault();

  self.setState({
    ...self.state,
    goToObjectList: true,
  });
}

const onClickCopyObject = async (self, event) => {
  event.preventDefault();

  const { objectId, object, workflow } = self.state;
  const { location, history, document } = window;
  const currentUrl = location.href;

  if (history.pushState) {
    history.pushState(history.state, document.title, currentUrl.replace(objectId, '0'));
  }

  const clonedObject = cloneObject(self, object);

  if (workflow) { // reset state field
    const { stateField, startingState } = workflow;

    clonedObject[stateField] = startingState;
  }

  // setState to copy current object
  self.setState({
    ...self.state,
    object: clonedObject,

    objectId: '0',
    prevObjectId: '',
    nextObjectId: '',

    gotoObjectCopyForm: true,
  });

  // setState to prevent reload again
  self.setState({ gotoObjectCopyForm: false });
}

const onRedirect = (self) => {
  if (!self || !self.state) return null;

  const { baseUrl } = self.props;
  const {
    goToObjectList, gotoObjectCopyForm,
    goToNextStep, nextUrlHandler,
  } = self.state;

  if (goToObjectList) {
    return <Redirect to={`${baseUrl}`} />;
  } else if (gotoObjectCopyForm) {
    return <Redirect to={`${baseUrl}/0`} />;
  } else if (goToNextStep) {
    return nextUrlHandler(self);
  }

  return null;
};

const onChangeComment = (self, event, comment, commentPlainText, commentMentionList) => {
  self.setState({
    ...self.state,

    comment,
    commentPlainText,
    commentMentionList,
  });
}

const onMentionComment = async (self, userName, callback) => {
  const query = {
    fields: [
      '_id', 'userName', 'fullName',
    ],

    limit: INSTANT_SEARCH_RETURNED_RESULT,

    userName: userName ? {
      $regex: userName,
      $options: 'i',
    }: null,

    sortBy: 'userName.asc',
  };

  const clientContext = getApiContextFromSelf(self);
  const { error, data } = await apiGetList('v1/users', query, clientContext);

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });

    callback([]);

    return;
  }

  const userList = data.data.map(user => {
    const { _id, userName, fullName } = user;

    return ({
      id: _id,
      display: `${userName}${COMMENT_MENTION_SEPARTOR}${fullName}`,
    });
  });

  self.setState({
    loading: false,
  });

  callback(userList);
}

const onTagComment = async (self, tagCode, callback) => {
  const query = {
    fields: [
      '_id', 'tagCode', 'tagName',
    ],

    limit: INSTANT_SEARCH_RETURNED_RESULT,

    tagCode: tagCode ? {
      $regex: tagCode,
      $options: 'i',
    } : null,

    sortBy: 'tagCode.asc',
  };

  const clientContext = getApiContextFromSelf(self);
  const { error, data } = await apiGetList(HASH_TAG_SERVICE_CODE, query, clientContext);

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });

    callback([]);

    return;
  }

  const tagList = data.data.map(tag => {
    const { _id, tagCode, tagName } = tag;

    return ({
      id: _id,
      display: `${tagCode}${COMMENT_MENTION_SEPARTOR}${tagName}`,
    });
  });

  if (tagCode && !tagList.length) {
    tagList.unshift({
      id: '0',
      display: `${tagCode}`,
    });
  }

  callback(tagList);
}

const onTriggerWorkflow = async (self, workflow, objectState, actionCode) => {
  if (!workflow) {
    self.setState({
      error: true,
      messages: [{
        name: 'workflow',
        message: VALIDATE_FAILURE,
      }],
    });

    return;
  }

  const { transitionList } = workflow;

  if (!transitionList) {
    self.setState({
      error: true,
      messages: [{
        name: 'transitionList',
        message: VALIDATE_FAILURE,
      }],
    });

    return;
  }

  const transition = transitionList.find(t => (t.fromState === objectState) && (t.actionCode === actionCode));

  if (!transition) {
    self.setState({
      error: true,
      messages: [{
        name: 'transition',
        message: VALIDATE_FAILURE,
      }],
    });

    return;
  }

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onTriggerWorkflow");

  const {
    apiEndpoint, object, model,
    gotoObjectListAfterSubmit, gotoNextAfterSubmit,
  } = state;

  let { allowedApiActionList, allowedWorkflowActionList } = state;

  let { error, data } = await validateData(model, object); // default validator by MODEL data type

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });

    return;
  }

  let objectId = data._id; // default by objectId

  const { validator } = transition;

  if (_.isFunction(validator)) { // call user defined validator + get validated data
    // TODO: cause of resending pre-creating data, overwriting server side created fields may be occured  
    ({ error, data } = await validator(data));

    if (error) {
      self.setState({
        loading: false,
        error: true,
        messages: error,
      });

      return;
    } else if (!data) {
      self.setState({
        loading: false,
        error: true,
        messages: [{
          name: 'triggerWorkflow data',
          message: VALIDATE_FAILURE,
        }],
      });

      return;
    }
  }

  self.setState(LOADING_STATE);
  const clientContext = getApiContextFromSelf(self);

  if (!isObjectId(objectId)) { // not created yet => create first
    const result = await apiCreate(apiEndpoint.create, data, clientContext);

    if (result.error) {
      self.setState({
        loading: false,
        error: true,
        messages: apiError2Messages(result.error),
      });

      return;
    }

    ({ data, allowedApiActionList, allowedWorkflowActionList } = result.data);
    objectId = data._id;
  }

  ({ error, data } = await apiTriggerWorkflow(apiEndpoint.triggerWorkflow, objectId, actionCode, data, clientContext));

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    ({ data, allowedApiActionList, allowedWorkflowActionList } = data);

    self.setState({
      objectId,
      object: nomalizeData(model, data),

      allowedApiActionList,
      allowedWorkflowActionList,

      goToObjectList: gotoObjectListAfterSubmit || false,
      goToNextStep: gotoNextAfterSubmit || false,
      loading: false,
      success: true,
      messages: 'system:msg.update.success',
    });
  }

  (transaction && transaction.end());
}

const onPost = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onPost");

  const {
    apiEndpoint, model, object,
    gotoObjectListAfterSubmit, gotoNextAfterSubmit,
  } = state;

  let { allowedApiActionList, allowedWorkflowActionList } = state;
  let { error, data } = await validateData(model, object);

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });
    return;
  }

  ({ error } = await validatePost(model, data));

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });
    return;
  }
  
  let objectId = data._id; // default by objectId

  const clientContext = getApiContextFromSelf(self);
  ({ error, data } = await apiPatch(apiEndpoint.post, objectId, data, clientContext));

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    if (gotoObjectListAfterSubmit || gotoNextAfterSubmit) { // keep current page => update data
      ({ data, allowedApiActionList, allowedWorkflowActionList } = data);

      self.setState({
        object: nomalizeData(model, data),

        allowedApiActionList,
        allowedWorkflowActionList,

        goToObjectList: gotoObjectListAfterSubmit || false,
        goToNextStep: gotoNextAfterSubmit || false,
        loading: false,
        success: true,
        messages: 'system:msg.update.success',

        object: nomalizeData(model, data),
      });
    } else { // jump to another page => no need to update data
      self.setState({
        goToObjectList: gotoObjectListAfterSubmit || false,
        goToNextStep: gotoNextAfterSubmit || false,
        loading: false,
        success: true,
        messages: 'system:msg.update.success',
      });
    }
  }

  (transaction && transaction.end());
}

const onReverse = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onReserve");

  const {
    apiEndpoint, model, object,
    gotoObjectListAfterSubmit, gotoNextAfterSubmit,
  } = state;

  let { allowedApiActionList, allowedWorkflowActionList } = state;
  let { error, data } = await validateData(model, object);

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });
    return;
  }

  ({ error } = await validatePost(model, data));

  if (error) {
    self.setState({
      loading: false,
      success: false,
      error: true,
      messages: error,
    });
    return;
  }

  let objectId = data._id; // default by objectId

  const clientContext = getApiContextFromSelf(self);
  ({ error, data } = await apiPatch(apiEndpoint.reverse, objectId, data, clientContext));

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    if (gotoObjectListAfterSubmit || gotoNextAfterSubmit) { // keep current page => update data
      ({ data, allowedApiActionList, allowedWorkflowActionList } = data);

      self.setState({
        object: nomalizeData(model, data),

        allowedApiActionList,
        allowedWorkflowActionList,

        goToObjectList: gotoObjectListAfterSubmit || false,
        goToNextStep: gotoNextAfterSubmit || false,
        loading: false,
        success: true,
        messages: 'system:msg.update.success',

        object: nomalizeData(model, data),
      });
    } else { // jump to another page => no need to update data
      self.setState({
        goToObjectList: gotoObjectListAfterSubmit || false,
        goToNextStep: gotoNextAfterSubmit || false,
        loading: false,
        success: true,
        messages: 'system:msg.update.success',
      });
    }
  }

  (transaction && transaction.end());
}

const onSendComment = async (self) => {
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName, baseUrl } = props;
  const transaction = apm.startTransaction(functionName, "onSendComment");

  const {
    modelName,
    objectId,
    commentPlainText, commentMentionList, // commentPlainText
  } = state;

  const mentionList = commentMentionList.filter(m => m.display.startsWith(COMMENT_MENTION_SIGN));
  const tagList = commentMentionList.filter(m => m.display.startsWith(COMMENT_TAG_SIGN));
  const nomalizedTagList = [];
  let error, data;
  const clientContext = getApiContextFromSelf(self);

  // console.log('commentMentionList', commentMentionList);

  for (let tag of tagList) {
    const { id, display } = tag;
    const tagCode = display.replace(COMMENT_TAG_SIGN, "")

    if (!isObjectId(id)) {
      const tagData = {
        tagCode,
        tagName: tagCode,
      };

     
      ({error, data} = await apiPost(HASH_TAG_SERVICE_CODE, tagData, clientContext));

      if (error) {
        self.setState({
          loading: false,
          error: true,
          messages: apiError2Messages(error),
        });

        return;
      }

      nomalizedTagList.push({
        id: data.data._id,
        display: tagCode,
      });
    } else {
      nomalizedTagList.push(tag);
    }
  };

  const postedData = {
    subject: `Bình luận cho ${modelName}`, // TODO: get Document No + translate moduleName
    content: commentPlainText,
    relatedModel: modelName,
    relatedDocumentId: objectId,
    refUrl: `${baseUrl}${objectId}`,

    followerList: mentionList.map(u => {
      const { id: userId, display } = u;
      const splitedDisplayName = display.split(COMMENT_MENTION_SEPARTOR);

      return ({
        userId,
        userName: splitedDisplayName[0].replace(COMMENT_MENTION_SIGN, ""),
        fullName: splitedDisplayName[1],
      });
    }),

    tagList: nomalizedTagList.map(t => {
      const { id: tagId, display } = t;

      return ({
        tagId,
        tagCode: display,
        tagName: display,
      });
    }),
  };

  ({error, data} = await apiPost(COMMENT_SERVICE_CODE, postedData, clientContext));

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });

    return;
  }

  const query = {
    fields: '_id, content, createdAt, createdBy, createdByUserName, createdByFullName',
    active: true,
    relatedModel: modelName,
    relatedDocumentId: objectId,
    sortBy: 'createdAt.desc',
  };

  ({ error, data } = await apiGetList(COMMENT_SERVICE_CODE, query, clientContext));

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });

    return;
  }

  self.setState({
    ...state,
    loading: false,
    comment: '',

    pageLoad: {
      ...state.pageLoad,

      commentList: {
        fieldName: 'commentList',
        data: data.data,
      },
    },
  });

  (transaction && transaction.end());
}

export const onUploadFile = async (self, uploadedFileList, fileListName) => {
  self.setState(LOADING_STATE);

  const { state, props } = self;
  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "onUploadFile");

  const { object } = state;
  const clientContext = getApiContextFromSelf(self);
  const { data, error } = await apiUpload(uploadedFileList, clientContext);

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else if (data) {
    const addedFileList = Array.from(object[fileListName]);

    data.data.forEach((file) => {
      addedFileList.push({
        fileId: file.id,
        fileName: file.filename,
        originalName: file.originalname,
        contentType: file.contentType,
        size: file.size,
        bucketName: file.bucketName,
        uploadDate: file.uploadDate,
      });
    });

    self.setState({
      loading: false,
      object: {
        ...object,
        [fileListName]: addedFileList,
      },
    });
  } else {
    self.setState({
      loading: false,
    });
  }

  (transaction && transaction.end());
}

const getInitalStateFromProps = (props) => {
  const {
    modelName, workflow,
    models, apiEndpoint,
    objectCodeField, objectNameField,
    objectList, functionName,
    prevObjectId, objectId, nextObjectId,
    gotoObjectListAfterSubmit,
    gotoNextAfterSubmit, nextUrlHandler,
    afterObjectLoaded, afterNewObjectLoaded,
    afterRefModelLoaded,
    pluginList, focus,
  } = props;

  apm.setInitialPageLoadName(functionName);

  const { model, refModels, objectFields } = models.object;
  const canComment = pluginList.includes(PLUGIN.COMMENT);

  // TODO: not clone unchanged data

  return {
    modelName, // main server model name
    model, // fom data model
    objectCodeField,
    objectNameField,
    apiEndpoint, // related api URL
    workflow,
    pluginList, // comment feature
    focus,

    objectFields, // related form fields
    refModels, // related reference models
    afterObjectLoaded, // after object loaded (by id)'s callback function
    afterNewObjectLoaded, // after object created's callback function
    afterRefModelLoaded,

    isListComponent: false, // form component
    pageLoad: {}, // reference data
    object: getDefaultModelValue(model), // object data

    allowedApiActionList: [],
    allowedWorkflowActionList : [],

    objectList, // paged searching result object list
    gotoObjectListAfterSubmit: (_.isBoolean(gotoObjectListAfterSubmit) ? gotoObjectListAfterSubmit : true), // go to list form after submit (current object) setting
    goToObjectList: false, // go to object list redirect flag

    goToPrevObject: false, // show prev object redirect flag
    prevObjectId,

    gotoObjectCopyForm: false, // goto copy form redirect flag
    objectId: objectId || props.id, // current object id

    gotoNextAfterSubmit: gotoNextAfterSubmit || false, // go to next object after submit (current object) setting
    goToNextStep: false,
    nextUrlHandler,

    goToNextObject: false, // show next object redirect flag
    nextObjectId,

    canComment,
    comment: '', // current user comment
    commentPlainText: '',
    commentMentionList: [],

    error: null, // form has error occur or not
    loading: false, // form is loading or not
    deleting: false, // delete popup is shown or not
  };
};

const initRef = (self, props) => {
  const { models } = props;
  const { model } = models.object;

  if (!model) {
    throw new BosError('model is undefined', BOS_ERROR.INVALID_ARG_VALUE);
  }

  Object.entries(model).forEach(([key, def]) => {
    const { isCreateRef } = def;
    if (isCreateRef) {
      self[`${key}Ref`] = createRef();
    }
  });
}

export const initComponent = (self, props) => {
  self.componentContext = createRef();

  initRef(self, props);
  self.state = getInitalStateFromProps(props);

  self.onChange = onChange.bind(self, self);
  self.onCreate = onCreate.bind(self, self);
  self.onUpdate = onUpdate.bind(self, self);
  self.onPrint = onPrint.bind(self, self);
  self.onDelete = onDelete.bind(self, self);
  self.onDeleteConfirm = onDeleteConfirm.bind(self, self);
  self.onDeleteCancel = onDeleteCancel.bind(self, self);

  self.onTriggerWorkflow = onTriggerWorkflow.bind(self, self);
  self.onPost = onPost.bind(self, self);
  self.onReverse = onReverse.bind(self, self);

  self.onAddSubDocument = onAddSubDocument.bind(self, self);
  self.onAppendSubDocument = onAppendSubDocument.bind(self, self);
  self.onDeleteSubDocument = onDeleteSubDocument.bind(self, self);

  self.onUploadFile = onUploadFile.bind(self, self);
  self.onDownloadFile = onDownloadFile.bind(self, self);

  self.onGoBack = onGoBack.bind(self, self);
  self.onClickNextObject = onClickNextObject.bind(self, self);
  self.onClickPrevObject = onClickPrevObject.bind(self, self);
  self.onClickObjectList = onClickObjectList.bind(self, self);
  self.onClickCopyObject = onClickCopyObject.bind(self, self);
  self.onRedirect = onRedirect.bind(self, self);

  self.onChangeComment = onChangeComment.bind(self, self);
  self.onMentionComment = onMentionComment.bind(self, self);
  self.onTagComment = onTagComment.bind(self, self);
  self.onSendComment = onSendComment.bind(self, self);
  self.onClickFunctionRegister = onClickFunctionRegister.bind(self, self);
  self.onClickOpenGuideline = onClickOpenGuideline.bind(self, self);
  self.onKeyDown = onKeyDown.bind(self, self);
};

export const getTitleProps = (self) => {
  const {
    state,
    onClickObjectList,
    onClickCopyObject,
    onClickPrevObject,
    onClickNextObject,
  } = self;

  const { functionName, prevObjectId, nextObjectId } = state;

  return ({
    title: functionName,
    prevObjectId,
    nextObjectId,

    onClickObjectList,
    onClickCopyObject,
    onClickPrevObject,
    onClickNextObject,
  });
};

export const loadComponentData = async (self) => {
  self.setState(LOADING_STATE);

  await checkLogin(self);

  const { props, state } = self;

  const {
    objectId,
    apiEndpoint,
    model, modelName,
    refModels, objectFields,
    afterObjectLoaded, afterNewObjectLoaded,
    afterRefModelLoaded,
    pageLoad, canComment,
  } = state;

  const { functionName } = props;
  const transaction = apm.startTransaction(functionName, "form.loadComponentData");

  const taskList = [];
  let object = {};
  let allowedApiActionList = [];
  let allowedWorkflowActionList = [];
  const clientContext = getApiContextFromSelf(self);
  const existedObject = isObjectId(objectId);

  if (existedObject) {
    const { error, data } = await apiGetById(apiEndpoint.read, objectId, objectFields, true, clientContext); // TODO: Only get model's field set

    if (error) {
      self.setState({
        error: true,
        messages: apiError2Messages(error),
        loading: false,
      });

      return;
    }

    object = nomalizeData(model, data.data);
    ({ allowedApiActionList, allowedWorkflowActionList } = data);

    if (canComment) {
      const { error, data } = await apiGetList(
        COMMENT_SERVICE_CODE, 
        {
          relatedModel: modelName,
          relatedDocumentId: objectId,
          fields: [
            '_id', 'content',
            'createdByUserName', 'createdAt',
          ],
        },
        clientContext,
      );

      if (!error) {
        pageLoad.commentList = {
          fieldName: 'commentList',
          data: data.data,
        };
      }
    }

    if (_.isFunction(afterObjectLoaded)) {
      await afterObjectLoaded(self, object);
    }
  } else {
    object = getDefaultModelValue(model);

    if (_.isFunction(afterNewObjectLoaded)) {
      await afterNewObjectLoaded(self, object);
    }
  }

  refModels.forEach((tmpModel) => {
    const {
      modelName, query, autoPageLoad,
      fieldName, refKeyField, relatedFields,
    } = tmpModel;

    if (autoPageLoad) { // [!] uniquePage[L]oad vs uniquePage[l]oad make error
      taskList.push(async (cb) => {
        const span = apm.startSpan(modelName, 'apiGetList');

        const { error, data } = await apiGetList(
          modelName,
          query,

          {
            ...clientContext,
            policyContext: fieldName,
          },
        );

        if (error) {
          cb(error);
        } else {
          const loadedData = data.data;

          const dataLoad = {
            fieldName,
            refKeyField,
            relatedFields,
            data: loadedData,
          };

          cb(null, dataLoad);
        }

        (span && span.end());
      });
    } else if (!pageLoad[fieldName]) { // pageLoad DID NOT init manualy
      taskList.push(async (cb) => {
        const dataLoad = {
          fieldName,
          refKeyField,
          relatedFields,
          data: [],
        };

        cb(null, dataLoad);
      });
    } // if (tmpModel.autoPageLoad)
  });

  await async.series(taskList, async (err, loadedRefData) => {
    if (err) {
      self.setState({
        loading: false,
        error: true,
        messages: apiError2Messages(err),
      });
    } else {
      if (_.isArray(loadedRefData)) { // convert array to object to easy access
        loadedRefData.forEach((refData) => {
          pageLoad[refData.fieldName] = refData;
        });
      }

      if (_.isFunction(afterRefModelLoaded)) {
        await afterRefModelLoaded(self, object);
      }

      self.setState({
        loading: false,
        pageLoad,
        object,
        allowedApiActionList,
        allowedWorkflowActionList,
      });
    }
  });

  (transaction && transaction.end());

  window.scrollTo(0, 0); // scroll to Top
}
