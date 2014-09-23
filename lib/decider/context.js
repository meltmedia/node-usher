/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

/* jshint camelcase:false */

'use strict';

var winston = require('winston'),
    _ = require('lodash'),
    usherUtil = require('../util');


module.exports = Context;


function Context(decisionTask, namespace) {
  if (!(this instanceof Context)) {
    return new Context(decisionTask, namespace);
  }

  this.namespace = namespace;
  this.decisionTask = decisionTask;
  this.eventList = decisionTask.eventList;
  this.status = {};
  this.results = {};
  this.terminate = false;
  this.failWorkflow = false;
  this.errorMessages = [];
  this.workflowInput = this.eventList.workflow_input();
}


Context.prototype.resolvedTaskName = function (task) {
  return (this.namespace) ? this.namespace + '-' + task.name : task.name;
};


Context.prototype.setWorkflowInput = function setWorkflowInput(input) {
  this.workflowInput = input;
};


Context.prototype.setTaskStatus = function setTaskStatus(task, mask) {
  this.status[task.name] = mask;

  // This workflow should fail as one of it's tasks failed
  if (mask.has('failed')) {
    this.failWorkflow = true;
    this.errorMessages.push('Task ' + task.name + ' failed.');
  }
};


Context.prototype.isResolved = function isResolved(task) {
  // If the activity has dependencies, make sure they have been resolved befor scheduling
  if (task.deps.length > 0) {

    var missing = _.reject(task.deps, function (dep) {
      return (this.status[dep]) ? this.status[dep].has('resolved') : false;
    }.bind(this));

    if (!_.isEmpty(missing)) {
      // This activity is not yet ready to be scheduled
      return false;
    }
  }

  return true;
};


Context.prototype.didActivityFail = function didActivityFail(task) {
  return this.eventList.failed(this.resolvedTaskName(task));
};


Context.prototype.didActivityComplete = function didActivityComplete(task) {
  return this.eventList.completed(this.resolvedTaskName(task));
};


Context.prototype.isActivityOutstanding = function isActivityOutstanding(task) {
  return this.eventList.scheduled(this.resolvedTaskName(task));
};


Context.prototype.didChildWorkflowFail = function didChildWorkflowFail(task) {
  return this.eventList.childworkflow_failed(this.resolvedTaskName(task));
};


Context.prototype.didChildWorkflowComplete = function didChildWorkflowComplete(task) {
  return this.eventList.childworkflow_completed(this.resolvedTaskName(task));
};


Context.prototype.isChildWorkflowOutstanding = function isChildWorkflowOutstanding(task) {
  return this.eventList.childworkflow_scheduled(this.resolvedTaskName(task));
};


Context.prototype.addResult = function addResult(task, value) {
  this.results[task.name] = value;
};


Context.prototype.addActivityResult = function addActivityResult(task) {
  this.results[task.name] = this.eventList.results(this.resolvedTaskName(task));
};


Context.prototype.addChildWorkflowResult = function addChildWorkflowResult(task) {
  this.results[task.name] = this.eventList.childworkflow_results(this.resolvedTaskName(task));
};


Context.prototype.terminateWorkflow = function terminateWorkflow() {
  this.terminate = true;
};


Context.prototype.scheduleActivity = function scheduleActivity(task) {

  var config = usherUtil.activityConfig(task.name, task.options.version, this.input(task), task.options);

  // Schedule actual task
  winston.log('debug', 'Scheduling activity: %s - %s', this.resolvedTaskName(task), JSON.stringify(config));

  this.decisionTask.response.schedule({ name: this.resolvedTaskName(task), input: config.input }, config);

};


Context.prototype.scheduleChildWorkflow = function scheduleChildWorkflow(task) {

  var config = usherUtil.workflowConfig(task.workflowName, task.workflowVersion, this.input(task), task.options);

  // Schedule actual task
  winston.log('debug', 'Scheduling child workflow: %s - %s', this.resolvedTaskName(task), JSON.stringify(config));

  // The aws-swf lib breaks apart some config and options here, even though they are ultimatly merged.
  // We only produce one config and send them both in to aws-swf that will produce a valid merged object.
  this.decisionTask.response.start_childworkflow({ name: this.resolvedTaskName(task), input: config.input }, config);

};


Context.prototype.input = function input(task) {
  var taskInput = {
    '_input': this.workflowInput
  };

  _.forEach(task.deps, function (key) {
    taskInput[key] = this.results[key];
  }.bind(this));

  // If a input tranform was defined, let it define the input for the activity
  if (task.options && _.isFunction(task.options.transform)) {
    taskInput = task.options.transform.call(task, taskInput);
  }

  return taskInput;
};


Context.prototype.done = function done() {
  return (
    this.terminate ||
    this.failWorkflow ||
    _.every(this.status, function (mask) { return mask.has('complete'); })
  );
};
