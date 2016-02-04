import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../../..';
import sampleApps from 'sample-apps';
import _ from 'lodash';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android',
  appActivity: '.view.TextFields'
};

describe('replaceValue', function () {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async () => {
    await driver.deleteSession();
  });

  it('should replace existing value in a text field', async () => {
    let el = _.last(await driver.findElOrEls('class name', 'android.widget.EditText', true));
    el.should.exist;
    await driver.setValue('original value', el.ELEMENT);
    await driver.getText(el.ELEMENT).should.eventually.equal('original value');

    await driver.replaceValue('replaced value', el.ELEMENT);
    await driver.getText(el.ELEMENT).should.eventually.equal('replaced value');
  });
});
