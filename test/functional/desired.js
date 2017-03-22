import path from 'path';


const app = require.resolve('android-apidemos');

const DEFAULT_CAPS = {
  app,
  deviceName: 'Android',
  platformName: 'Android',
};

const CONTACT_MANAGER_CAPS = {
  app: path.resolve(__dirname, '..', '..', '..', 'test', 'assets', 'ContactManager.apk'),
  deviceName: 'Android',
  platformName: 'Android',
};

export { app, DEFAULT_CAPS, CONTACT_MANAGER_CAPS };
export default DEFAULT_CAPS;
