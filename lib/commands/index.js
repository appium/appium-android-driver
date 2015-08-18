import findCmds from './find';
import generalCmds from './general';
import alertCmds from './alert';
import elementCmds from './element';

let commands = {};
Object.assign(
  commands,
  findCmds,
  generalCmds,
  alertCmds,
  elementCmds
  // add other command types here
);

export default commands;
