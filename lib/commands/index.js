import findCmds from './find';
import generalCmds from './general';
import alertCmds from './alert';
import elementCmds from './element';
import contextCmds from './context';

let commands = {};
Object.assign(
  commands,
  findCmds,
  generalCmds,
  alertCmds,
  elementCmds,
  contextCmds
  // add other command types here
);

export default commands;
