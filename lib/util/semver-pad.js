/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';


module.exports = semverPad();


function semverPad() {

  var regexMatch = /^(?:0|[1-9][0-9]*)(\.(?:0|[1-9][0-9]*))?$/; // match x or x.y

  // Pad `x.y` into `x.y.0` or `x` into `x.0.0`, everthing else will be passed through
  return function pad(version) {

    if (!regexMatch.test(version)) {
      return version;
    }

    var parts = version.split('.'),
        paddedVersion = (parts[0] || '0') + '.' + (parts[1] || '0') + '.' + (parts[2] || '0');

    return paddedVersion;
  };

}
