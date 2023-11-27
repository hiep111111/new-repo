/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-shadow */
/* eslint-disable react/no-multi-comp */
/* eslint-disable react/prefer-stateless-function */
/* eslint-disable no-param-reassign */
import React from 'react';
import async from 'async';
import _ from 'lodash';
import { Link, Redirect } from 'react-router-dom';
import FileSaver from 'file-saver';
import { Trans } from 'react-i18next';
import { Table } from 'semantic-ui-react';
import { format } from 'date-and-time';
import ReactHtmlParser from 'react-html-parser';
import qs from 'qs';

import apm from './apmHelper';
import { apiError2Messages } from './errorHelper';
import { getDrillDownName } from './aggregateHelper';

import {
  apiGetList, apiGet,
  apiCreate, apiDeleteById, apiUpdateById,
  apiDownloadList, apiUrlOptions,
} from './apiHelper';

import { equalToId, getInputValue, convertStringToArray, getFunctionName } from './commonHelper';
import { VALIDATE_FAILURE, ITEM_AMOUNT_PER_PAGE, DATE_TIME_FORMAT, DATE_FORMAT, PRIMARY_COLOR_CODE } from '../constants/config';
import { OPERATOR_SIGN, OPERATOR_REPLACER } from '../constants/mongoConstant';
import { API_ACTION_CODE } from './swaggerHelper';

import {
  LOADING_STATE,
  checkLogin, getApiContextFromSelf,
  getList, getLinkedObjects,
  onChange, onDownloadFile,
  removeJunkValue,
  onClickFunctionRegister,
  onClickOpenGuideline
} from './componentHelper';

import { AGGREGATE_TYPE } from './aggregateHelper';
import { DATA_TYPE } from '../constants/dataType';
import ActiveField from '../userControls/ActiveField';
import ProgressField from '../userControls/ProgressField';
import NumberValue from '../userControls/NumberValue';

const QUERY_SERVICE_CODE = 'v1/queries';

export const STATE_OPTION_LIST = [
  { text: 'Có hiệu lực', value: true },
  { text: 'Không có hiệu lực', value: false },
  { text: 'Tất cả', value: '' },
];

export const QUERY_AUTO_ADDED_FIELD = [
  'fields', 'hiddenFields',
  'exportedFields', 'freezeField',
  'page', 'itemsPerPage',
  'queryName', 'isDefaultQuery',
  'sortBy', 'groupBy',
  'checkPermission',
];

export const LIST_VIEW_MODE = {
  LIST: 'list', // or drillDown
  VISUALIZE: 'visualize',
  KANBAN: 'kanban',
  CALENDAR: 'calendar',
};

export const getNetSearchQuery = (query) => (_.omit(query, ['exportedFields']));

export const getNetExportQuery = (query) => {
  const { exportedFields, fields, hiddenFields } = query;

  return ({
    ..._.omit(query, ['exportedFields', 'fields', 'freezeField']),
    fields: _.difference(exportedFields, hiddenFields) || fields,
  });
};

export const gridCellRender = (key, field, type, value, freezedField, truncatedLength, fieldDef) => {
  if (field === 'active') {
    return (
      <Table.Cell textAlign="center" key={key} className={ freezedField ? 'fixed-column' : '' }>
        <ActiveField active={value} />
      </Table.Cell>);
  } else if (['createdAt', 'updatedAt'].includes(field)) {
    return (
      <Table.Cell textAlign="center" key={key} className={ freezedField ? 'fixed-column' : '' }>
        {value ? format(new Date(value), DATE_TIME_FORMAT) : ''}
      </Table.Cell>);
  }

  const href = fieldDef ? fieldDef.href : undefined;

  switch (type) {
    case DATA_TYPE.ARRAY: {
      return (
        <Table.Cell textAlign="left" key={key} className={ freezedField ? 'fixed-column' : '' }>
         { JSON.stringify(value) }
        </Table.Cell>
      );
    }

    case DATA_TYPE.HTML: {
      return (
        <Table.Cell textAlign="left" key={key} className={ freezedField ? 'fixed-column' : '' }>
          { ReactHtmlParser(value) }
        </Table.Cell>
      );
    }

    case DATA_TYPE.DOCUMENT_CODE: {
      return (
        <Table.Cell textAlign="left" key={key} className={ freezedField ? 'fixed-column' : '' }>
          { value }
        </Table.Cell>
      );
    }

    case DATA_TYPE.DESC_STRING:
    case DATA_TYPE.DOCUMENT_NAME:
    case DATA_TYPE.STRING: {
      if (href) {
        return (
          <Table.Cell textAlign="left" key={key} className={ freezedField ? 'fixed-column' : '' }>
            <Link
              to={`/${value.refUrl}/${value.originId}`.replace('//', '/')}
              onClick={(e) => { e.preventDefault(); window.open(`${window.location.origin}/${value.refUrl}/${value.originId}`);  }}
              style={{ color: PRIMARY_COLOR_CODE }}
            >
              {value.value}
            </Link>
          </Table.Cell>
        )
      }


      if (truncatedLength) {
        return (
          <Table.Cell textAlign="left" key={key} className={ freezedField ? 'fixed-column' : '' }>
            { _.truncate(value, { 'length': truncatedLength, 'omission': '...' }) }
          </Table.Cell>
        );
      }

      return (
        // <Table.Cell textAlign="left" key={key} className={ freezedField ? 'fixed-column' : '' }>
        <Table.Cell textAlign="left" key={key} className={`${value && value.length > 70 ? 'break-spaces' : ''} ${freezedField ? 'fixed-column' : ''}`}>
          { value }
        </Table.Cell>
      );
    }    

    case DATA_TYPE.BOOL:
    case DATA_TYPE.BOOLEAN: {
      return (
        <Table.Cell textAlign="center" key={key} className={ freezedField ? 'fixed-column' : '' }>
          <ActiveField active={value} />
        </Table.Cell>
      );
    }

    case DATA_TYPE.POSTED_NUMBER:
    case DATA_TYPE.NUMBER: {
      return (
        <Table.Cell textAlign="right" key={key} className={ freezedField ? 'fixed-column' : '' }>
          <NumberValue value={value} />
        </Table.Cell>
      );
    }

    case DATA_TYPE.PROGRESS: {
      return (
        <Table.Cell textAlign="right" key={key} className={ freezedField ? 'fixed-column' : '' }>
          <ProgressField value={ value || 0 } readOnly size="small" />
        </Table.Cell>
      );
    }

    case DATA_TYPE.GL_DATE:
    case DATA_TYPE.DATE: {
      return (
        <Table.Cell textAlign="center" key={key} className={ freezedField ? 'fixed-column' : '' }>
          <React.Fragment>{value ? format(new Date(value), DATE_FORMAT) : ''}</React.Fragment>
        </Table.Cell>
      );
    }

    case DATA_TYPE.DATE_TIME:
      return (
        <Table.Cell textAlign="center" key={key} className={ freezedField ? 'fixed-column' : '' }>
          <React.Fragment>{value ? format(new Date(value), DATE_TIME_FORMAT) : ''}</React.Fragment>
        </Table.Cell>
      );

    default:
      return (
        <Table.Cell textAlign="center" key={key} className={ freezedField ? 'fixed-column' : '' }>
          { String(value) }
        </Table.Cell>
      );
  }
}

const onPageChange = async (self, target, navData) => {
  target.preventDefault();
  self.setState(LOADING_STATE);

  const { apiEndpoint, query } = self.state;

  const searchingQuery = {
    ...query,
    page: navData.children,
  };

  await getList(self, apiEndpoint.read, searchingQuery);
}

const onItemsPerPageChange = async (self, target, data) => {
  target.preventDefault();
  self.setState(LOADING_STATE);

  const { apiEndpoint, query } = self.state;

  const searchingQuery = {
    ...query,
    page: 1,
    itemsPerPage: data.value,
  };

  await getList(self, apiEndpoint.read, searchingQuery);
}

const onSearch = async (self, event) => {
  event.preventDefault();

  self.setState(LOADING_STATE);

  const { functionName } = self.props;
  const transaction = apm.startTransaction(functionName, "onSearch");

  const { apiEndpoint, query } = self.state;

  const searchingQuery = {
    ...query,
    page: 1,
  };

  await getList(self, apiEndpoint.read, searchingQuery);

  transaction.end();
}

const onToggleFilter = async (self, event) => {
  event.preventDefault();

  const { showFilterPopUp } = self.state;

  self.setState({
    showFilterPopUp: !showFilterPopUp,
  });
}

const onToggleUtility = async (self, event) => {
  event.preventDefault();

  const { showUtilityPopUp } = self.state;

  self.setState({
    showUtilityPopUp: !showUtilityPopUp,
  });
}

const onToggleVisualize = async (self, event) => {
  event.preventDefault();

  const { viewMode } = self.state;

  self.setState({
    viewMode: (viewMode !== LIST_VIEW_MODE.VISUALIZE) ? LIST_VIEW_MODE.VISUALIZE : LIST_VIEW_MODE.LIST,
  });
}

const onToggleCalendarView = async (self, event) => {
  event.preventDefault();

  const { viewMode } = self.state;

  self.setState({
    viewMode: (viewMode !== LIST_VIEW_MODE.CALENDAR) ? LIST_VIEW_MODE.CALENDAR : LIST_VIEW_MODE.LIST,
  });
}

export const getKanbanQueryThread = (self, taskList, apiEndpoint, kanbanLaneList, kanbanFieldList, objectCodeField, objectNameField, stateField) => {
  const { query } = self.state;
  const netQuery = {};
  const clientContext = getApiContextFromSelf(self);

  Object.entries(query).forEach(([key, value]) => { // generate query string
    if (value && !QUERY_AUTO_ADDED_FIELD.includes(key)) {
      netQuery[key] = value;
    }
  });

  const queryTemplate = {
    ...netQuery,

    offset: 0,
    limit: ITEM_AMOUNT_PER_PAGE,
    orderBy: '_id.desc',
  };

  kanbanLaneList.forEach(state => {
    taskList.push(async (cb) => {
      const query = kanbanFieldList ? {
        ...queryTemplate,
  
        [stateField]: state,

        fields: [
          '_id',
          ...kanbanFieldList,
        ],
      } :
      {
        ...queryTemplate,

        [stateField]: state,

        fields: [
          '_id',
          objectCodeField,
          objectNameField,
        ],
      };

      const { error, data } = await apiGetList(apiEndpoint.read, query, clientContext);

      cb(error, data ? { state, data: data.data, length: data.length } : null);
    });
  });
};

const onToggleKanban = async (self, event) => {
  event.preventDefault();

  const { props, state, onSearch, onClickDrillDown } = self;
  const { workflow, objectCodeField, objectNameField, kanbanLaneList, kanbanFieldList } = props;
  const { apiEndpoint, viewMode, groupBy } = state;
  const { stateField } = workflow;

  if (viewMode !== LIST_VIEW_MODE.KANBAN) {
    const taskList = [];

    getKanbanQueryThread(self, taskList, apiEndpoint, kanbanLaneList, kanbanFieldList, objectCodeField, objectNameField, stateField);

    async.parallel(taskList, (error, results) => {
      if (error) {
        self.setState({
          error: true,
          success: false,
          messages: apiError2Messages(error),
          loading: false,
        });
      } else {
        self.setState({
          error: false,
          loading: false,
          viewMode: LIST_VIEW_MODE.KANBAN,
          kanban: results
        });
      }
    });
  } else {
    if (!groupBy.length) {
      onSearch(event);
    } else {
      onClickDrillDown(event, 0, {});
    }
  }
}

const onChangeGroupBy = (self, e, data) => {
  e.preventDefault();

  self.setState({
    groupBy: data.value,
  });
}

const onClickDrillDown = async (self, e, level, match, drillDownLevelX, nodeValue, nodeClicked) => {
  e.preventDefault();

  const clientContext = getApiContextFromSelf(self);
  const { modelName, apiEndpoint, query, groupBy, drillDown } = self.state;
  const groupByDeepLevel = groupBy.length;

  if (groupByDeepLevel === 0) { // not in drillDown mode
    self.setState({
      error: true,
      loading: false,
      message: 'system:filter.failure',
      viewMode: LIST_VIEW_MODE.LIST,
    });

    return;
  }

  const groupByField = groupBy[level];
  const mergedMatch = _.cloneDeep(match);

  _.merge(mergedMatch, removeJunkValue(self, query));
  // mergedMatch = _.omit(mergedMatch, QUERY_AUTO_ADDED_FIELD); // if run this command will make paging issue

  if (level < groupByDeepLevel) { // drill down
    let matchString = qs.stringify(mergedMatch, apiUrlOptions);

    // TODO: aggregate paging to prevent long return result

    const { error, data } = await apiGet(apiEndpoint.aggregate,`${AGGREGATE_TYPE.COUNT}/?groupBy=${groupByField}&${matchString}`, clientContext)

    if (error) {
      self.setState({
        error: true,
        messages: apiError2Messages(error),
        loading: false,
        showFilterPopUp: false,
        viewMode: LIST_VIEW_MODE.LIST,
      });
    } else {
      const drillDownName = getDrillDownName(modelName, groupBy, level, mergedMatch);

      let newDrillDown = [];

      if (level === 0) {
        newDrillDown = [
          {
            name: drillDownName,
            level,
            match: mergedMatch,
            groupBy: groupByField,
            data: data.data,
            clicked: false,
          },
        ];
      } else {
        newDrillDown = [ // drill down
          {
            ...drillDownLevelX,
            data: drillDownLevelX.data.map((d) => (d._id === nodeValue ? {...d, clicked: !nodeClicked } : d)),
          },
          ...drillDown.filter(d => ![drillDownLevelX.name, drillDownName].includes(d.name)), // spread other node
          {
            name: drillDownName,
            level,
            match: mergedMatch,
            groupBy: groupByField,
            data: data.data,
            clicked: false,
          },
        ];
      }

      self.setState({
        loading: false,
        error: false,
        showFilterPopUp: false,
        drillDown: newDrillDown,
        viewMode: LIST_VIEW_MODE.LIST,
      });
    }
  } else { // get object list
    const { error, data } = await apiGetList(apiEndpoint.read, removeJunkValue(self, getNetSearchQuery(mergedMatch)), clientContext);

    if (error) {
      self.setState({
        error: true,
        success: false,
        messages: apiError2Messages(error),
        loading: false,
        showFilterPopUp: false,
        viewMode: LIST_VIEW_MODE.LIST,
      });
    } else {
      const drillDownName = getDrillDownName(modelName, groupBy, level, mergedMatch);

      self.setState({
        error: false,
        loading: false,
        viewMode: LIST_VIEW_MODE.LIST,

        showFilterPopUp: false,

        drillDown: [
          {
            ...drillDownLevelX,
            data: drillDownLevelX.data.map((d) => (d._id === nodeValue ? {...d, clicked: !nodeClicked } : d)),
          },
          ...drillDown.filter(d => ![drillDownLevelX.name, drillDownName].includes(d.name)), // spread other node
          {
            name: drillDownName,
            level: groupByDeepLevel,
            match: mergedMatch,
            groupBy: groupByField,
            data: data.data.map(d => ({...d, clicked: false })),
            totalAmount: data.length,
            page: 1,
            itemsPerPage: ITEM_AMOUNT_PER_PAGE,
          },
        ],

        prevObjectId: '',
        objectId: '',
        nextObjectId: '',
      });
    }
  }
}

const onResetGroupBy = (self, event) => {
  event.preventDefault();

  self.setState({
    groupBy: [],
  });
}

const onExport = async (self, event) => {
  event.preventDefault();
  self.setState(LOADING_STATE);

  const { functionName } = self.props;
  const transaction = apm.startTransaction(functionName, "onExport");

  const { apiEndpoint, query } = self.state;
  const { data, error } = await apiDownloadList(apiEndpoint.export, '', removeJunkValue(self, getNetExportQuery(query)), self);

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

    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    FileSaver.saveAs(blob, `${getFunctionName().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')}-${format(new Date(), 'YYMMDDHHmm')}.xlsx`);
  }

  transaction.end();
}

const onSortBy = async (self, fieldName) => {
  self.setState(LOADING_STATE);

  const { apiEndpoint, query } = self.state;
  const sortBy = query.sortBy ? convertStringToArray(query.sortBy, '.') : [];
  const sortedField = sortBy[0] || '';
  const sortDirection = sortBy[1] === 'desc' ? 'desc' : 'asc';

  query.page = 1; // reset to 1rst page when REsearch

  if (fieldName === sortedField) {
    query.sortBy = `${fieldName}.${sortDirection === 'desc' ? 'asc' : 'desc'}`;
  } else {
    query.sortBy = `${fieldName}.asc`;
  }

  await getList(self, apiEndpoint.read, query);
}

const onSelectAllObjectList = async (self, event, data) => {
  event.preventDefault();

  const { objectList } = self.state;
  const { value } = getInputValue(data);
  const selectedObjectList = [];

  if (value && objectList && objectList.length) {
    objectList.data.forEach((o) => {
      selectedObjectList.push(o._id);
    });
  }

  self.setState({
    selectedAll: value,
    selectedObjectList,
  });
}

const onSelectObject = async (self, event, data) => {
  event.preventDefault();

  const { selectedObjectList } = self.state;
  const { name, value } = getInputValue(data);
  const newSelectedObjectList = Array.from(selectedObjectList); // [!] NOT create new Array make NOT RE-render

  if (value) {
    newSelectedObjectList.push(name);
  } else {
    _.remove(newSelectedObjectList, id => equalToId(id, name));
  }

  self.setState({
    selectedObjectList: newSelectedObjectList,
  });
}

const onResetQuery = async (self, event) => {
  event.preventDefault();

  const { defaultQuery } = self.state;

  self.setState({
    query: defaultQuery,
    selectedQueryId: '',
  });

  // await getList(self, apiEndpoint.read, defaultQuery);
}

const onObjectClick = async (self, objectId) => {
  const {
    queryList, selectedQueryId,
    query, objectList,
    pageLoad,
  } = self.state;

  const { handleSaveQueryState } = self.props;
  const { prevObjectId, nextObjectId } = getLinkedObjects(objectId, objectList.data ? objectList.data : []);

  handleSaveQueryState(queryList, selectedQueryId, query, objectList, pageLoad, prevObjectId, objectId, nextObjectId); // dispatch saveQueryState action to save [query, objectList]

  self.setState({ // redirect to object detail form
    ...self.state,

    goToObject: true,

    prevObjectId,
    objectId,
    nextObjectId,
  });
}

const onCreateNew = async (self) => {
  const {
    queryList, selectedQueryId,
    query, objectList,
    pageLoad,
  } = self.state;

  const { handleSaveQueryState } = self.props;

  handleSaveQueryState(queryList, selectedQueryId, query, objectList, pageLoad, '', '0', ''); // dispatch saveQueryState action to save [query, objectList]

  self.setState({ // redirect to object detail form
    ...self.state,

    goToObject: true,

    prevObjectId: '',
    objectId: '0',
    nextObjectId: '',
  });
}

const onClickFirstObject = async (self) => {
  const {
    queryList, selectedQueryId,
    query, objectList, objectId,
    pageLoad,
  } = self.state;

  if (!objectId) {
    const { handleSaveQueryState } = self.props;
    const objectListData = objectList.data;
    const newObjectId = objectListData && (objectListData.length > 0) ? objectListData[0]._id.toString() : '';
    const nextObjectId = objectListData && (objectListData.length > 1) ? objectListData[1]._id.toString() : '';

    handleSaveQueryState(queryList, selectedQueryId, query, objectList, pageLoad, '', newObjectId, nextObjectId); // dispatch saveQueryState action to save [query, objectList]

    self.setState({ // redirect to object detail form
      ...self.state,
      goToObject: true,

      prevObjectId: '',
      objectId: newObjectId,
      nextObjectId,
    });
  } else {
    self.setState({ // redirect to object detail form
      ...self.state,
      goToObject: true,
    });
  }
}

const onSaveQuery = async (self) => {
  const { query, groupBy } = self.state;
  const { queryName, isDefaultQuery } = query;

  const {
    userId, userName, userFullName,
    functionId, functionName,
    baseUrl, 
  } = self.props;

  const messages = [];

  if (!queryName) {
    messages.push({
      name: 'queryName',
      message: VALIDATE_FAILURE,
    });

    self.setState({
      error: true,
      messages,
    });

    return;
  }

  const clientContext = getApiContextFromSelf(self);
  self.setState(LOADING_STATE);

  const nomalizedQuery = {};

  Object.entries(query).forEach(([key, value]) => {
    if (QUERY_AUTO_ADDED_FIELD.indexOf(key) < 0 && value) {
      nomalizedQuery[key.replace(OPERATOR_SIGN, OPERATOR_REPLACER)] = value;
    }
  });

  const newQuery = {
    userId,
    userName,
    userFullName,

    functionId,
    functionUrl: baseUrl,
    functionName,

    queryName,
    isDefaultQuery,
    query: nomalizedQuery,
    groupBy,
  };

  const { error } = await apiCreate(QUERY_SERVICE_CODE, newQuery, clientContext);

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });

    return;
  }

  const savedQueryList = await apiGetList(
    QUERY_SERVICE_CODE,
    {
      userId,
      functionId,
      fields: [
        '_id', 'queryName',
        'isDefaultQuery',
        'query', 'groupBy',
      ],
      active: true,
    },
    clientContext,
  );

  if (savedQueryList.error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(savedQueryList.error),
    });

    return;
  }

  self.setState({
    loading: false,
    queryName: '',
    isDefaultQuery: false,
    queryList: savedQueryList.data.data,
  });
}

const onRedirect = (self) => {
  if (!self || !self.state) return null;

  const { baseUrl } = self.props;
  const { goToObject, objectId, objectUrlHandler } = self.state;
  const url = `${baseUrl}/${objectId}`.replace('//', '/');

  if (goToObject === true) {
    if (objectUrlHandler) {
      return objectUrlHandler(self);
    }

    return <Redirect to={url} />;
  }

  return null;
};

const onSetQueryAsDefault = async (self, queryId, isDefaultQuery) => {
  self.setState(LOADING_STATE);

  const { queryList } = self.state;
  let selectedQuery = {};

  if (isDefaultQuery) { // default => no set
    queryList.forEach((query) => {
      if (equalToId(query._id, queryId)) {
        query.isDefaultQuery = !isDefaultQuery;
        selectedQuery = query;
      }
    });
  } else { // not set => default
    queryList.forEach((query) => {
      if (equalToId(query._id, queryId)) {
        query.isDefaultQuery = !isDefaultQuery;
        selectedQuery = query;
      } else {
        query.isDefaultQuery = isDefaultQuery;
      }
    });
  }

  const clientContext = getApiContextFromSelf(self);
  const { error } = await apiUpdateById(QUERY_SERVICE_CODE, selectedQuery, clientContext); // TODO: auto unset other "isDefaultQuery" with same functionId & userId

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    self.setState({
      loading: false,
      queryList,
      success: true,
      messages: 'system:msg.update.success',
    });
  }
}

const onDeleteQuery = async (self, queryId) => {
  self.setState(LOADING_STATE);

  const clientContext = getApiContextFromSelf(self);
  const { error } = await apiDeleteById(QUERY_SERVICE_CODE, queryId, clientContext); // TODO: delete NOT work

  if (error) {
    self.setState({
      loading: false,
      error: true,
      messages: apiError2Messages(error),
    });
  } else {
    self.setState({
      loading: false,
      queryList: self.state.queryList.filter(f => !equalToId(f._id, queryId)),
      success: true,
      messages: 'system:msg.delete.success',
    });
  }
}

const onRunAsQuery = async (self, event, data) => {
  event.preventDefault();

  const { queryList, defaultQuery } = self.state;
  const { value } = getInputValue(data);

  if (value) {
    const selectedQuery = queryList.find(f => f._id, value);
    const { query, groupBy } = selectedQuery;

    if (query) {
      self.setState({
        selectedQueryId: value,
        query,
        groupBy,
      });
    }
  } else {
    self.setState({
      query: defaultQuery,
      groupBy: [],
      selectedQueryId: '',
    });
  }
}

const onClickAdvancedSearch = (self) => {
  self.setState({
    showAdvancedSearch: !self.state.showAdvancedSearch,
  });
}

const getInitalStateFromProps = (props) => {
  const {
    modelName, models, workflow,
    apiEndpoint,
    pageLoad, functionName,
    queryList, selectedQueryId,
    query, objectList, defaultQuery,
    prevObjectId, objectId, nextObjectId,
    objectUrlHandler,
    viewMode, groupBy,
  } = props;

  apm.setInitialPageLoadName(functionName);

  const { model, refModels } = models.query;
  const { model: schema } = models.object;

  return {
    modelName,
    model,
    schema,
    workflow,

    apiEndpoint,
    refModels,

    isListComponent: true,
    pageLoad: pageLoad || {},

    query: {
      ...query,
      queryName: '',
      isDefaultQuery: false,
    },

    allowedApiActionList: [], // not used yet
    allowedWorkflowActionList : [], // not used yet

    defaultQuery, // user defined default query
    queryList, // saved user query list
    selectedQueryId, // selected user query
    showAdvancedSearch: false, // show advanced search flag
    quickSearchValue: '',

    objectList, // searched result
    selectedAll: false, // all object is selected
    selectedObjectList: [], // selected object list

    prevObjectId, // prev objectId of form (component) objectId

    goToObject: false, // goto form flag
    objectId, // form (component) objectId
    objectUrlHandler, // user defined form component redirect (on object click)

    nextObjectId, // next objectId of form (component) objectId

    error: null, // list form error occurs
    loading: false, // list form loading flag

    viewMode: viewMode || LIST_VIEW_MODE.LIST,

    showFilterPopUp: false,

    showUtilityPopUp: false,

    groupBy: groupBy || [],
    drillDown: [],

    kanban: [],
  };
};

const onDeleteSelectedItem = async (self) => {
  self.setState({ deleting: true });
}

// called in userControls/ListNavigator.jsx
const onCancelDeletingSelectedItem = async (self) => {
  self.setState({ deleting: false });
}

// called in userControls/ListNavigator.jsx
export const onConfirmDeletingSelectedItem = async (self) => {
  self.setState(LOADING_STATE);

  const clientContext = getApiContextFromSelf(self);
  const { selectedObjectList, apiEndpoint, query } = self.state;
  const errorList = [];

  selectedObjectList.forEach(async (objectId) => {
    const { error } = await apiDeleteById(apiEndpoint.delete, objectId, clientContext);

    if (error) {
      errorList.push(error);
    }
  });

  if (errorList.length > 0) {
    self.setState({
      loading: false,
      error: true,
      messages: 'msg.delete.failure',
      deleting: false,
    });

    return;
  }

  // [?] query.page = 1 => MAKE ERROR
  const newQuery = {
    ...query,
    page: 1,
  };

  const { error, data } = await apiGetList(apiEndpoint.read, removeJunkValue(self, newQuery), clientContext);

  if (error) {
    self.setState({
      query, // [!] fix onChange with 2rd 3th.. page
      error: true,
      success: false,
      messages: apiError2Messages(error),
      loading: false,
      deleting: false,
    });
  } else {
    self.setState({
      query, // [!] fix onChange with 2rd 3th.. page
      loading: false,
      objectList: data,
      prevObjectId: '',
      objectId: '',
      nextObjectId: '',
      selectedObjectList: [],
      deleting: false,
    });
  }
};

export const initComponent = (self, props) => {
  self.state = getInitalStateFromProps(props);

  self.onChange = onChange.bind(self, self);
  self.onPageChange = onPageChange.bind(self, self);
  self.onItemsPerPageChange = onItemsPerPageChange.bind(self, self);
  self.onSearch = onSearch.bind(self, self);

  self.onToggleFilter = onToggleFilter.bind(self, self);
  self.onToggleUtility = onToggleUtility.bind(self, self);
  self.onToggleVisualize = onToggleVisualize.bind(self, self);
  self.onToggleCalendarView = onToggleCalendarView.bind(self, self);
  self.onToggleKanban = onToggleKanban.bind(self, self);

  self.onResetGroupBy = onResetGroupBy.bind(self, self);
  self.onChangeGroupBy = onChangeGroupBy.bind(self, self);
  self.onClickDrillDown = onClickDrillDown.bind(self, self);

  self.onExport = onExport.bind(self, self);
  self.onResetQuery = onResetQuery.bind(self, self);
  self.onObjectClick = onObjectClick.bind(self, self);
  self.onCreateNew = onCreateNew.bind(self, self);
  self.onClickFirstObject = onClickFirstObject.bind(self, self);
  self.onClickFunctionRegister = onClickFunctionRegister.bind(self, self);
  self.onClickOpenGuideline = onClickOpenGuideline.bind(self, self);
  self.onClickAdvancedSearch = onClickAdvancedSearch.bind(self, self);
  self.onDownloadFile = onDownloadFile.bind(self, self);

  self.onSaveQuery = onSaveQuery.bind(self, self);
  self.onDeleteQuery = onDeleteQuery.bind(self, self);
  self.onSetQueryAsDefault = onSetQueryAsDefault.bind(self, self);
  self.onRunAsQuery = onRunAsQuery.bind(self, self);

  self.onDeleteSelectedItem = onDeleteSelectedItem.bind(self, self);
  self.onCancelDeletingSelectedItem = onCancelDeletingSelectedItem.bind(self, self);
  self.onConfirmDeletingSelectedItem = onConfirmDeletingSelectedItem.bind(self, self);

  self.onSortBy = onSortBy.bind(self, self);
  self.onRedirect = onRedirect.bind(self, self);

  self.onSelectAllObjectList = onSelectAllObjectList.bind(self, self);
  self.onSelectObject = onSelectObject.bind(self, self);
};

export const loadComponentData = async (self) => {
  const { props, state } = self;

  const {
    apiEndpoint,
    refModels,
    query,
    objectId,
    viewMode,
  } = state;

  const {
    functionName, modelName,
    workflow,
    objectCodeField, objectNameField,
    kanbanLaneList, kanbanFieldList,
  } = props;

  const transaction = apm.startTransaction(functionName, "list.loadComponentData");
  const clientContext = getApiContextFromSelf(self);

  self.setState(LOADING_STATE);

  await checkLogin(self);

  const taskList = [];

  // TODO: not reload refModel if redirect from form view

  refModels.forEach((tmpModel) => {
    const {
      autoPageLoad,
      fieldName,
      modelName: refModelName,
      query,
    } = tmpModel;

    if (autoPageLoad) {
      taskList.push(async (cb) => {
        const nomalizedQuery = removeJunkValue(self, query);
        const span = apm.startSpan(refModelName, 'apiGetList');

        (span && span.addLabels({
          query: JSON.stringify(nomalizedQuery),
        }));

        const { error, data } = await apiGetList(
          refModelName,
          nomalizedQuery,
          
          {
            ...clientContext,
            policyContext: fieldName,
          },
        );

        if (error) {
          cb(error);
        } else {
          const pageLoad = {
            fieldName,
            data: data.data,
          };

          cb(null, pageLoad);

          (span && span.end());
        }
      });
    } // if (tmpModel.autoPageLoad)
  });

  await async.series(taskList, async (err, loadedRefData) => {
    if (err) {
      self.setState({
        error: true,
        messages: apiError2Messages(err),
        loading: false,
      });
    } else {
      let defaultQuery = null;
      let queryList = [];
      let mergedQuery = { ...query };
      let groupBy = [];
      let selectedQueryId = '';

      const { userId, functionId } = self.props;

      if (userId && functionId) { // TODO: fix CAN NOT GET { userId, functionId } if app reload by F5
        const savedQueryList = await apiGetList(
          QUERY_SERVICE_CODE,

          {
            userId,
            functionId,
            fields: [
              '_id', 'queryName',
              'isDefaultQuery',
              'query', 'groupBy',
            ],
            active: true,
          },

          clientContext,
        );

        if (!savedQueryList.error) {
          queryList = savedQueryList.data.data;

          defaultQuery = queryList.find(f => f.isDefaultQuery);
          const nomilizedDefaultQuery = {};

          if (_.isObject(defaultQuery)) {
            let templatedQuery;

            ({
              _id: selectedQueryId,
              groupBy,
              query: templatedQuery,
            } = defaultQuery);

            Object.entries(templatedQuery).forEach(([key, value]) => {
              nomilizedDefaultQuery[key.replace(OPERATOR_REPLACER, OPERATOR_SIGN)] = value;
            });

            _.merge(mergedQuery, nomilizedDefaultQuery);
          }
        }
      }

      mergedQuery.checkPermission = true; // request to return api permission also

      const { error, data } = await apiGetList(apiEndpoint.read, removeJunkValue(self, getNetSearchQuery(mergedQuery)), clientContext);

      if (error) {
        self.setState({
          error: true,
          messages: apiError2Messages(error),
          loading: false,
        });
      } else {
        const pageLoad = {};

        if (_.isArray(loadedRefData)) { // convert array to object to easy access
          loadedRefData.forEach((refData) => {
            pageLoad[refData.fieldName] = refData;
          });
        }

        const objectList = _.omit(data, ['allowedApiActionList']);
        const allowedApiActionList = data.allowedApiActionList || [];

        let { batchActionList } = self.props;   // [!] Cause of props change twice but component load once => CAN NOT save in state
        const DELETE_SELECTED_ITEM = 'onDeleteSelectedItem';

        if (!batchActionList.find(a => a.actionCode === DELETE_SELECTED_ITEM) && allowedApiActionList.includes(API_ACTION_CODE.DELETE)) {
          batchActionList.push({
            actionCode: DELETE_SELECTED_ITEM,
            actionName: <Trans i18nKey={`system:selection.${DELETE_SELECTED_ITEM}`} defaults={DELETE_SELECTED_ITEM} />,
            actionHandler: onDeleteSelectedItem,
          });
        }

        if (viewMode === LIST_VIEW_MODE.KANBAN) {
          const { stateField } = workflow;
          const taskList = [];

          getKanbanQueryThread(self, taskList, apiEndpoint, kanbanLaneList, kanbanFieldList, objectCodeField, objectNameField, stateField);

          async.parallel(taskList, (error, results) => {
            if (error) {
              self.setState({
                error: true,
                success: false,
                messages: apiError2Messages(error),
                loading: false,
              });
            } else {
              self.setState({
                loading: false,
                pageLoad,
                objectList,
                allowedApiActionList,
      
                queryList,
                query: mergedQuery,
                selectedQueryId,
                groupBy,

                prevObjectId: '',
                objectId,
                nextObjectId: '',

                kanban: results,
              });
            }
          });
        } else { // detail list
          let drillDown = [];

          if (groupBy.length) {
            const groupByField = groupBy[0];
            let mergedMatch = {};

            _.merge(mergedMatch, removeJunkValue(self, mergedQuery));

            let matchString = qs.stringify(removeJunkValue(self, mergedMatch), apiUrlOptions);

            const drillDownData = await apiGet(apiEndpoint.aggregate,`${AGGREGATE_TYPE.COUNT}/?groupBy=${groupByField}&${matchString}`, clientContext)

            if (drillDownData.error) {
              self.setState({
                error: true,
                messages: apiError2Messages(drillDownData.error),
                loading: false,
              });
            } else {
              const drillDownName = getDrillDownName(modelName, groupBy, 0, {});

              drillDown = [
                {
                  name: drillDownName,
                  level: 0,
                  match: mergedMatch,
                  groupBy: groupByField,
                  data: drillDownData.data.data,
                  clicked: false,
                },
              ];
            }
          }

          self.setState({
            loading: false,
            pageLoad,
            objectList,
            allowedApiActionList,
  
            queryList,
            query: mergedQuery,
            selectedQueryId,
            groupBy,
            drillDown,
  
            prevObjectId: '',
            objectId,
            nextObjectId: '',
          });
        }
      }
    }
  });

  (transaction && transaction.end());

  window.scrollTo(0, 0); // scroll to Top
}
