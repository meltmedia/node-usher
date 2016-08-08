/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var _ = require('lodash');


module.exports = workflowConfig();


function workflowConfig() {

  var AVAILABLE_WORKFLOW_OPTIONS = [
    'tagList',
    'childPolicy',
    'executionStartToCloseTimeout',
    'taskStartToCloseTimeout',
    'taskList',
    'taskPriority'
  ];

  var DEFAULT_WORKFLOW_OPTIONS = {
    taskStartToCloseTimeout: '300',
    executionStartToCloseTimeout: '1800',
    childPolicy: 'TERMINATE'
  };


  return function generateConfig(name, version, input, options) {

    var workflowConfig = {
      workflowType: {
        name: name,
        version: version || '1.0.0'
      }
    };

    // Support dynamic configuration of the executed workflow
    // If no result, revert to defaults
    if (_.isFunction(options.workflowType)) {
      workflowConfig.workflowType = options.workflowType.call(undefined, input) || workflowConfig.workflowType;
    }

    // Use default configured options, if exist and not otherwise set
    options.executionStartToCloseTimeout = options.executionStartToCloseTimeout || options.defaultExecutionStartToCloseTimeout;
    options.taskStartToCloseTimeout = options.taskStartToCloseTimeout || options.defaultTaskStartToCloseTimeout;
    options.childPolicy = options.childPolicy || options.defaultChildPolicy;

    // For some reason SWF does not like this even though API says it's okay
    // options.taskPriority = options.taskPriority || options.defaultTaskPriority || '0';

    // Pick only the supported options
    var workflowOptions = _.pick(options, AVAILABLE_WORKFLOW_OPTIONS);

    // Set defaults for workflow executions if not specified
    workflowOptions = _.defaults(workflowOptions, DEFAULT_WORKFLOW_OPTIONS);

    // Ensure task list is properly formatted
    if (_.isString(workflowOptions.taskList)) {
      workflowOptions.taskList = { name: workflowOptions.taskList };
    }

    // Support options being a function with the signature 'function (input) { return dynamicOptionValue; }'
    _.each(workflowOptions, function(value, key) {
      if (_.isFunction(value)) {
        workflowOptions[key] = value.call(undefined, input);
      }
    });

    // Merge SWF options with new config
    workflowConfig = _.defaults(workflowConfig, workflowOptions);
    return workflowConfig;

  };

}
