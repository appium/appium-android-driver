import AndroidDriver from '../../../lib/driver';
import {
  parseWindowProperties, parseWindows
} from '../../../lib/commands/system-bars';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.should();
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('System Bars', function () {
  describe('parseWindowProperties', function () {
    it('should return visible true if the surface is visible', function () {
      parseWindowProperties('yolo', `
      mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@dbd59e0
      mOwnerUid=10144 showForAllUsers=true package=com.android.systemui appop=NONE
      mAttrs={(0,0)(fillxfill) sim={adjust=pan} ty=NAVIGATION_BAR fmt=TRANSLUCENT
        fl=NOT_FOCUSABLE NOT_TOUCH_MODAL TOUCHABLE_WHEN_WAKING WATCH_OUTSIDE_TOUCH SPLIT_TOUCH HARDWARE_ACCELERATED FLAG_SLIPPERY
        pfl=COLOR_SPACE_AGNOSTIC
        fitTypes=STATUS_BARS NAVIGATION_BARS CAPTION_BAR IME}
      Requested w=1080 h=126 mLayoutSeq=67
      mBaseLayer=241000 mSubLayer=0    mToken=WindowToken{e41b499 android.os.BinderProxy@c8cbbe3}
      mViewVisibility=0x0 mHaveFrame=true mObscured=false
      mSeq=0 mSystemUiVisibility=0x0
      mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
      mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
      mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
      mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
      Frames: containing=[0,1794][1080,1920] parent=[0,1794][1080,1920]
          display=[0,1794][1080,1920]
          content=[0,1794][1080,1920] visible=[0,1794][1080,1920]
          decor=[0,0][0,0]
      mFrame=[0,1794][1080,1920] last=[0,1794][1080,1920]
       cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
      Cur insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]    Lst insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]
       surface=[0,0][0,0]
      ContainerAnimator:
        mLeash=Surface(name=Surface(name=e56b35e NavigationBar0)/@0xdbbe587 - animation-leash)/@0x547b0d mAnimationType=32
        Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@a848ac2
          ControlAdapter
           mCapturedLeash=Surface(name=Surface(name=e56b35e NavigationBar0)/@0xdbbe587 - animation-leash)/@0x547b0d    WindowStateAnimator{c260d3 NavigationBar0}:
         mAnimationIsEntrance=true      mSurface=Surface(name=NavigationBar0)/@0x275b410
        Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0) 1080 x 126 transform=(1.0, 0.0, 1.0, 0.0)
        mDrawState=HAS_DRAWN       mLastHidden=false
        mEnterAnimationPending=false      mSystemDecorRect=[0,0][1080,126] mLastClipRect=[0,0][1080,126]
      mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
      isOnScreen=true
      isVisible=true
      mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
      `.split('\n')).should.be.eql({
        visible: true,
        x: 0,
        y: 1794,
        width: 1080,
        height: 126,
      });
    });
    it('should return visible false if the surface is not visible', function () {
      parseWindowProperties('foo', `
      mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@dbd59e0
      mOwnerUid=10144 showForAllUsers=true package=com.android.systemui appop=NONE
      mAttrs={(0,0)(fillxfill) sim={adjust=pan} ty=NAVIGATION_BAR fmt=TRANSLUCENT
        fl=NOT_FOCUSABLE NOT_TOUCH_MODAL TOUCHABLE_WHEN_WAKING WATCH_OUTSIDE_TOUCH SPLIT_TOUCH HARDWARE_ACCELERATED FLAG_SLIPPERY
        pfl=COLOR_SPACE_AGNOSTIC
        fitTypes=STATUS_BARS NAVIGATION_BARS CAPTION_BAR IME}
      Requested w=1080 h=126 mLayoutSeq=67
      mBaseLayer=241000 mSubLayer=0    mToken=WindowToken{e41b499 android.os.BinderProxy@c8cbbe3}
      mViewVisibility=0x0 mHaveFrame=true mObscured=false
      mSeq=0 mSystemUiVisibility=0x0
      mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
      mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
      mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
      mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
      Frames: containing=[0,1794][1080,1920] parent=[0,1794][1080,1920]
          display=[0,1794][1080,1920]
          content=[0,1794][1080,1920] visible=[0,1794][1080,1920]
          decor=[0,0][0,0]
      mFrame=[0,1794][1080,1920] last=[0,1794][1080,1920]
       cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
      Cur insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]    Lst insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]
       surface=[0,0][0,0]
      ContainerAnimator:
        mLeash=Surface(name=Surface(name=e56b35e NavigationBar0)/@0xdbbe587 - animation-leash)/@0x547b0d mAnimationType=32
        Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@a848ac2
          ControlAdapter
           mCapturedLeash=Surface(name=Surface(name=e56b35e NavigationBar0)/@0xdbbe587 - animation-leash)/@0x547b0d    WindowStateAnimator{c260d3 NavigationBar0}:
         mAnimationIsEntrance=true      mSurface=Surface(name=NavigationBar0)/@0x275b410
        Surface: shown=false layer=0 alpha=1.0 rect=(0.0,0.0) 1080 x 126 transform=(1.0, 0.0, 1.0, 0.0)
        mDrawState=HAS_DRAWN       mLastHidden=false
        mEnterAnimationPending=false      mSystemDecorRect=[0,0][1080,126] mLastClipRect=[0,0][1080,126]
      mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
      isOnScreen=true
      isVisible=true
      mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
      `.split('\n')).should.be.eql({
        visible: false,
        x: 0,
        y: 1794,
        width: 1080,
        height: 126,
      });
    });
    it('should throw an error if no info is found', function () {
      expect(() => { parseWindowProperties('bar', []); }).to.throw(Error);
    });
  });

  // these are used for both parseWindows and getSystemBars tests
  const validWindowOutputA11 = `
WINDOW MANAGER WINDOWS (dumpsys window windows)
  Window #0 Window{d1b7133 u0 pip-dismiss-overlay}:
    mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@a5e1e9f
    mOwnerUid=10144 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,1264)(fillx656) sim={adjust=pan} ty=NAVIGATION_BAR_PANEL fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE NOT_TOUCHABLE LAYOUT_IN_SCREEN HARDWARE_ACCELERATED
      pfl=SHOW_FOR_ALL_USERS FIT_INSETS_CONTROLLED}
    Requested w=1080 h=656 mLayoutSeq=52
    mBaseLayer=251000 mSubLayer=0    mToken=WindowToken{561abec android.os.BinderProxy@a5e1e9f}
    mViewVisibility=0x4 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x0
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined}}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
        display=[0,0][1080,1920]
        content=[0,1264][1080,1794] visible=[0,1264][1080,1794]
        decor=[0,0][1080,1920]
    mFrame=[0,1264][1080,1920] last=[0,0][0,0]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,0][0,126]    Lst insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,0][0,126]
     surface=[0,0][0,0]
    WindowStateAnimator{d2621a4 pip-dismiss-overlay}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0] mLastClipRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #1 Window{e56b35e u0 NavigationBar0}:
    mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@dbd59e0
    mOwnerUid=10144 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,0)(fillxfill) sim={adjust=pan} ty=NAVIGATION_BAR fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE NOT_TOUCH_MODAL TOUCHABLE_WHEN_WAKING WATCH_OUTSIDE_TOUCH SPLIT_TOUCH HARDWARE_ACCELERATED FLAG_SLIPPERY
      pfl=COLOR_SPACE_AGNOSTIC
      fitTypes=STATUS_BARS NAVIGATION_BARS CAPTION_BAR IME}
    Requested w=1080 h=126 mLayoutSeq=67
    mBaseLayer=241000 mSubLayer=0    mToken=WindowToken{e41b499 android.os.BinderProxy@c8cbbe3}
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x0
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,1794][1080,1920] parent=[0,1794][1080,1920]
        display=[0,1794][1080,1920]
        content=[0,1794][1080,1920] visible=[0,1794][1080,1920]
        decor=[0,0][0,0]
    mFrame=[0,1794][1080,1920] last=[0,1794][1080,1920]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]    Lst insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]
     surface=[0,0][0,0]
    ContainerAnimator:
      mLeash=Surface(name=Surface(name=e56b35e NavigationBar0)/@0xdbbe587 - animation-leash)/@0x547b0d mAnimationType=32
      Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@a848ac2
        ControlAdapter
         mCapturedLeash=Surface(name=Surface(name=e56b35e NavigationBar0)/@0xdbbe587 - animation-leash)/@0x547b0d    WindowStateAnimator{c260d3 NavigationBar0}:
       mAnimationIsEntrance=true      mSurface=Surface(name=NavigationBar0)/@0x275b410
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0) 1080 x 126 transform=(1.0, 0.0, 1.0, 0.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][1080,126] mLastClipRect=[0,0][1080,126]
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=true
    isVisible=true
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #2 Window{31fbf1a u0 NotificationShade}:
    mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@34cb83c
    mOwnerUid=10144 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,0)(fillxfill) gr=TOP CENTER_VERTICAL sim={adjust=resize} layoutInDisplayCutoutMode=always ty=2040 fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE TOUCHABLE_WHEN_WAKING WATCH_OUTSIDE_TOUCH SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=COLOR_SPACE_AGNOSTIC BEHAVIOR_CONTROLLED FIT_INSETS_CONTROLLED
      bhv=SHOW_TRANSIENT_BARS_BY_SWIPE}
    Requested w=1080 h=1920 mLayoutSeq=32
    mBaseLayer=191000 mSubLayer=0    mToken=WindowToken{234e9c5 android.os.BinderProxy@2376a2f}
    mViewVisibility=0x4 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x0
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined}}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
        display=[0,0][1080,1920]
        content=[0,0][1080,1794] visible=[0,0][1080,1794]
        decor=[0,0][1080,1920]
    mFrame=[0,0][1080,1920] last=[0,0][1080,1920]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,63][0,126]    Lst insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,63][0,126]
     surface=[0,0][0,0]
    WindowStateAnimator{d5abb09 NotificationShade}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0] mLastClipRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #3 Window{7547027 u0 StatusBar}:
    mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@c7f5d41
    mOwnerUid=10144 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,0)(fillx63) gr=TOP CENTER_VERTICAL sim={adjust=pan} layoutInDisplayCutoutMode=always ty=STATUS_BAR fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=COLOR_SPACE_AGNOSTIC FIT_INSETS_CONTROLLED}
    Requested w=1080 h=63 mLayoutSeq=67
    mBaseLayer=171000 mSubLayer=0    mToken=WindowToken{1eab2e6 android.os.BinderProxy@74b1c28}
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x0
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
        display=[0,0][1080,1920]
        content=[0,0][1080,63] visible=[0,0][1080,63]
        decor=[0,0][0,0]
    mFrame=[0,0][1080,63] last=[0,0][1080,63]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]    Lst insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]
     surface=[0,0][0,0]
    ContainerAnimator:
      mLeash=Surface(name=Surface(name=7547027 StatusBar)/@0x3db21c6 - animation-leash)/@0x694910e mAnimationType=32
      Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@48372f
        ControlAdapter
         mCapturedLeash=Surface(name=Surface(name=7547027 StatusBar)/@0x3db21c6 - animation-leash)/@0x694910e    WindowStateAnimator{cea013c StatusBar}:
       mAnimationIsEntrance=true      mSurface=Surface(name=StatusBar)/@0xc6afec5
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0) 1080 x 63 transform=(1.0, 0.0, 1.0, 0.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][1080,63] mLastClipRect=[0,0][1080,63]
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=true
    isVisible=true
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #4 Window{1602b04 u0 Application Not Responding: com.android.systemui}:
    mDisplayId=0 rootTaskId=1 mSession=Session{c91c4ca 502:1000} mClient=android.view.ViewRootImpl$W@56f6396
    mOwnerUid=1000 showForAllUsers=true package=android appop=SYSTEM_ALERT_WINDOW
    mAttrs={(0,0)(wrapxwrap) gr=CENTER sim={adjust=pan forwardNavigation} ty=SYSTEM_ALERT fmt=TRANSLUCENT wanim=0x10302ff surfaceInsets=Rect(84, 84 - 84, 84)
      fl=DIM_BEHIND ALT_FOCUSABLE_IM SPLIT_TOUCH HARDWARE_ACCELERATED
      pfl=SHOW_FOR_ALL_USERS SYSTEM_ERROR
      fitTypes=STATUS_BARS NAVIGATION_BARS CAPTION_BAR
      fitIgnoreVis}
    Requested w=1024 h=514 mLayoutSeq=67
    mBaseLayer=131000 mSubLayer=0    mToken=WindowToken{cc94b17 android.view.ViewRootImpl$W@56f6396}
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x0
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,63][1080,1794] parent=[0,63][1080,1794]
        display=[0,63][1080,1794]
        content=[28,671][1052,1185] visible=[28,671][1052,1185]
        decor=[0,0][1080,1920]
    mFrame=[28,671][1052,1185] last=[28,671][1052,1185]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]    Lst insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]
     surface=[84,84][84,84]
    WindowStateAnimator{48cb01a Application Not Responding: com.android.systemui}:
       mAnimationIsEntrance=true      mSurface=Surface(name=Application Not Responding: com.android.systemui)/@0xbab174b
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0) 1192 x 682 transform=(1.0, 0.0, 1.0, 0.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][1024,514] mLastClipRect=[0,0][1192,682]
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=true
    isVisible=true
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #5 Window{c184247 u0 AssistPreviewPanel}:
    mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@5491a61
    mOwnerUid=10144 showForAllUsers=false package=com.android.systemui appop=NONE
    mAttrs={(0,0)(fillx656) gr=BOTTOM START CENTER sim={state=unchanged adjust=nothing} ty=VOICE_INTERACTION_STARTING fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE NOT_TOUCHABLE LAYOUT_IN_SCREEN HARDWARE_ACCELERATED
      pfl=
      vsysui=LAYOUT_STABLE LAYOUT_HIDE_NAVIGATION LAYOUT_FULLSCREEN}
    Requested w=0 h=0 mLayoutSeq=13
    mBaseLayer=41000 mSubLayer=0    mToken=WindowToken{e2ff986 android.os.BinderProxy@b9f19c8}
    mViewVisibility=0x8 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x700
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined}}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
        display=[0,0][1080,1920]
        content=[0,1920][1080,1794] visible=[0,1920][1080,1794]
        decor=[0,0][1080,1920]
    mFrame=[0,1920][1080,1920] last=[0,0][0,0]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]    Lst insets: content=[0,0][0,0] visible=[0,0][0,0] stable=[0,0][0,0]
     surface=[0,0][0,0]
    WindowStateAnimator{7f3f528 AssistPreviewPanel}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0] mLastClipRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #6 Window{4abfad2 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}:
    mDisplayId=0 rootTaskId=1 mSession=Session{fe94c6c 1341:u0a10109} mClient=android.os.BinderProxy@152615d
    mOwnerUid=10109 showForAllUsers=false package=com.google.android.apps.nexuslauncher appop=NONE
    mAttrs={(0,0)(fillxfill) gr=LEFT CENTER_HORIZONTAL sim={adjust=resize} layoutInDisplayCutoutMode=always ty=DRAWN_APPLICATION fmt=TRANSPARENT wanim=0x10302f2 alpha=0.0
      fl=NOT_FOCUSABLE NOT_TOUCHABLE LAYOUT_IN_SCREEN LAYOUT_INSET_DECOR WATCH_OUTSIDE_TOUCH SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=FORCE_DRAW_STATUS_BAR_BACKGROUND FIT_INSETS_CONTROLLED
      vsysui=LAYOUT_STABLE LAYOUT_HIDE_NAVIGATION LAYOUT_FULLSCREEN
      fitSides=}
    Requested w=1080 h=1920 mLayoutSeq=67
    mBaseLayer=21000 mSubLayer=0    mToken=ActivityRecord{1086e23 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t13}
    mActivityRecord=ActivityRecord{1086e23 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t13}
    mAppDied=false    drawnStateEvaluated=true    mightAffectAllDrawn=true
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x700
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=home mAlwaysOnTop=undefined mRotation=ROTATION_0} s.2}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=home mAlwaysOnTop=undefined mRotation=ROTATION_0} s.2}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
        display=[0,0][1080,1920]
        content=[0,63][1080,1794] visible=[0,63][1080,1794]
        decor=[0,0][1080,1920]
    mFrame=[0,0][1080,1920] last=[0,0][1080,1920]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,63][0,126] visible=[0,63][0,126] stable=[0,63][0,126]    Lst insets: content=[0,63][0,126] visible=[0,63][0,126] stable=[0,63][0,126]
     surface=[0,0][0,0]
    WindowStateAnimator{c81c241 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}:
      mSurface=Surface(name=com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity)/@0xbb5b3e6
      Surface: shown=true layer=0 alpha=0.0 rect=(0.0,0.0) 1080 x 1920 transform=(1.0, 0.0, 1.0, 0.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][1080,1920] mLastClipRect=[0,0][1080,1920]
      mShownAlpha=0.0 mAlpha=0.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=true
    isVisible=true
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #7 Window{8bfec3 u0 InputMethod}:
    mDisplayId=0 rootTaskId=1 mSession=Session{6b4240f 1200:u0a10121} mClient=android.os.BinderProxy@b7b2a72
    mOwnerUid=10121 showForAllUsers=false package=com.google.android.inputmethod.latin appop=NONE
    mAttrs={(0,0)(fillxwrap) gr=BOTTOM CENTER_VERTICAL sim={adjust=pan forwardNavigation} ty=INPUT_METHOD fmt=TRANSPARENT wanim=0x1030056
      fl=NOT_FOCUSABLE LAYOUT_IN_SCREEN SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=FIT_INSETS_CONTROLLED
      fitTypes=STATUS_BARS NAVIGATION_BARS
      fitSides=LEFT TOP RIGHT
      fitIgnoreVis}
    Requested w=1080 h=126 mLayoutSeq=57
    mIsImWindow=true mIsWallpaper=false mIsFloatingLayer=true mWallpaperVisible=false
    mBaseLayer=151000 mSubLayer=0    mToken=WindowToken{bd0f320 android.os.Binder@735f223}
    mViewVisibility=0x8 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x0
    mGivenContentInsets=[0,126][0,0] mGivenVisibleInsets=[0,0][0,0]
    mTouchableInsets=2 mGivenInsetsPending=false
    touchable region=SkRegion((0,1794,1080,1920))
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined}}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,63][1080,1920] parent=[0,63][1080,1920]
        display=[0,63][1080,1920]
        content=[0,1794][1080,1794] visible=[0,1794][1080,1794]
        decor=[0,0][1080,1920]
    mFrame=[0,1794][1080,1920] last=[0,1731][1080,1920]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,0][0,126]    Lst insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,0][0,126]
     surface=[0,0][0,0]
    ContainerAnimator:
      mLeash=Surface(name=Surface(name=8bfec3 InputMethod)/@0xe4d7bbe - animation-leash)/@0x311dd27 mAnimationType=32
      Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@3273bd4
        ControlAdapter
         mCapturedLeash=Surface(name=Surface(name=8bfec3 InputMethod)/@0xe4d7bbe - animation-leash)/@0x311dd27    WindowStateAnimator{5e7417d InputMethod}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0] mLastClipRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #8 Window{7bfc52e u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}:
    mDisplayId=0 rootTaskId=1 mSession=Session{16ebce2 985:u0a10137} mClient=android.os.BinderProxy@75faba9
    mOwnerUid=10137 showForAllUsers=false package=com.google.android.apps.nexuslauncher appop=NONE
    mAttrs={(0,0)(fillxfill) sim={adjust=pan forwardNavigation} layoutInDisplayCutoutMode=always ty=BASE_APPLICATION fmt=TRANSPARENT wanim=0x10302f2
      fl=LAYOUT_IN_SCREEN LAYOUT_INSET_DECOR SHOW_WALLPAPER SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=FORCE_DRAW_STATUS_BAR_BACKGROUND FIT_INSETS_CONTROLLED
      vsysui=LAYOUT_STABLE LAYOUT_HIDE_NAVIGATION LAYOUT_FULLSCREEN
      fitSides=}
    Requested w=1080 h=1920 mLayoutSeq=67
    mBaseLayer=21000 mSubLayer=0    mToken=ActivityRecord{1086e23 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t13}
    mActivityRecord=ActivityRecord{1086e23 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t13}
    mAppDied=false    drawnStateEvaluated=true    mightAffectAllDrawn=true
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x700
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=home mAlwaysOnTop=undefined mRotation=ROTATION_0} s.2}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=home mAlwaysOnTop=undefined mRotation=ROTATION_0} s.2}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
        display=[0,0][1080,1920]
        content=[0,63][1080,1794] visible=[0,63][1080,1794]
        decor=[0,0][1080,1920]
    mFrame=[0,0][1080,1920] last=[0,0][1080,1920]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,63][0,126] visible=[0,63][0,126] stable=[0,63][0,126]    Lst insets: content=[0,63][0,126] visible=[0,63][0,126] stable=[0,63][0,126]
     surface=[0,0][0,0]
    WindowStateAnimator{d192872 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}:
      mSurface=Surface(name=com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity)/@0x83524c3
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0) 1080 x 1920 transform=(1.0, 0.0, 1.0, 0.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][1080,1920] mLastClipRect=[0,0][1080,1920]
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    mWallpaperX=0.0 mWallpaperY=0.5
    mWallpaperXStep=0.33333334 mWallpaperYStep=1.0
    isOnScreen=true
    isVisible=true
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
  Window #9 Window{280d8a8 u0 com.android.systemui.ImageWallpaper}:
    mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@19758cb
    mOwnerUid=10144 showForAllUsers=false package=com.android.systemui appop=NONE
    mAttrs={(0,0)(2330x1920) gr=TOP START CENTER layoutInDisplayCutoutMode=always ty=WALLPAPER fmt=RGBX_8888 wanim=0x103030e
      fl=NOT_FOCUSABLE NOT_TOUCHABLE LAYOUT_IN_SCREEN LAYOUT_NO_LIMITS SCALED LAYOUT_INSET_DECOR}
    Requested w=1243 h=1024 mLayoutSeq=67
    mIsImWindow=false mIsWallpaper=true mIsFloatingLayer=true mWallpaperVisible=true
    mBaseLayer=11000 mSubLayer=0    mToken=WallpaperWindowToken{25dbafc token=android.os.Binder@e33bfef}
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mSeq=0 mSystemUiVisibility=0x0
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
        display=[-10000,-10000][10000,10000]
        content=[0,63][1080,1794] visible=[0,63][1080,1794]
        decor=[0,0][1080,1920]
    mFrame=[0,0][2330,1920] last=[0,0][2330,1920]
     cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
    Cur insets: content=[0,63][1250,126] visible=[0,63][1250,126] stable=[0,63][1250,126]    Lst insets: content=[0,63][1250,126] visible=[0,63][1250,126] stable=[0,63][1250,126]
     surface=[0,0][0,0]
    WindowStateAnimator{1a64140 com.android.systemui.ImageWallpaper}:
      mSurface=Surface(name=com.android.systemui.ImageWallpaper)/@0x32b7879
      Surface: shown=true layer=0 alpha=0.0 rect=(-54.0,-96.0) 1243 x 1024 transform=(2.0619469, 0.0, 2.0625, 0.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0] mLastClipRect=[0,0][0,0]
    mLastFreezeDuration=+1m16s364ms
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    mHScale=1.8744972 mVScale=1.875
    mWallpaperX=0.0 mWallpaperY=0.5
    mWallpaperXStep=0.33333334 mWallpaperYStep=1.0
    mWallpaperZoomOut=0.0
    isOnScreen=true
    isVisible=true
    mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }

  mGlobalConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
  mHasPermanentDpad=false
  mTopFocusedDisplayId=0
  mInputMethodTarget in display# 0 Window{7bfc52e u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
  inputMethodControlTarget in display# 0 null
  mInTouchMode=true
  mLastDisplayFreezeDuration=0 due to Window{280d8a8 u0 com.android.systemui.ImageWallpaper}
  mLastWakeLockHoldingWindow=null mLastWakeLockObscuringWindow=null
  mHighResTaskSnapshotScale=0.8
  SnapshotCache
  mInputMethodWindow=Window{8bfec3 u0 InputMethod}
  mTraversalScheduled=false
  mHoldScreenWindow=null
  mObscuringWindow=Window{280d8a8 u0 com.android.systemui.ImageWallpaper}
  mSystemBooted=true mDisplayEnabled=true
  mTransactionSequence=93
  mDisplayFrozen=false windows=0 client=false apps=0  mRotation=0  mLastOrientation=5
 waitingForConfig=false
  Animation settings: disabled=false window=1.0 transition=1.0 animator=1.0
  PolicyControl.sImmersiveStatusFilter=null
  PolicyControl.sImmersiveNavigationFilter=null
  PolicyControl.sImmersivePreconfirmationsFilter=null
  `;
  const validWindowOutputA12 = `
WINDOW MANAGER WINDOWS (dumpsys window windows)
  Window #0 Window{ed38f73 u0 pip-dismiss-overlay}:
    mDisplayId=0 rootTaskId=1 mSession=Session{59e06c8 819:u0a10095} mClient=android.os.BinderProxy@88820ad
    mOwnerUid=10095 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,1592)(fillx688) sim={adjust=pan} layoutInDisplayCutoutMode=always ty=NAVIGATION_BAR_PANEL fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE NOT_TOUCHABLE LAYOUT_IN_SCREEN
      pfl=SHOW_FOR_ALL_USERS USE_BLAST FIT_INSETS_CONTROLLED
      bhv=DEFAULT}
    Requested w=1080 h=688 mLayoutSeq=47
    mBaseLayer=251000 mSubLayer=0    mToken=WindowToken{eb8cfe2 android.os.BinderProxy@88820ad}
    mViewVisibility=0x4 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mMaxBounds=Rect(0, 0 - 0, 0) mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined} ?fontWeightAdjustment}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,2280] parent=[0,0][1080,2280] display=[0,0][1080,2280]
    mFrame=[0,1592][1080,2280] last=[0,0][0,0]
     surface=[0,0][0,0]
    WindowStateAnimator{6c41a23 pip-dismiss-overlay}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
  Window #1 Window{5ef94cb u0 NavigationBar0}:
    mDisplayId=0 rootTaskId=1 mSession=Session{59e06c8 819:u0a10095} mClient=android.os.BinderProxy@f84e045
    mOwnerUid=10095 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,0)(fillxfill) sim={adjust=pan} layoutInDisplayCutoutMode=always ty=NAVIGATION_BAR fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE NOT_TOUCH_MODAL TOUCHABLE_WHEN_WAKING WATCH_OUTSIDE_TOUCH SPLIT_TOUCH HARDWARE_ACCELERATED FLAG_SLIPPERY
      pfl=COLOR_SPACE_AGNOSTIC USE_BLAST FIT_INSETS_CONTROLLED TRUSTED_OVERLAY
      bhv=DEFAULT}
    Requested w=1080 h=132 mLayoutSeq=108
    mBaseLayer=241000 mSubLayer=0    mToken=WindowToken{246b39a android.os.BinderProxy@da078bc}
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,2148][1080,2280] parent=[0,2148][1080,2280] display=[0,2148][1080,2280]
    mFrame=[0,2148][1080,2280] last=[0,2148][1080,2280]
     surface=[0,0][0,0]
    ContainerAnimator:
      mLeash=Surface(name=Surface(name=5ef94cb NavigationBar0)/@0x4efa03 - animation-leash of insets_animation)/@0xb87fb20 mAnimationType=insets_animation
      Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@229dcd9
        ControlAdapter mCapturedLeash=Surface(name=Surface(name=5ef94cb NavigationBar0)/@0x4efa03 - animation-leash of insets_animation)/@0xb87fb20
    WindowStateAnimator{5f3569e NavigationBar0}:
       mAnimationIsEntrance=true      mSurface=Surface(name=NavigationBar0)/@0x934357f
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0)  transform=(1.0, 0.0, 0.0, 1.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
    mLastFreezeDuration=+444ms
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=true
    isVisible=true
  Window #2 Window{e7e5d02 u0 NotificationShade}:
    mDisplayId=0 rootTaskId=1 mSession=Session{59e06c8 819:u0a10095} mClient=android.os.BinderProxy@a24a977
    mOwnerUid=10095 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,0)(fillxfill) gr=TOP CENTER_VERTICAL sim={adjust=resize} layoutInDisplayCutoutMode=always ty=2040 fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE TOUCHABLE_WHEN_WAKING WATCH_OUTSIDE_TOUCH SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=COLOR_SPACE_AGNOSTIC USE_BLAST BEHAVIOR_CONTROLLED FIT_INSETS_CONTROLLED
      bhv=SHOW_TRANSIENT_BARS_BY_SWIPE}
    Requested w=1080 h=2280 mLayoutSeq=27
    mBaseLayer=191000 mSubLayer=0    mToken=WindowToken{64899e4 android.os.BinderProxy@d7dbf76}
    mViewVisibility=0x4 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mMaxBounds=Rect(0, 0 - 0, 0) mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined} ?fontWeightAdjustment}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,2280] parent=[0,0][1080,2280] display=[0,0][1080,2280]
    mFrame=[0,0][1080,2280] last=[0,0][1080,2280]
     surface=[0,0][0,0]
    WindowStateAnimator{2c1a94c NotificationShade}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
  Window #3 Window{d01181 u0 StatusBar}:
    mDisplayId=0 rootTaskId=1 mSession=Session{59e06c8 819:u0a10095} mClient=android.os.BinderProxy@ca36249
    mOwnerUid=10095 showForAllUsers=true package=com.android.systemui appop=NONE
    mAttrs={(0,0)(fillx83) gr=TOP CENTER_VERTICAL sim={adjust=pan} layoutInDisplayCutoutMode=always ty=STATUS_BAR fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=COLOR_SPACE_AGNOSTIC USE_BLAST FIT_INSETS_CONTROLLED
      bhv=DEFAULT}
    Requested w=1080 h=83 mLayoutSeq=108
    mBaseLayer=171000 mSubLayer=0    mToken=WindowToken{6b6da05 android.os.BinderProxy@8e77050}
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,2280] parent=[0,0][1080,2280] display=[0,0][1080,2280]
    mFrame=[0,0][1080,83] last=[0,0][1080,83]
     surface=[0,0][0,0]
    ContainerAnimator:
      mLeash=Surface(name=Surface(name=d01181 StatusBar)/@0x14c0ab2 - animation-leash of insets_animation)/@0xad26d95 mAnimationType=insets_animation
      Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@f3a3eaa
        ControlAdapter mCapturedLeash=Surface(name=Surface(name=d01181 StatusBar)/@0x14c0ab2 - animation-leash of insets_animation)/@0xad26d95
    WindowStateAnimator{c60aa9b StatusBar}:
       mAnimationIsEntrance=true      mSurface=Surface(name=StatusBar)/@0x8060e38
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0)  transform=(1.0, 0.0, 0.0, 1.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
    mLastFreezeDuration=+557ms
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=true
    isVisible=true
  Window #4 Window{8816770 u0 ShellDropTarget}:
    mDisplayId=0 rootTaskId=1 mSession=Session{59e06c8 819:u0a10095} mClient=android.os.BinderProxy@16945b3
    mOwnerUid=10095 showForAllUsers=true package=com.android.systemui appop=SYSTEM_ALERT_WINDOW
    mAttrs={(0,0)(fillxfill) sim={adjust=pan} layoutInDisplayCutoutMode=always ty=APPLICATION_OVERLAY fmt=TRANSLUCENT
      fl=NOT_FOCUSABLE HARDWARE_ACCELERATED
      pfl=SHOW_FOR_ALL_USERS NO_MOVE_ANIMATION USE_BLAST FIT_INSETS_CONTROLLED INTERCEPT_GLOBAL_DRAG_AND_DROP
      bhv=DEFAULT}
    Requested w=1080 h=2280 mLayoutSeq=7
    mBaseLayer=121000 mSubLayer=0    mToken=WindowToken{e08e36e android.os.BinderProxy@43a1f69}
    mViewVisibility=0x4 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mMaxBounds=Rect(0, 0 - 0, 0) mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined} ?fontWeightAdjustment}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,2280] parent=[0,0][1080,2280] display=[0,0][1080,2280]
    mFrame=[0,0][1080,2280] last=[0,0][1080,2280]
     surface=[0,0][0,0]
    WindowStateAnimator{a394e11 ShellDropTarget}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
  Window #5 Window{f4229a8 u0 InputMethod}:
    mDisplayId=0 rootTaskId=1 mSession=Session{ef4589 1288:u0a10085} mClient=android.os.BinderProxy@8374dcb
    mOwnerUid=10085 showForAllUsers=false package=com.android.inputmethod.latin appop=NONE
    mAttrs={(0,0)(fillxwrap) gr=BOTTOM CENTER_VERTICAL sim={adjust=pan forwardNavigation} ty=INPUT_METHOD fmt=TRANSPARENT wanim=0x1030056 receive insets ignoring z-order
      fl=NOT_FOCUSABLE LAYOUT_IN_SCREEN SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=USE_BLAST FIT_INSETS_CONTROLLED
      bhv=DEFAULT
      fitTypes=STATUS_BARS NAVIGATION_BARS
      fitSides=LEFT TOP RIGHT}
    Requested w=1080 h=0 mLayoutSeq=36
    mIsImWindow=true mIsWallpaper=false mIsFloatingLayer=true
    mBaseLayer=151000 mSubLayer=0    mToken=WindowToken{8b1a07b android.os.Binder@bbfe00a}
    mViewVisibility=0x8 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mTouchableInsets=2 mGivenInsetsPending=false
    touchable region=SkRegion()
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mMaxBounds=Rect(0, 0 - 0, 0) mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined} ?fontWeightAdjustment}
    mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,2280] parent=[0,0][1080,2280] display=[0,0][1080,2280]
    mFrame=[0,2280][1080,2280] last=[0,0][0,0]
     surface=[0,0][0,0]
    ContainerAnimator:
      mLeash=Surface(name=Surface(name=f4229a8 InputMethod)/@0xf5e3c66 - animation-leash of insets_animation)/@0x2559b76 mAnimationType=insets_animation
      Animation: com.android.server.wm.InsetsSourceProvider$ControlAdapter@7155577
        ControlAdapter mCapturedLeash=Surface(name=Surface(name=f4229a8 InputMethod)/@0xf5e3c66 - animation-leash of insets_animation)/@0x2559b76
    WindowStateAnimator{529d5e4 InputMethod}:
      mDrawState=NO_SURFACE       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
      mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    isOnScreen=false
    isVisible=false
  Window #6 Window{86a2d27 u0 com.android.launcher3/com.android.launcher3.uioverrides.QuickstepLauncher}:
    mDisplayId=0 rootTaskId=1 mSession=Session{7775ff 1077:u0a10089} mClient=android.os.BinderProxy@8fd43e6
    mOwnerUid=10089 showForAllUsers=false package=com.android.launcher3 appop=NONE
    mAttrs={(0,0)(fillxfill) sim={adjust=nothing forwardNavigation} layoutInDisplayCutoutMode=always ty=BASE_APPLICATION fmt=TRANSPARENT wanim=0x10302f2
      fl=LAYOUT_IN_SCREEN LAYOUT_INSET_DECOR SHOW_WALLPAPER SPLIT_TOUCH HARDWARE_ACCELERATED DRAWS_SYSTEM_BAR_BACKGROUNDS
      pfl=NO_MOVE_ANIMATION FORCE_DRAW_STATUS_BAR_BACKGROUND USE_BLAST FIT_INSETS_CONTROLLED
      vsysui=LAYOUT_STABLE LAYOUT_HIDE_NAVIGATION LAYOUT_FULLSCREEN
      bhv=DEFAULT
      fitSides=}
    Requested w=1080 h=2280 mLayoutSeq=108
    mBaseLayer=21000 mSubLayer=0    mToken=ActivityRecord{5f62743 u0 com.android.launcher3/.uioverrides.QuickstepLauncher t11}
    mActivityRecord=ActivityRecord{5f62743 u0 com.android.launcher3/.uioverrides.QuickstepLauncher t11}
    mAppDied=false    drawnStateEvaluated=true    mightAffectAllDrawn=true
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=home mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.5 fontWeightAdjustment=0}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=home mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.5 fontWeightAdjustment=0}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,2280] parent=[0,0][1080,2280] display=[0,0][1080,2280]
    mFrame=[0,0][1080,2280] last=[0,0][1080,2280]
     surface=[0,0][0,0]
    WindowStateAnimator{453ba4d com.android.launcher3/com.android.launcher3.uioverrides.QuickstepLauncher}:
      mSurface=Surface(name=com.android.launcher3/com.android.launcher3.uioverrides.QuickstepLauncher)/@0xef7f902
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0)  transform=(1.0, 0.0, 0.0, 1.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
    mLastFreezeDuration=+331ms
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    mWallpaperX=0.0 mWallpaperY=0.5
    mWallpaperXStep=0.33333334 mWallpaperYStep=1.0
    mWallpaperZoomOut=0.0
    isOnScreen=true
    isVisible=true
  Window #7 Window{dc87575 u0 com.android.systemui.ImageWallpaper}:
    mDisplayId=0 rootTaskId=1 mSession=Session{59e06c8 819:u0a10095} mClient=android.os.BinderProxy@7ed64ac
    mOwnerUid=10095 showForAllUsers=false package=com.android.systemui appop=NONE
    mAttrs={(0,0)(2767x2280) gr=TOP START CENTER layoutInDisplayCutoutMode=always ty=WALLPAPER fmt=RGBX_8888 wanim=0x103030e
      fl=NOT_FOCUSABLE NOT_TOUCHABLE LAYOUT_IN_SCREEN LAYOUT_NO_LIMITS SCALED LAYOUT_INSET_DECOR
      pfl=WANTS_OFFSET_NOTIFICATIONS USE_BLAST
      bhv=DEFAULT}
    Requested w=1243 h=1024 mLayoutSeq=108
    mIsImWindow=false mIsWallpaper=true mIsFloatingLayer=true
    mBaseLayer=11000 mSubLayer=0    mToken=WallpaperWindowToken{8bd9c0e token=android.os.Binder@7a51209}
    mViewVisibility=0x0 mHaveFrame=true mObscured=false
    mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
    mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mLastReportedConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
    mHasSurface=true isReadyForDisplay()=true mWindowRemovalAllowed=false
    Frames: containing=[0,0][1080,2280] parent=[0,0][1080,2280] display=[-10000,-10000][10000,10000]
    mFrame=[0,0][2767,2280] last=[0,0][2767,2280]
     surface=[0,0][0,0]
    WindowStateAnimator{6ffd213 com.android.systemui.ImageWallpaper}:
      mSurface=Surface(name=com.android.systemui.ImageWallpaper)/@0xaa06c50
      Surface: shown=true layer=0 alpha=1.0 rect=(0.0,0.0)  transform=(1.0, 0.0, 0.0, 1.0)
      mDrawState=HAS_DRAWN       mLastHidden=false
      mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0]
    mLastFreezeDuration=+496ms
    mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
    mHScale=2.2260659 mVScale=2.2265625
    mWallpaperX=0.0 mWallpaperY=0.5
    mWallpaperXStep=0.33333334 mWallpaperYStep=1.0
    mWallpaperZoomOut=0.0
    isOnScreen=true
    isVisible=true

  mGlobalConfiguration={1.0 310mcc260mnc [en_US] ldltr sw392dp w392dp h750dp 440dpi nrml long port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 2280) mAppBounds=Rect(0, 0 - 1080, 2148) mMaxBounds=Rect(0, 0 - 1080, 2280) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} as.2 s.70 fontWeightAdjustment=0}
  mHasPermanentDpad=false
  mTopFocusedDisplayId=0
  imeLayeringTarget in display# 0 Window{86a2d27 u0 com.android.launcher3/com.android.launcher3.uioverrides.QuickstepLauncher}
  imeInputTarget in display# 0 Window{86a2d27 u0 com.android.launcher3/com.android.launcher3.uioverrides.QuickstepLauncher}
  imeControlTarget in display# 0 Window{86a2d27 u0 com.android.launcher3/com.android.launcher3.uioverrides.QuickstepLauncher}
  mInTouchMode=true
  mBlurEnabled=true
  mLastDisplayFreezeDuration=+571ms due to Window{d01181 u0 StatusBar}
  mLastWakeLockHoldingWindow=null mLastWakeLockObscuringWindow=null
  mHighResTaskSnapshotScale=1.0
  SnapshotCache
  mInputMethodWindow=Window{f4229a8 u0 InputMethod}
  mTraversalScheduled=false
  mHoldScreenWindow=null
  mObscuringWindow=Window{dc87575 u0 com.android.systemui.ImageWallpaper}
  mSystemBooted=true mDisplayEnabled=true
  mTransactionSequence=153
  mDisplayFrozen=false windows=0 client=false apps=0  mRotation=0  mLastOrientation=5
 waitingForConfig=false
  Animation settings: disabled=false window=1.0 transition=1.0 animator=1.0
  `;
  const validSystemBarsA11 = {
    statusBar: {visible: true, x: 0, y: 0, width: 1080, height: 63},
    navigationBar: {visible: true, x: 0, y: 1794, width: 1080, height: 126}
  };
  const validSystemBarsA12 = {
    statusBar: {visible: true, x: 0, y: 0, width: 1080, height: 83},
    navigationBar: {visible: true, x: 0, y: 2148, width: 1080, height: 132}
  };

  describe('parseWindows', function () {
    it('should throw an error if no windows were found', function () {
      expect(() => { parseWindows(''); }).to.throw(Error);
    });
    it('should return defaults if only non matching windows were found', function () {
      parseWindows(`
      WINDOW MANAGER WINDOWS (dumpsys window windows)
        Window #0 Window{d1b7133 u0 pip-dismiss-overlay}:
          mDisplayId=0 rootTaskId=1 mSession=Session{6fdbba 684:u0a10144} mClient=android.os.BinderProxy@a5e1e9f
          mOwnerUid=10144 showForAllUsers=true package=com.android.systemui appop=NONE
          mAttrs={(0,1264)(fillx656) sim={adjust=pan} ty=NAVIGATION_BAR_PANEL fmt=TRANSLUCENT
            fl=NOT_FOCUSABLE NOT_TOUCHABLE LAYOUT_IN_SCREEN HARDWARE_ACCELERATED
            pfl=SHOW_FOR_ALL_USERS FIT_INSETS_CONTROLLED}
          Requested w=1080 h=656 mLayoutSeq=52
          mBaseLayer=251000 mSubLayer=0    mToken=WindowToken{561abec android.os.BinderProxy@a5e1e9f}
          mViewVisibility=0x4 mHaveFrame=true mObscured=false
          mSeq=0 mSystemUiVisibility=0x0
          mGivenContentInsets=[0,0][0,0] mGivenVisibleInsets=[0,0][0,0]
          mFullConfiguration={1.0 310mcc260mnc [en_US] ldltr sw411dp w411dp h659dp 420dpi nrml port finger qwerty/v/v dpad/v winConfig={ mBounds=Rect(0, 0 - 1080, 1920) mAppBounds=Rect(0, 0 - 1080, 1794) mWindowingMode=fullscreen mDisplayWindowingMode=fullscreen mActivityType=undefined mAlwaysOnTop=undefined mRotation=ROTATION_0} s.8}
          mLastReportedConfiguration={0.0 ?mcc?mnc ?localeList ?layoutDir ?swdp ?wdp ?hdp ?density ?lsize ?long ?ldr ?wideColorGamut ?orien ?uimode ?night ?touch ?keyb/?/? ?nav/? winConfig={ mBounds=Rect(0, 0 - 0, 0) mAppBounds=null mWindowingMode=undefined mDisplayWindowingMode=undefined mActivityType=undefined mAlwaysOnTop=undefined mRotation=undefined}}
          mHasSurface=false isReadyForDisplay()=false mWindowRemovalAllowed=false
          Frames: containing=[0,0][1080,1920] parent=[0,0][1080,1920]
              display=[0,0][1080,1920]
              content=[0,1264][1080,1794] visible=[0,1264][1080,1794]
              decor=[0,0][1080,1920]
          mFrame=[0,1264][1080,1920] last=[0,0][0,0]
          cutout=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}} last=DisplayCutout{insets=Rect(0, 0 - 0, 0) waterfall=Insets{left=0, top=0, right=0, bottom=0} boundingRect={Bounds=[Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0), Rect(0, 0 - 0, 0)]}}
          Cur insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,0][0,126]    Lst insets: content=[0,0][0,126] visible=[0,0][0,126] stable=[0,0][0,126]
          surface=[0,0][0,0]
          WindowStateAnimator{d2621a4 pip-dismiss-overlay}:
            mDrawState=NO_SURFACE       mLastHidden=false
            mEnterAnimationPending=false      mSystemDecorRect=[0,0][0,0] mLastClipRect=[0,0][0,0]
            mShownAlpha=0.0 mAlpha=1.0 mLastAlpha=0.0
          mForceSeamlesslyRotate=false seamlesslyRotate: pending=null finishedFrameNumber=0
          isOnScreen=false
          isVisible=false
          mRequestedInsetsState: InsetsState: {mDisplayFrame=Rect(0, 0 - 0, 0), mSources= {  }
      `).should.be.eql({
        statusBar: {visible: false, x: 0, y: 0, width: 0, height: 0},
        navigationBar: {visible: false, x: 0, y: 0, width: 0, height: 0}
      });
    });
    it('should return status and navigation bar for Android 11 and below', function () {
      parseWindows(validWindowOutputA11).should.be.eql(validSystemBarsA11);
    });
    it('should return status and navigation bar for Android 12 and above', function () {
      parseWindows(validWindowOutputA12).should.be.eql(validSystemBarsA12);
    });
  });

  describe('getSystemBars', function () {
    let driver;

    it('should throw an error if was unable to retrieve dumpsys output', async function () {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.shell = () => { throw new Error(); };
      await driver.getSystemBars().should.be.rejected;
    });
    it('should return the parsed system bar info below Android 11', async function () {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.shell = () => validWindowOutputA11;
      (await driver.getSystemBars()).should.be.eql(validSystemBarsA11);
    });
  });
});
