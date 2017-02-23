# Unlock with UIAutomation (New)
In Android 6+ devices and Emulators 2.0 Appium is failing to unlock those devices correctly
using the Unlock Helper App making tests to fail since the Browser or Apps may not start.
For those cases, we came up with a solution, unlocking the devices with UIAutomation by
adding new capabilities that would let you press on pins, draw patterns or send a password
depending on which lock you defined for your device.

`Using the unlock with UIAutomation capabilities:`
```json
{
  "unlockType": "pin",
  "unlockKey": "1111"
}
```
In case the *unlockType*  capability is not defined, *Appium* will continue working as it is using the Unlock Helper App, this new capabilities are optionals.

`Options:`
* unlockType: ['pin',  'password', 'pattern']


`Example:`

Lets say you have a device that is locked with a pattern  as the image below and you want to run a test over that device.

<img src="https://dl.dropboxusercontent.com/u/8655269/Screen%20Shot%202017-02-23%20at%2011.06.10%20AM.png" />

We treat the pattern pins as the numbers of a phone dial. So in this case the *unlockKey* would be `729854163`

<img src="https://dl.dropboxusercontent.com/u/8655269/Screen%20Shot%202017-02-23%20at%2011.06.20%20AM.png" />

And the capabilities would be:
```json
{
  "unlockType": "pattern",
  "unlockKey": "729854163"
}
```

`TODO`
* Add unlock with fingerprint for Android 6+ Emulators
