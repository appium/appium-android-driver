import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { withMocks } from 'appium-test-support';
import ADB from 'appium-adb';


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
        let actions = [{action: 'press', options: { x: 100, y: 101 }},
                       {action: 'moveTo', options: { x: 50, y: 51 }},
                       {action: 'wait', options: { ms: 5000 }},
                       {action: 'moveTo', options: { x: -40, y: -41 }},
                       {action: 'release', options: {}}];
        let touchStates = await driver.parseTouch(actions, false);
        touchStates.length.should.equal(5);
        let parsedActions = [{action: 'press', x: 100, y: 101},
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

  describe('fixRelease', withMocks({driver, adb}, (mocks) => {
    it('should be able to get the correct release coordinates', async () => {
      let actions = [{action: 'press', options: {x: 20, y: 21}},
                     {action: 'moveTo', options: {x: 10, y: 11}},
                     {action: 'release'}];
      let release = await driver.fixRelease(actions, false);
      release.options.should.eql({x: 10, y: 11});
    });
    it('should be able to get the correct element release offset', async () => {
      mocks.driver.expects('getLocationInView')
        .withExactArgs(2)
        .returns({x: 100, y: 101});
      let actions = [{action: 'press', options: {element: 1, x: 20, y: 21}},
                     {action: 'moveTo', options: {element: 2, x: 10, y: 11}},
                     {action: 'release'}];
      let release = await driver.fixRelease(actions, false);
      release.options.should.eql({x: 110, y: 112});
    });
    it('should be able to get the correct element release', async () => {
      mocks.driver.expects('getLocationInView')
        .withExactArgs(2)
        .returns({x: 100, y: 101});
      mocks.driver.expects('getSize')
        .withExactArgs(2)
        .returns({width: 5, height: 6});
      let actions = [{action: 'press', options: {element: 1, x: 20, y: 21}},
                     {action: 'moveTo', options: {element: 2}},
                     {action: 'release'}];
      let release = await driver.fixRelease(actions, false);
      release.options.should.eql({x: 102.5, y: 104});
    });
  }));

  describe('doTouchDrag', withMocks({driver, adb}, (mocks) => {
    let tests = async (apiLevel, defaultDuration) => {
      it('should handle longPress not having duration', async () => {
        let expectedDuration = defaultDuration;
        let actions = [{action: 'longPress', options: {x: 100, y: 101}},
                       {action: 'moveTo', options: {x: 50, y: 51}},
                       {action: 'release', options: {}}];

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
        let actions = [{action: 'longPress', options: {x: 100, y: 101, duration: expectedDuration * 1000}},
                       {action: 'moveTo', options: {x: 50, y: 51}},
                       {action: 'release', options: {}}];

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
        let actions = [{action: 'longPress', options: {x: 100, y: 101, duration: 500}},
                       {action: 'moveTo', options: {x: 50, y: 51}},
                       {action: 'release', options: {}}];

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

  describe('parseTouch', () => {
    it('should handle actions starting with wait', async () => {
      let actions = [{action: 'wait', options: {ms: 500}},
                     {action: 'tap', options: {x: 100, y: 101}}];

      let touchStateObject = await driver.parseTouch(actions, true);
      touchStateObject.should.eql([{
        action: 'wait',
        time: 0.5,
      }, {
        action: 'tap',
        touch: {x: 100, y: 101},
        time: 0.505,
      }]);
    });
  });
});
