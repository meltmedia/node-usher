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
    'taskList'];

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
      },
      input: input
    };

    // Allow customization to scheduled workflow
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
