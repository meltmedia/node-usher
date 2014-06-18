/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var winston = require('winston'),
    _ = require('lodash');


module.exports = Context;


function Context(decisionTask) {
  if (!(this instanceof Context)) {
    return new Context(decisionTask);
  }

  this.decisionTask = decisionTask;
  this.pendingTasks = [];
  this.resolvedTasks = [];
  this.scheduledTasks = [];
  this.failedTasks = [];
  this.completedTasks = [];
  this.outstandingTasks = [];
  this.results = {};
  this.terminateTask = null;
}

Context.prototype.state = function state() {
  return {
    pending: this.pendingTasks,
    resolved: this.resolvedTasks,
    scheduled: this.scheduledTasks,
    failed: this.failedTasks,
    completed: this.completedTasks,
    outstanding: this.outstandingTasks
  };
};

Context.prototype.result = function result(name) {
  return this.results[name];
};

Context.prototype.eventList = function eventList() {
  return this.decisionTask.eventList;
};

Context.prototype.pending = function pending(task) {
  this.pendingTasks.push(task.name);
};

Context.prototype.isPending = function isPending(name) {
  return _.contains(this.pendingTasks, name);
};

Context.prototype.resolve = function resolve(task) {
  this.resolvedTasks.push(task.name);
};

Context.prototype.isResolved = function isResolved(name) {
  return _.contains(this.resolvedTasks, name);
};

Context.prototype.failed = function failed(task) {
  this.failedTasks.push(task.name);
};

Context.prototype.isFailed = function isFailed(name) {
  return _.contains(this.failedTasks, name);
};

Context.prototype.complete = function complete(task, result) {
  this.completedTasks.push(task.name);
  this.results[task.name] = result;
};

Context.prototype.isComplete = function isComplete(name) {
  return _.contains(this.completedTasks, name);
};

Context.prototype.outstanding = function outstanding(task) {
  this.outstandingTasks.push(task.name);
};

Context.prototype.isOutstanding = function isOutstanding(name) {
  return _.contains(this.outstandingTasks, name);
};

Context.prototype.schedule = function schedule(task) {
  var input = task.input(this);

  var scheduledActivity = {
    name: task.name,
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
  winston.log('info', '-- scheduling activity: %s - %s - %s', task.name, JSON.stringify(scheduledActivity), JSON.stringify(scheduledActivityOptions));

  this.decisionTask.response.schedule(scheduledActivity, scheduledActivityOptions);
  this.scheduledTasks.push(task.name);
};

Context.prototype.isScheduled = function isScheduled(name) {
  return _.contains(this.scheduledTasks, name);
};

Context.prototype.terminate = function terminate(task) {
  this.terminateTask = task.name;
};

Context.prototype.shouldTerminate = function shouldTerminate() {
  return !_.isEmpty(this.terminateTask);
};
