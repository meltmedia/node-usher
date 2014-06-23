/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

/* jshint camelcase:false */

'use strict';

var winston = require('winston'),
    _ = require('lodash');


var DEFAULT_CHILD_WORKFLOW_OPTIONS = {
  taskStartToCloseTimeout: '30',
  executionStartToCloseTimeout: '30',
  childPolicy: 'TERMINATE'
};


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
  var input = this.input(task);

  var scheduledActivity = {
    name: this.resolvedTaskName(task),
    activity: {
      name: task.options.activity || task.name,
      version: task.options.version || '1.0'
    },
    input: input
  };

  // Allow customization to scheduled activity
  var scheduledActivityOptions = _.pick(task.options,
    ['activityType', 'scheduleToStartTimeout', 'scheduleToCloseTimeout', 'startToCloseTimeout', 'heartbeatTimeout', 'taskList']);

  // Set default taskList if not customized
  if (_.isUndefined(scheduledActivityOptions.taskList)) {
    scheduledActivityOptions.taskList = { name: task.name + '-tasklist' };
  }

  // Schedule actual task
  winston.log('debug', 'Scheduling activity: %s - %s - %s', this.resolvedTaskName(task), JSON.stringify(scheduledActivity), JSON.stringify(scheduledActivityOptions));

  this.decisionTask.response.schedule(scheduledActivity, scheduledActivityOptions);
};


Context.prototype.scheduleChildWorkflow = function scheduleChildWorkflow(task) {
  var input = this.input(task);

  var scheduledChildWorkflow = {
    name: this.resolvedTaskName(task),
    workflow: {
      name: task.workflowName,
      version: task.workflowVersion
    }
  };

  // Allow customization to scheduled activity
  var scheduledChildWorkflowOptions = _.pick(task.options,
    ['tagList', 'childPolicy', 'executionStartToCloseTimeout', 'taskStartToCloseTimeout', 'taskList']);

  // Set defaults for child workflow executions if not specified
  scheduledChildWorkflowOptions = _.defaults(scheduledChildWorkflowOptions, DEFAULT_CHILD_WORKFLOW_OPTIONS);

  // Set the input for the child workflow
  scheduledChildWorkflowOptions.input = input;

  // Schedule actual task
  winston.log('debug', 'Scheduling child workflow: %s - %s - %s', this.resolvedTaskName(task), JSON.stringify(scheduledChildWorkflow), JSON.stringify(scheduledChildWorkflowOptions));

  this.decisionTask.response.start_childworkflow(scheduledChildWorkflow, scheduledChildWorkflowOptions);
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
