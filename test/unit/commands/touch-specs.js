import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// import sinon from 'sinon';
// import Bootstrap from 'appium-android-bootstrap';
import { AndroidDriver } from '../../..';
import { withMocks } from 'appium-test-support';
import ADB from 'appium-adb';


// let driver;
// let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Touch', () => {
  let adb = new ADB();
  let driver = new AndroidDriver();
  driver.adb = adb;

  describe('#parseTouch', () => {
    describe('given a touch sequence with absolute coordinates', () => {
      it('should use offsets for moveTo', async () => {
        // let driver = new AndroidDriver({foo: 'bar'});
        let actions = [ {action: 'press', options: { x: 100, y: 101 }},
                        {action: 'moveTo', options: { x: 50, y: 51 }},
                        {action: 'wait', options: { ms: 5000 }},
                        {action: 'moveTo', options: { x: -40, y: -41 }},
                        {action: 'release', options: {}} ];
        let touchStates = await driver.parseTouch(actions, false);
        touchStates.length.should.equal(5);
        let parsedActions = [ {action: 'press', x: 100, y: 101},
                              {action: 'moveTo', x: 150, y: 152},
                              {action: 'wait', x: 150, y: 152},
                              {action: 'moveTo', x: 110, y: 111},
                              {action: 'release'}];
        let index = 0;
        for (let state of touchStates) {
          state.action.should.equal(parsedActions[index].action);
          if (actions[index].action !== 'release') {
            state.options.x.should.equal(parsedActions[index].x);
            state.options.y.should.equal(parsedActions[index].y);
          }
          index++;
        }
        });
      });
    });

  describe.only('doTouchDrag', withMocks({driver, adb}, (mocks) => {
    let tests = async (apiLevel, defaultDuration) => {
      it('should handle longPress not having duration', async () => {
        let expectedDuration = defaultDuration;
        let actions = [ { action: 'longPress', options: { x: 100, y: 101 } },
                        { action: 'moveTo', options: { x: 50, y: 51 } },
                        { action: 'release', options: {} } ];

        mocks.driver.expects('drag')
          .withExactArgs(actions[0].options.x, actions[0].options.y,
                         actions[1].options.x, actions[1].options.y,
                         expectedDuration,
                         1, undefined, undefined)
          .returns('');
        await driver.doTouchDrag(actions);

        mocks.driver.verify();
      });
      it('should handle longPress having duration', async () => {
        let expectedDuration = 4;
        let actions = [ { action: 'longPress', options: { x: 100, y: 101, duration: expectedDuration * 1000 } },
                        { action: 'moveTo', options: { x: 50, y: 51 } },
                        { action: 'release', options: {} } ];

        mocks.driver.expects('drag')
          .withExactArgs(actions[0].options.x, actions[0].options.y,
                         actions[1].options.x, actions[1].options.y,
                         expectedDuration,
                         1, undefined, undefined)
          .returns('');
        await driver.doTouchDrag(actions);

        mocks.driver.verify();
      });
      it('should handle longPress having duration less than minimum', async () => {
        let expectedDuration = defaultDuration;
        let actions = [ { action: 'longPress', options: { x: 100, y: 101, duration: 500 } },
                        { action: 'moveTo', options: { x: 50, y: 51 } },
                        { action: 'release', options: {} } ];

        mocks.driver.expects('drag')
          .withExactArgs(actions[0].options.x, actions[0].options.y,
                         actions[1].options.x, actions[1].options.y,
                         expectedDuration,
                         1, undefined, undefined)
          .returns('');
        await driver.doTouchDrag(actions);

        mocks.driver.verify();
      });
    };

    describe('android >5', () => {
      beforeEach(() => {
        mocks.adb.expects('getApiLevel')
          .returns(5);
      });
      afterEach(() => {
        mocks.adb.verify();
        mocks.adb.restore();
      });
      tests(5, 2);
    });
    describe('android <5', () => {
      beforeEach(() => {
        mocks.adb.expects('getApiLevel')
          .returns(4.4);
      });
      afterEach(() => {
        mocks.adb.verify();
        mocks.adb.restore();
      });
      tests(4.4, 1);
    });
  }));
});
