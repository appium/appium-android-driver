import sinon from 'sinon';
import helpers from '../../lib/webview-helpers';
import ADB from 'appium-adb';

let sandbox = sinon.createSandbox();

describe('Webview Helpers', function () {
  let adb = new ADB();

  afterEach(function () {
    sandbox.restore();
  });

  describe('When the webviews are obtained', function () {
    describe('for an app that embeds Chromium', function () {
      let webViews;

      beforeEach(async function () {
        sandbox.stub(adb, 'shell').callsFake(function () {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_123\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });

        webViews = await helpers.getWebviews(adb, {androidDeviceSocket: 'webview_devtools_remote_123'});
      });

      it('then the unix sockets are queried', function () {
        adb.shell.calledOnce.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then the webview is returned', function () {
        webViews.length.should.equal(1);
        webViews.should.deep.equal(['WEBVIEW_123']);
      });
    });

    describe('for a Chromium webview', function () {
      let webViews;

      beforeEach(async function () {
        sandbox.stub(adb, 'shell').callsFake(function () {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @chrome_devtools_remote\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });

        webViews = await helpers.getWebviews(adb, {androidDeviceSocket: 'chrome_devtools_remote'});
      });

      it('then the unix sockets are queried', function () {
        adb.shell.calledOnce.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then the webview is returned', function () {
        webViews.length.should.equal(1);
        webViews.should.deep.equal(['CHROMIUM']);
      });
    });

    describe('and no webviews exist', function () {
      let webViews;

      beforeEach(async function () {
        sandbox.stub(adb, 'shell').callsFake(function () {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });

        webViews = await helpers.getWebviews(adb);
      });

      it('then the unix sockets are queried', function () {
        adb.shell.calledOnce.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then no webviews are returned', function () {
        webViews.length.should.equal(0);
      });
    });

    describe('and crosswalk webviews exist', function () {
      let webViews;

      beforeEach(function () {
        sandbox.stub(adb, 'shell').callsFake(function () {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @com.application.myapp_devtools_remote\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });
      });

      describe('and the device socket is not specified', function () {
        beforeEach(async function () {
          webViews = await helpers.getWebviews(adb);
        });

        it('then the unix sockets are queried', function () {
          adb.shell.calledOnce.should.be.true;
          adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then the webview is returned', function () {
          webViews.length.should.equal(1);
          webViews.should.deep.equal(['WEBVIEW_com.application.myapp']);
        });
      });

      describe('and the device socket is specified', function () {
        beforeEach(async function () {
          webViews = await helpers.getWebviews(adb, {androidDeviceSocket: 'com.application.myapp_devtools_remote'});
        });

        it('then the unix sockets are queried', function () {
          adb.shell.calledOnce.should.be.true;
          adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then the webview is returned', function () {
          webViews.length.should.equal(1);
          webViews.should.deep.equal(['WEBVIEW_com.application.myapp']);
        });
      });

      describe('and the device socket is specified but is not found', function () {
        beforeEach(async function () {
          webViews = await helpers.getWebviews(adb, {androidDeviceSocket: 'com.application.myotherapp_devtools_remote'});
        });

        it('then the unix sockets are queried', function () {
          adb.shell.calledOnce.should.be.true;
          adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then no webviews are returned', function () {
          webViews.length.should.equal(0);
        });
      });
    });
  });
});
