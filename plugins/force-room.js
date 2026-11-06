// WorkManager 2.9 (pulled in by a dependency) needs Room 2.6, but another dependency resolves Room to 2.5,
// which made v2.1.0 crash on launch ("Failed to create an instance of class androidx.work.impl.WorkDatabase").
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCK = `
// force-room: keep Room in step with WorkManager (see plugins/force-room.js)
configurations.all {
    resolutionStrategy {
        force 'androidx.room:room-runtime:2.6.1', 'androidx.room:room-ktx:2.6.1'
    }
}
`;

module.exports = (config) => withAppBuildGradle(config, (c) => {
  if (!c.modResults.contents.includes('force-room')) c.modResults.contents += BLOCK;
  return c;
});
