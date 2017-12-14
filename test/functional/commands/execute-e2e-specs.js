import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import _ from 'lodash';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = _.defaults({
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);

describe('execute', function () {
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async function () {
    await driver.deleteSession();
  });

  it('should fail if one tries to execute non-mobile command in native context', async function () {
    await driver.execute('blabla').should.eventually.be.rejected;
  });

  it('should fail if one tries to execute an unknown mobile command in native context', async function () {
    await driver.execute('mobile: blabla').should.eventually.be.rejectedWith(/Unknown mobile command/);
  });

  it('should fail if one tries to execute a shell command without relaxed security flag set', async function () {
    await driver.execute('mobile: shell', {command: 'pm', args: ['list']})
      .should.eventually.be.rejectedWith(/must have relaxed security flag set/);
  });

  it('should fail if no command argument is provided to shell call', async function () {
    driver.relaxedSecurityEnabled = true;
    try {
      await driver.execute('mobile: shell', {comand: 'pm', args: ['list']})
        .should.eventually.be.rejectedWith(/argument is mandatory/);
    } finally {
      driver.relaxedSecurityEnabled = undefined;
    }
  });

  it('should return a result if correct shell command is provided', async function () {
    driver.relaxedSecurityEnabled = true;
    try {
      (await driver.execute('mobile: shell', {command: 'echo', args: 'hello'}))
        .should.not.be.empty;
    } finally {
      driver.relaxedSecurityEnabled = undefined;
    }
  });
});
