import releaseConfig from '@appium/semantic-release-config';

// Set only when the pipeline explicitly opts into a beta run (BETA_BRANCH_NAME set by
// .github/workflows/publish.js.yml's dist_tag input). Left undefined otherwise, so releaseConfig
// leaves `branches` unset and semantic-release's own default branches list applies - which
// already treats a branch literally named `beta` as a prerelease channel.
const betaBranch = process.env.BETA_BRANCH_NAME || undefined;

export default releaseConfig({betaBranch});
