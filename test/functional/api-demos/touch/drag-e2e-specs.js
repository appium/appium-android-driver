import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../../../..';
import sampleApps from 'sample-apps';

chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android',
  appActivity: '.view.DragAndDropDemo'
};

describe('apidemo - touch', function () {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
  });
  after(async () => {
    await driver.deleteSession();
  });
  describe('drag', function () {
    it('should drag by element', async () => {
      let dot3 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_3', false);
      let dot2 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_2', false);
      let gestures = [
        {options: {element: dot3.ELEMENT}},
        {options: {element: dot2.ELEMENT}}
      ];
      await driver.doTouchDrag(gestures);
      let results = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_result_text', false);
      await driver.getText(results.ELEMENT).should.eventually.include('Dropped');
    });
    it('should drag by element with an offset', async () => {
      // reset
      await driver.startActivity('io.appium.android.apis', '.view.DragAndDropDemo');

      let dot3 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_3', false);
      let dot2 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_2', false);
      let gestures = [
        {options: {element: dot3.ELEMENT, x: 5, y: 5}},
        {options: {element: dot2.ELEMENT, x: 5, y: 5}}
      ];
      await driver.doTouchDrag(gestures);
      let results = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_result_text', false);
      await driver.getText(results.ELEMENT).should.eventually.include('Dropped');
    });
  }); 
});
