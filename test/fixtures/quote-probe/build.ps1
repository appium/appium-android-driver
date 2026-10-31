param(
  [string]$AndroidHome = $env:ANDROID_HOME,
  [string]$JavaHome = $env:JAVA_HOME,
  [string]$BuildToolsVersion = '36.0.0',
  [string]$Platform = 'android-34',
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '../../../build/quote-probe')
)
$ErrorActionPreference = 'Stop'
$sourceDirectory = $PSScriptRoot
$buildTools = Join-Path $AndroidHome "build-tools/$BuildToolsVersion"
$androidJar = Join-Path $AndroidHome "platforms/$Platform/android.jar"
$env:JAVA_HOME = $JavaHome
New-Item -ItemType Directory -Force "$OutputDirectory/classes", "$OutputDirectory/dex" | Out-Null
Push-Location $OutputDirectory
try {
  & "$JavaHome/bin/javac.exe" -source 8 -target 8 -classpath $androidJar -d classes "$sourceDirectory/QuoteProbe.java"
  if ($LASTEXITCODE) { throw 'javac failed' }
  $classFiles = Get-ChildItem classes -Recurse -Filter '*.class' | ForEach-Object FullName
  & "$buildTools/d8.bat" --lib $androidJar --output dex $classFiles
  if ($LASTEXITCODE) { throw 'd8 failed' }
  & "$buildTools/aapt.exe" package -f -M "$sourceDirectory/AndroidManifest.xml" -I $androidJar -F unsigned.apk
  if ($LASTEXITCODE) { throw 'aapt package failed' }
  Copy-Item dex/classes.dex classes.dex
  & "$buildTools/aapt.exe" add unsigned.apk classes.dex
  if ($LASTEXITCODE) { throw 'aapt add failed' }
  & "$buildTools/zipalign.exe" -f 4 unsigned.apk aligned.apk
  if ($LASTEXITCODE) { throw 'zipalign failed' }
  if (!(Test-Path test.keystore)) {
    & "$JavaHome/bin/keytool.exe" -genkeypair -keystore test.keystore -alias test -storepass android -keypass android -dname 'CN=Appium Test' -keyalg RSA -validity 3650
    if ($LASTEXITCODE) { throw 'keytool failed' }
  }
  & "$buildTools/apksigner.bat" sign --ks test.keystore --ks-key-alias test --ks-pass pass:android --key-pass pass:android --out probe.apk aligned.apk
  if ($LASTEXITCODE) { throw 'apksigner failed' }
  Write-Output (Join-Path (Get-Location) 'probe.apk')
} finally {
  Pop-Location
}
