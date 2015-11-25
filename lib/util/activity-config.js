/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var _ = require('lodash');


module.exports = activityConfig();


function activityConfig() {

  var AVAILABLE_ACTIVITY_OPTIONS = [
    'activityType',
    'scheduleToStartTimeout',
    'scheduleToCloseTimeout',
    'startToCloseTimeout',
    'heartbeatTimeout',
    'taskList'];

  var DEFAULT_ACTIVITY_OPTIONS = {
    'scheduleToStartTimeout': '30',
    'scheduleToCloseTimeout': '90',
    'startToCloseTimeout': '60',
    'heartbeatTimeout': 'NONE'
  };

  return function generateConfig(name, version, input, options) {

    var activityConfig = {
      activityType: {
        name: options.activity || name,
        version: version || '1.0.0'
      },
      input: input
    };

    options.scheduleToStartTimeout = options.scheduleToStartTimeout || options.defaultTaskScheduleToStartTimeout;
    options.scheduleToCloseTimeout = options.scheduleToCloseTimeout || options.defaultTaskScheduleToCloseTimeout;
    options.startToCloseTimeout = options.startToCloseTimeout || options.defaultTaskStartToCloseTimeout;
    options.heartbeatTimeout = options.heartbeatTimeout || options.defaultTaskHeartbeatTimeout;

    // Allow customization to scheduled activity
    var activityOptions = _.pick(options, AVAILABLE_ACTIVITY_OPTIONS);

    // Set defaults for activity executions if not specified
    activityOptions = _.defaults(activityOptions, DEFAULT_ACTIVITY_OPTIONS);

    // Ensure task list is properly formatted
    if (_.isString(activityOptions.taskList)) {
      activityOptions.taskList = { name: activityOptions.taskList };
    }

    // Support options being a function with the signature 'function (input) { return dynamicOptionValue; }'
    _.each(activityOptions, function(value, key) {
      if (_.isFunction(value)) {
        activityOptions[key] = value.call(undefined, input);
      }
    });

    // Merge SWF options with new config
    activityConfig = _.defaults(activityConfig, activityOptions);

    return activityConfig;

  };

}
