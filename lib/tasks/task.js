/*!
 * Usher
 * Copyright(c) 2014 Mike Moulton <mike@meltmedia.com>
 */

/*jshint camelcase: false */

'use strict';

var _ = require('lodash');


module.exports = Task;


function Task(name, deps, options) {
  if (!(this instanceof Task)) {
    return new Task(name, deps, options);
  }

  this.name = name;
  this.deps = deps || [];
  this.options = options || {};
}


Task.prototype.setInputTransform = function setInputTransform(fn) {
  if (_.isFunction(fn)) {
    this.inputTransformFn = fn;
  }
};


Task.prototype.isResolved = function isResolved(context) {
  // If the activity has dependencies, make sure they have been resolved befor scheduling
  if (this.deps.length > 0) {

    var missing = _.reject(this.deps, function (dep) {
      return context.isResolved(dep);
    });

    if (!_.isEmpty(missing)) {
      // This activity is not yet ready to be scheduled
      return false;
    }
  }

  return true;
};


Task.prototype.input = function input(context) {
  var workflowEvents = context.eventList();

  // @todo: maybe support input transformation per activity
  var taskInput = {
    '_input': workflowEvents.workflow_input()
  };

  _.forEach(this.deps, function (key) {
    taskInput[key] = context.result(key);
  });

  // If a input tranform was defined, let it define the input for the activity
  if (_.isFunction(this.inputTransformFn)) {
    taskInput = this.inputTransformFn.call(this, taskInput);
  }

  return taskInput;
};


Task.prototype.execute = function execute() {
  // Do Nothing
};
