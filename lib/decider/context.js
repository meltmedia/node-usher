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


function Context(decisionTask, namespace, localVariables) {
  if (!(this instanceof Context)) {
    return new Context(decisionTask, namespace, localVariables);
  }

  this.namespace = namespace;
  this.decisionTask = decisionTask;
  this.eventList = decisionTask.eventList;
  this.workflowState = decisionTask.workflowState;
  this.status = {};
  this.results = {};
  this.states = {};
  this.localVariables = localVariables || {};
  this.errorMessages = [];
  this.workflowInput = this.eventList.workflow_input();
}


Context.prototype.setVariable = function (name, value) {
  var markerName = 'var-' + name;
  this.decisionTask.response.add_marker(markerName, JSON.stringify({ value: value }));

  // Save the value for future local use
  this.localVariables[name] = value;
};


Context.prototype.getVariables = function () {
  return _.defaults({}, this.localVariables, this.workflowState.variables);
};


Context.prototype.saveState = function (task, state) {
  var markerName = this.resolvedTaskName(task) + '-state-marker';
  this.decisionTask.response.add_marker(markerName, JSON.stringify(state));

  // Save the state for future local use
  this.states[markerName] = state;
};


Context.prototype.lastState = function (task) {
  var markerName = this.resolvedTaskName(task) + '-state-marker';

  // The state was updated within this execution
  if (this.states[markerName]) {
    return this.states[markerName];
  }

  // Get saved state from SWF
  var state = this.workflowState.result(markerName);
  if (state) {
    this.states[markerName] = state;
  }

  return this.states[markerName];
};


Context.prototype.deferExecution = function (task, id, delay) {
  this.decisionTask.response.start_timer({
    delay: delay || '1'
  }, {
    timerId: this.resolvedTaskName(task) + '-timer-' + id
  });
};


Context.prototype.resumeExecution = function (task, id) {
  var timerName = this.resolvedTaskName(task) + '-timer-' + id;

  // If there is no outstanding timer then execution should continue
  if (!this.workflowState.exists(timerName)) {
    return true;
  }

  // Only resume execution if the scheduled timer has fired
  return this.workflowState.completed(timerName);
};


Context.prototype.resolvedTaskName = function (task) {
  return (this.namespace) ? this.namespace + '-' + task.name : task.name;
};


Context.prototype.setWorkflowInput = function setWorkflowInput(input) {
  this.workflowInput = input;
};


Context.prototype.setTaskStatus = function setTaskStatus(task, mask) {
  this.status[task.name] = mask;

  if (mask.has('failed')) {
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
  return this.workflowState.failed(this.resolvedTaskName(task));
};


Context.prototype.didActivityComplete = function didActivityComplete(task) {
  return this.workflowState.completed(this.resolvedTaskName(task));
};


Context.prototype.isActivityOutstanding = function isActivityOutstanding(task) {
  return this.workflowState.outstanding(this.resolvedTaskName(task));
};


Context.prototype.didChildWorkflowFail = function didChildWorkflowFail(task) {
  return this.workflowState.failed(this.resolvedTaskName(task));
};


Context.prototype.didChildWorkflowComplete = function didChildWorkflowComplete(task) {
  return this.workflowState.completed(this.resolvedTaskName(task));
};


Context.prototype.isChildWorkflowOutstanding = function isChildWorkflowOutstanding(task) {
  return this.workflowState.outstanding(this.resolvedTaskName(task));
};


Context.prototype.addResult = function addResult(task, value) {
  this.results[task.name] = value;
};


Context.prototype.addActivityResult = function addActivityResult(task) {
  this.results[task.name] = this.workflowState.result(this.resolvedTaskName(task));
};


Context.prototype.addChildWorkflowResult = function addChildWorkflowResult(task) {
  this.results[task.name] = this.workflowState.result(this.resolvedTaskName(task));
};


Context.prototype.scheduleActivity = function scheduleActivity(task) {
  var config = usherUtil.activityConfig(task.name, task.options.version, this.inputContext(task), task.options);

  // Schedule actual task
  winston.log('debug', 'Scheduling activity: %s - %s', this.resolvedTaskName(task), JSON.stringify(config));

  this.decisionTask.response.schedule({ name: this.resolvedTaskName(task), input: this.input(task) }, config);
};


Context.prototype.scheduleChildWorkflow = function scheduleChildWorkflow(task) {
  var config = usherUtil.workflowConfig(task.workflowName, task.workflowVersion, this.inputContext(task), task.options);

  // Set the workflow input
  config.input = this.input(task);

  // Schedule actual task
  winston.log('debug', 'Scheduling child workflow: %s - %s', this.resolvedTaskName(task), JSON.stringify(config));

  // The aws-swf lib breaks apart some config and options here, even though they are ultimatly merged.
  // We only produce one config and send them both in to aws-swf that will produce a valid merged object.
  this.decisionTask.response.start_childworkflow({ name: this.resolvedTaskName(task) }, config);
};


Context.prototype.inputContext = function inputContext(task) {
  var taskInput = {
    '_input': this.workflowInput,
    '_state': this.lastState(task),
    '_variables': this.getVariables()
  };

  _.forEach(task.deps, function (key) {
    taskInput[key] = this.results[key];
  }.bind(this));

  return taskInput;
};


Context.prototype.input = function input(task) {
  var self = this;

  var taskInput = this.inputContext(task);

  // If a input tranform was defined, let it define the input for the activity
  if (task.options && _.isFunction(task.options.transform)) {
    taskInput = task.options.transform.call(task, taskInput, self);
  }

  return taskInput;
};


Context.prototype.done = function done() {
  return (
    this.terminated() ||
    this.failed() ||
    this.success()
  );
};


Context.prototype.terminated = function terminated() {
  return (
    _.some(this.status, function (mask) {
      return mask.has('terminate');
    })
  );
};


Context.prototype.success = function success() {
  return (
    _.every(this.status, function (mask) {
      return mask.has('complete');
    })
  );
};


Context.prototype.failed = function failed() {
  return (
    _.some(this.status, function (mask) {
      return mask.has('failed');
    })
  );
};


Context.prototype.currentStatus = function currentStatus() {
  return _.reduce(this.status, function (result, mask, id) {
    result[id] = mask.value();
    return result;
  }, {});
};


/**
 * Util Functions
 */
