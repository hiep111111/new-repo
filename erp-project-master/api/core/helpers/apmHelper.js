import apmNode from 'elastic-apm-node';
import debug from 'debug';

const apmDebugger = debug('app:apm');

let apmAgentInstant;

const init = (options) => {
  apmAgentInstant = apmNode.start(options);
}

const isConnected = () => (apmAgentInstant && apmAgentInstant.isStarted());

const setCustomContext = (custom) => {
  if (isConnected()) {
    apmAgentInstant.setCustomContext(custom);
  } else {
    apmDebugger('APM Server is not connected.');
  }
}

const setUserContext = (user) => {
  if (isConnected()) {
    apmAgentInstant.setUserContext(user);
  } else {
    apmDebugger('APM Server is not connected.');
  }
}

const startSpan = (name, type, options) => {
  if (isConnected()) {
    return apmAgentInstant.startSpan(name, type, options);
  } else {
    apmDebugger('APM Server is not connected.');
  }

  return null;
}

const captureError = (error) => {
  if (isConnected()) {
    apmAgentInstant.captureError(error);
  } else {
    apmDebugger('APM Server is not connected.');
  }
}

const middlewareConnect = () => {
  if (isConnected()) {
    return apmAgentInstant.middleware.connect;
  } else {
    apmDebugger('APM Server is not connected.');
    return () => {};
  }
}

const apmAgent = {
  init,
  isConnected,
  setCustomContext,
  setUserContext,
  startSpan,
  captureError,
  middlewareConnect,
};

export default apmAgent;
