import { init as apmInit } from '@elastic/apm-rum';

let apmInstant;

const init = (options) => {
  apmInstant = apmInit(options);
}

const startTransaction = (name, type, options) => {
  if (apmInstant) {
    return apmInstant.startTransaction(name, type, options);
  }

  return null;
}

const getCurrentTransaction = () => {
  if (apmInstant) {
    return apmInstant.getCurrentTransaction();
  }

  return null;
}

const startSpan = (name, type, options) => {
  if (apmInstant) {
    apmInstant.startSpan(name, type, options);
  }

  return null;
}

const setUserContext = (context) => {
  if (apmInstant) {
    apmInstant.setUserContext(context);
  }
}

const setCustomContext = (context) => {
  if (apmInstant) {
    apmInstant.setCustomContext(context);
  }
}

const setInitialPageLoadName = (name) => {
  if (apmInstant) {
    apmInstant.setInitialPageLoadName(name);
  }
}

const captureError = (error) => {
  if (apmInstant) {
    apmInstant.captureError(error);
  }
}

const addLabels = (labels) => {
  if (apmInstant) {
    apmInstant.addLabels(labels);
  }
}

const apmAgent = { // [..] https://www.elastic.co/guide/en/apm/agent/rum-js/5.x/transaction-api.html
  init,
  startTransaction,
  getCurrentTransaction,
  startSpan,
  setUserContext,
  setCustomContext,
  setInitialPageLoadName,
  captureError,
  addLabels,
};

export default apmAgent;
