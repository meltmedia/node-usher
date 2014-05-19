/*!
 * Usher
 * Copyright(c) 2014 Mike Moulton <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    events = require('events'),
    winston = require('winston'),
    _ = require('lodash'),
    Orchestrator = require('orchestrator'),
    Context = require('./context');


module.exports = WorkflowExecution;


function WorkflowExecution(tasks) {
  if (!(this instanceof WorkflowExecution)) {
    return new WorkflowExecution(tasks);
  }

  var self = this;

  events.EventEmitter.call(this);

  this.tasks = tasks;
  this.context = {};
  this.orchestrator = new Orchestrator();

  _.each(this.tasks, function (task) {
    self.orchestrator.add(task.name, task.deps, self._getTaskHandler(task).bind(this));
  });
}


// Make WorkflowExecution an EventEmitter
util.inherits(WorkflowExecution, events.EventEmitter);


WorkflowExecution.prototype.execute = function execute(decisionTask) {
  this.decisionTask = decisionTask;

  this.context = new Context(decisionTask);
  this.orchestrator.start();

  return this.context;
};


WorkflowExecution.prototype._getTaskHandler = function _getTaskHandler(task) {
  return function handleTask(done) {
    winston.log('debug', 'Evaluating context of task: %s', task.name);
    // Execute this task, updating the context for future tasks to utilize
    task.execute(this.context);
    done();
  }.bind(this);
};
