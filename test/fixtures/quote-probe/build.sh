#!/usr/bin/env bash
set -euo pipefail

# macOS/Linux counterpart to build.ps1. All paths may contain spaces.
source_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
android_home="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
build_tools_version="${BUILD_TOOLS_VERSION:-36.0.0}"
platform="${ANDROID_PLATFORM:-android-34}"
output_directory="${OUTPUT_DIRECTORY:-$source_directory/../../../build/quote-probe}"

if [[ -z "$android_home" ]]; then
  echo 'Set ANDROID_HOME (or ANDROID_SDK_ROOT) to the Android SDK directory.' >&2
  exit 1
fi
# Resolve relative SDK paths before changing to the output directory.
android_home="$(cd "$android_home" && pwd)"
build_tools="$android_home/build-tools/$build_tools_version"
android_jar="$android_home/platforms/$platform/android.jar"
javac="${JAVA_HOME:+$JAVA_HOME/bin/}javac"
keytool="${JAVA_HOME:+$JAVA_HOME/bin/}keytool"
for tool in "$javac" "$keytool" "$build_tools/d8" "$build_tools/aapt" "$build_tools/zipalign" "$build_tools/apksigner"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required tool not found: $tool" >&2
    exit 1
  fi
done
if [[ ! -f "$android_jar" ]]; then
  echo "Android platform not found: $android_jar" >&2
  exit 1
fi

mkdir -p "$output_directory"
cd "$output_directory"
# Avoid packaging stale classes when the fixture source changes.
rm -rf classes dex
mkdir classes dex
"$javac" -source 8 -target 8 -classpath "$android_jar" -d classes "$source_directory/QuoteProbe.java"
class_files=()
while IFS= read -r -d '' class_file; do
  class_files+=("$class_file")
done < <(find classes -name '*.class' -print0)
"$build_tools/d8" --lib "$android_jar" --output dex "${class_files[@]}"
"$build_tools/aapt" package -f -M "$source_directory/AndroidManifest.xml" -I "$android_jar" -F unsigned.apk
cp dex/classes.dex classes.dex
"$build_tools/aapt" add unsigned.apk classes.dex
"$build_tools/zipalign" -f 4 unsigned.apk aligned.apk
if [[ ! -f test.keystore ]]; then
  "$keytool" -genkeypair -keystore test.keystore -alias test -storepass android -keypass android \
    -dname 'CN=Appium Test' -keyalg RSA -validity 3650
fi
"$build_tools/apksigner" sign --ks test.keystore --ks-key-alias test --ks-pass pass:android \
  --key-pass pass:android --out probe.apk aligned.apk
"$build_tools/apksigner" verify probe.apk
printf '%s/probe.apk\n' "$PWD"
