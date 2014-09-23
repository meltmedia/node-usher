/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';


module.exports = util();


function util() {
  return {
    workflowConfig: require('./workflow-config'),
    activityConfig: require('./activity-config')
  };
}
