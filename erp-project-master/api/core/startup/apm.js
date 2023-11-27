import config from 'config';
import apm from '../helpers/apmHelper';

apm.init({
  serverUrl: config.get('apm.serverUrl'),
});

if (apm.isConnected()) {
  console.info('APM Server is connected.');
} else {
  console.info('APM Server is not connected.');
}
