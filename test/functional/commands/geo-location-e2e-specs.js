import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { retryInterval } from 'asyncbox';
import AndroidDriver from '../../..';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

describe.skip("geo-location", function () {
  let driver;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async function () {
    await driver.deleteSession();
  });

  it('should set geo location @skip-ci', async function () {
    let getText = async () => {
      let els = await driver.findElements('class name', 'android.widget.TextView');
      return await driver.getText(els[1].ELEMENT);
    };

    let latitude = '27.17';
    let longitude = '78.04';

    let text = await getText();
    text.should.not.include(`Latitude: ${latitude}`);
    text.should.not.include(`Longitude: ${longitude}`);

    await driver.setGeoLocation({latitude, longitude});

    // wait for the text to change
    await retryInterval(6, 1000, async () => {
      if (await getText() === 'GPS Tutorial') {
        throw new Error('Location not set yet. Retry.');
      }
    });

    text = await getText();
    text.should.include(`Latitude: ${latitude}`);
    text.should.include(`Longitude: ${longitude}`);
  });
});
