//import _ from 'lodash';
//import { errors } from 'mobile-json-wire-protocol';

let commands = {}, helpers = {}, extensions = {};

commands.getPageSource = async function () {
  return this.bootstrap.sendCommand('action', {action: 'source'});
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
