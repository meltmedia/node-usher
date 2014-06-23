/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    events = require('events'),
    winston = require('winston'),
    _ = require('lodash'),
    Orchestrator = require('orchestrator'),
    STATUS = require('./tasks/status');


module.exports = WorkflowExecution;


function WorkflowExecution(tasks) {
  if (!(this instanceof WorkflowExecution)) {
    return new WorkflowExecution(tasks);
  }

  events.EventEmitter.call(this);

  this.tasks = tasks;
  this.context = {};
  this.orchestrator = new Orchestrator();

  _.each(this.tasks, function (task) {
    this.orchestrator.add(task.name, task.deps, this._getTaskHandler(task).bind(this));
  }.bind(this));
}


// Make WorkflowExecution an EventEmitter
util.inherits(WorkflowExecution, events.EventEmitter);


WorkflowExecution.prototype.execute = function execute(context) {
  this.context = context;
  this.orchestrator.start();
};


WorkflowExecution.prototype._getTaskHandler = function _getTaskHandler(task) {
  return function handleTask(done) {
    // Check to see if the task's dependencies have been resolved first
    if (!this.context.isResolved(task)) {
      this.context.setTaskStatus(task, STATUS.mask('pending'));
      return done();
    }

    // Execute this task, updating the context for future tasks to utilize
    var mask = task.execute(this.context);

    winston.log('debug', 'Task %s completed with status: ', task.name, mask);

    // Update the status
    this.context.setTaskStatus(task, mask);

    done();
  }.bind(this);
};
