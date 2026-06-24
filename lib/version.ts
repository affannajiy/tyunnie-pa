// Single runtime source for the app's version. Reads straight from package.json
// so there's no extra place to bump — edit package.json (+ README + CHANGELOG as
// usual) and the login footer / update announcement pick it up automatically.
import pkg from "../package.json";

export const APP_VERSION: string = pkg.version;
