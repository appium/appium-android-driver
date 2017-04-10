import sinon from 'sinon';
import helpers from '../../lib/webview-helpers';
import ADB from 'appium-adb';

let sandbox = sinon.sandbox.create();

describe('Webview Helpers', () => {
  let adb = new ADB();

  describe('When the webviews are obtained', () => {
    describe('for an app that embeds Chromium', () => {
      let webViews;
      
      beforeEach(async () => {
        sandbox.stub(adb, 'shell', () => {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_123\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });  

        webViews = await helpers.getWebviews(adb, 'webview_devtools_remote_123');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('then the unix sockets are queried', () => {
        adb.shell.calledOnce.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then the webview is returned', () => {
        webViews.length.should.equal(1);
        webViews.should.deep.equal(['WEBVIEW_123']);
      });
    });

    describe('for a Chromium webview', () => {
      let webViews;
      
      beforeEach(async () => {
        sandbox.stub(adb, 'shell', () => {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @chrome_devtools_remote\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });  

        webViews = await helpers.getWebviews(adb, 'chrome_devtools_remote');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('then the unix sockets are queried', () => {
        adb.shell.calledOnce.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then the webview is returned', () => {
        webViews.length.should.equal(1);
        webViews.should.deep.equal(['CHROMIUM']);
      });
    });

    describe('and no webviews exist', () => {
      let webViews;
      
      beforeEach(async () => {
        sandbox.stub(adb, 'shell', () => {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });  

        webViews = await helpers.getWebviews(adb);
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('then the unix sockets are queried', () => {
        adb.shell.calledOnce.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then no webviews are returned', () => {
        webViews.length.should.equal(0);
      });
    });

    describe('and webviews exist', async () => {
      let webViews;

      beforeEach(async () => {
        let shellStub = sandbox.stub(adb, 'shell');
        
        shellStub.onCall(0).returns('Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_1234\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n');
        shellStub.onCall(1).returns('USER      PID   PPID  VSIZE  RSS   WCHAN              PC  NAME\n' +
                'root      1     0     5792   988   SyS_epoll_ 0000000000 S /init\n' +
                'root      2     0     0      0       kthreadd 0000000000 S kthreadd\n' +
                'root   1234     2     0      0     SyS_epoll_ 0000000000 S com.application.myapp\n');

        webViews = await helpers.getWebviews(adb);
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('then the unix sockets and process list are queried', () => {
        adb.shell.calledTwice.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        adb.shell.getCall(1).args[0].should.equal('ps');
      });

      it('then the webview is returned', async () => {
        webViews.length.should.equal(1);
        webViews.should.deep.equal(['WEBVIEW_com.application.myapp']);
      });
    });
  });
});